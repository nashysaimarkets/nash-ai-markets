#!/usr/bin/env python3
"""Offline candidate preparation, NEVER semantic/legal acceptance or dispatch.

Read a pinned vendor ZIP, verify cross-timeframe OHLCV exactly using Decimal,
render unmodified observed bars, and retain provenance/calibration privately.
No networking, credentials, provider SDK, interpolation or model observations.
"""
from __future__ import annotations
import argparse
import base64
import csv
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from decimal import Decimal, InvalidOperation
import hashlib
import io
import json
from pathlib import Path
import re
import zipfile
from zoneinfo import ZoneInfo

FIELDS = ('timestamp', 'open', 'high', 'low', 'close', 'volume')
PRICE_FIELDS = ('open', 'high', 'low', 'close')
ZONE = ZoneInfo('America/New_York')
WIDTH, HEIGHT = 1400, 850
PLOT = dict(left=90, right=1250, top=105, bottom=690)

def digest(data):
    return hashlib.sha256(data).hexdigest()

def encode(value):
    return (json.dumps(value, indent=2, ensure_ascii=False, allow_nan=False) + '\n').encode()

def local_time(text):
    value = datetime.strptime(text, '%Y-%m-%d %H:%M:%S')
    a, b = value.replace(tzinfo=ZONE, fold=0), value.replace(tzinfo=ZONE, fold=1)
    if a.utcoffset() != b.utcoffset():
        raise ValueError('ambiguous/nonexistent local timestamp requires explicit offset')
    if a.astimezone(timezone.utc).astimezone(ZONE).replace(tzinfo=None) != value:
        raise ValueError('nonexistent local timestamp')
    return a

@dataclass(frozen=True)
class Bar:
    timestamp: datetime
    open: Decimal
    high: Decimal
    low: Decimal
    close: Decimal
    volume: Decimal
    source_count: int = 1

def parse_csv(data, minutes):
    if minutes not in (1, 5, 15, 30, 60, 240):
        raise ValueError('unsupported timeframe')
    reader = csv.reader(io.StringIO(data.decode('utf-8-sig')))
    rows = list(reader)
    if not rows:
        raise ValueError('empty source')
    # Observed ZIP has a header despite the web summary saying no header.
    if tuple(rows[0]) == FIELDS:
        rows = rows[1:]
    result = []
    for row in rows:
        if len(row) != 6:
            raise ValueError('wrong CSV shape')
        stamp = local_time(row[0])
        if stamp.second or (stamp.hour * 60 + stamp.minute) % minutes:
            raise ValueError('off-grid timestamp')
        if result and stamp <= result[-1].timestamp:
            raise ValueError('duplicate/unordered timestamp')
        if any(not re.fullmatch(r'\d+(?:\.\d+)?', x) for x in row[1:]):
            raise ValueError('invalid numeric syntax')
        try:
            o, h, l, c, v = map(Decimal, row[1:])
        except InvalidOperation as error:
            raise ValueError('invalid decimal') from error
        if not all(x.is_finite() for x in (o,h,l,c,v)) or not 0 < l <= min(o,c) <= max(o,c) <= h or v <= 0 or v != v.to_integral_value():
            raise ValueError('invalid OHLCV')
        result.append(Bar(stamp,o,h,l,c,v))
    if not result:
        raise ValueError('empty source')
    return result

def aggregate(rows, minutes):
    if minutes not in (5,15,30,60,240):
        raise ValueError('unsupported aggregation')
    groups = {}
    for r in rows:
        start = r.timestamp.replace(hour=0,minute=0,second=0) + timedelta(minutes=((r.timestamp.hour*60+r.timestamp.minute)//minutes)*minutes)
        groups.setdefault(start,[]).append(r)
    return [Bar(t,g[0].open,max(r.high for r in g),min(r.low for r in g),g[-1].close,sum((r.volume for r in g),Decimal(0)),len(g)) for t,g in groups.items()]

def equal_bars(a,b):
    return len(a)==len(b) and all((x.timestamp,x.open,x.high,x.low,x.close,x.volume)==(y.timestamp,y.open,y.high,y.low,y.close,y.volume) for x,y in zip(a,b))

def select(rows, start, end, minutes):
    start, end = local_time(start), local_time(end)
    chosen = [r for r in rows if start <= r.timestamp <= end]
    if not chosen or chosen[0].timestamp != start or chosen[-1].timestamp != end:
        raise ValueError('window endpoint absent')
    if any(b.timestamp-a.timestamp != timedelta(minutes=minutes) for a,b in zip(chosen,chosen[1:])):
        raise ValueError('window contains a trading gap; never interpolate')
    if any(r.source_count != minutes for r in chosen):
        raise ValueError('incomplete underlying minute coverage')
    return chosen

def serialize_bar(r):
    return dict(timestamp=r.timestamp.isoformat(),timestampUtc=r.timestamp.astimezone(timezone.utc).isoformat(),**{k:str(getattr(r,k)) for k in (*PRICE_FIELDS,'volume')},sourceCount=r.source_count)

def validate_plan(plan):
    if not isinstance(plan,dict) or not re.fullmatch(r'[a-f0-9]{64}',str(plan.get('sourceZipSha256',''))):
        raise ValueError('invalid source pin')
    cases=plan.get('cases')
    if not isinstance(cases,list) or len(cases)!=3:
        raise ValueError('exact three missing-case candidates required')
    required={'bear-flag':(5,'5m'),'wedge':(15,'15m'),'negative-no-signal':(5,'5m')}
    seen_ids,seen_scenarios=set(),set()
    for c in cases:
        if not isinstance(c,dict):raise ValueError('invalid candidate')
        cid=c.get('caseId','');scenario=c.get('scenario')
        if not isinstance(cid,str) or not re.fullmatch(r'[a-z0-9-]{1,80}',cid) or cid in seen_ids:
            raise ValueError('invalid or duplicate case id')
        if scenario not in required or scenario in seen_scenarios or (c.get('minutes'),c.get('timeframe'))!=required[scenario]:
            raise ValueError('canonical scenario/timeframe mismatch')
        seen_ids.add(cid);seen_scenarios.add(scenario)
        start,end=local_time(c.get('start','')),local_time(c.get('end',''))
        if start>=end or start.date()!=end.date() or (end-start)>timedelta(hours=16):
            raise ValueError('invalid candidate window')
        anchors=c.get('anchors')
        if not isinstance(anchors,list) or len(anchors)>40 or (scenario=='negative-no-signal' and anchors) or (scenario!='negative-no-signal' and len(anchors)<3):
            raise ValueError('invalid anchors')
        last=None
        for a in anchors:
            if not isinstance(a,dict) or a.get('field') not in PRICE_FIELDS:raise ValueError('invalid anchor')
            t=local_time(a.get('timestamp',''))
            if not start<=t<=end or (last is not None and t<=last):raise ValueError('anchor outside window or unordered')
            last=t
        if not all(isinstance(c.get(k),str) and c[k].strip() for k in ['reason','scope']):
            raise ValueError('explicit selection rationale and scope required')

def render(rows, timeframe):
    from PIL import Image, ImageDraw, ImageFont
    image=Image.new('RGB',(WIDTH,HEIGHT),'#f7f8fa');d=ImageDraw.Draw(image)
    font_path='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
    font=lambda n:ImageFont.truetype(font_path,n)
    lo,hi=min(r.low for r in rows),max(r.high for r in rows)
    margin=max(Decimal('.05'),(hi-lo)*Decimal('.08'))
    bottom,top=lo-margin,hi+margin
    x=lambda i:PLOT['left']+(i+.5)*(PLOT['right']-PLOT['left'])/len(rows)
    y=lambda p:PLOT['bottom']-float((p-bottom)/(top-bottom))*(PLOT['bottom']-PLOT['top'])
    d.text((90,25),f'SPY ETF | {timeframe} | FirstRate Data historical sample',font=font(26),fill='#102332')
    d.text((90,65),f'{rows[0].timestamp:%d %b %Y %H:%M} - {rows[-1].timestamp:%H:%M} America/New_York | split-adjusted USD',font=font(18),fill='#536677')
    d.rectangle((PLOT['left'],PLOT['top'],PLOT['right'],PLOT['bottom']),fill='white',outline='#b5bec7')
    ticks=[]
    for i in range(7):
        price=(bottom+(top-bottom)*Decimal(i)/Decimal(6)).quantize(Decimal('.0001'))
        yp=y(price);d.line((PLOT['left'],round(yp),PLOT['right'],round(yp)),fill='#e3e7ec')
        d.text((1262,round(yp)-10),str(price),font=font(16),fill='#21384a')
        ticks.append(dict(price=str(price),label=str(price),y=yp))
    geometry=[];volume_max=max(r.volume for r in rows)
    for i,r in enumerate(rows):
        xp=x(i);points={k:dict(x=xp,y=y(getattr(r,k)),price=str(getattr(r,k))) for k in PRICE_FIELDS}
        color='#168370' if r.close>=r.open else '#c74055';half=max(1,min(11,int((PLOT['right']-PLOT['left'])/len(rows)*.31)))
        d.line((round(xp),round(points['high']['y']),round(xp),round(points['low']['y'])),fill=color,width=2)
        a,b=sorted([round(points['open']['y']),round(points['close']['y'])]);d.rectangle((round(xp)-half,a,round(xp)+half,max(a+1,b)),fill=color)
        v=int(r.volume/volume_max*55);d.rectangle((round(xp)-half,805-v,round(xp)+half,805),fill=color)
        geometry.append(dict(timestamp=r.timestamp.isoformat(),barIndex=i,points=points))
    for i in sorted(set([0,len(rows)//4,len(rows)//2,3*len(rows)//4,len(rows)-1])):
        d.text((int(x(i))-25,703),rows[i].timestamp.strftime('%H:%M'),font=font(16),fill='#21384a')
    d.text((90,811),'Volume: shares | Data: FirstRate Data | Historical observations; no forecast',font=font(15),fill='#536677')
    b=io.BytesIO();image.save(b,format='PNG',optimize=False)
    return b.getvalue(),dict(kind='linear',plot=PLOT,priceMin=str(bottom),priceMax=str(top),ticks=ticks,candles=geometry,pixelQuantizationBound=.5)

def build(source_zip, plan_file, output):
    plan=json.loads(plan_file.read_text());validate_plan(plan);raw=source_zip.read_bytes()
    if digest(raw)!=plan['sourceZipSha256']:
        raise ValueError('source ZIP hash mismatch; obtain explicit new source selection')
    with zipfile.ZipFile(io.BytesIO(raw)) as archive:
        if any(x.file_size>5_000_000 for x in archive.infolist()):
            raise ValueError('oversized source member')
        data=archive.read('SPY_1min_sample.csv');minute=parse_csv(data,1)
        checks=[]
        for n,name in [(5,'SPY_5min_sample.csv'),(30,'SPY_30min_sample.csv'),(60,'SPY_1hour_sample.csv')]:
            actual=aggregate(minute,n);supplied=parse_csv(archive.read(name),n)
            if not equal_bars(actual,supplied):raise ValueError('vendor timeframe mismatch '+str(n))
            checks.append(dict(minutes=n,bars=len(actual),exactDecimalMatch=True))
    if output.exists():
        raise ValueError('output must be new; never overwrite immutable evidence')
    output.mkdir(parents=True,mode=0o700)
    for sub in ['images','inputs','labels','data','reviews']:(output/sub).mkdir(mode=0o700)
    (output/'data'/'source.zip').write_bytes(raw)
    report=dict(status='SOURCE_INTEGRITY_PASS_NOT_ACCEPTANCE',sourceZipSha256=digest(raw),minuteFileSha256=digest(data),minuteRows=len(minute),observedStart=minute[0].timestamp.isoformat(),observedEnd=minute[-1].timestamp.isoformat(),crossTimeframe=checks,cases=[],dispatchAuthorised=False,providerCalls=0,independentHumanReviews=0)
    for c in plan['cases']:
        if not re.fullmatch(r'[a-z0-9-]{1,80}',c['caseId']):raise ValueError('invalid case id')
        selected=select(aggregate(minute,c['minutes']),c['start'],c['end'],c['minutes'])
        png,calibration=render(selected,c['timeframe']);cid=c['caseId']
        image_path='images/'+cid+'.png';input_path='inputs/'+cid+'.scan-input.json';label_path='labels/'+cid+'.proposal.json';bars_path='data/'+cid+'.bars.json'
        (output/image_path).write_bytes(png)
        payload=dict(image='data:image/png;base64,'+base64.b64encode(png).decode(),intention='UNSURE',chartConfirmation=dict(instrument='SPY ETF (FirstRate Data)',timeframe=c['timeframe'],currentPrice=str(selected[-1].close),contextMatch='NOT_PROVIDED'))
        input_bytes=encode(payload);(output/input_path).write_bytes(input_bytes)
        anchors=[]
        for a in c['anchors']:
            idx=next((i for i,r in enumerate(selected) if r.timestamp==local_time(a['timestamp'])),None)
            if idx is None or a['field'] not in PRICE_FIELDS:raise ValueError('anchor not in source')
            anchors.append(dict(timestamp=selected[idx].timestamp.isoformat(),field=a['field'],barIndex=idx,**calibration['candles'][idx]['points'][a['field']]))
        features=[] if c['scenario']=='negative-no-signal' else [dict(id=cid+'-pattern',label=c['scenario'],pixels=[dict(x=a['x'],y=a['y']) for a in anchors],prices=[float(a['price']) for a in anchors])]
        label=dict(caseId=cid,scenario=c['scenario'],timeframe=c['timeframe'],instrument='SPY ETF (FirstRate Data)',rasterSha256=digest(png),inputSha256=digest(input_bytes),negative=c['scenario']=='negative-no-signal',features=features,anchors=anchors,calibration=calibration,annotationStatus='AUTOMATED_PRIMARY_PROPOSAL_NOT_GROUND_TRUTH',independentAnnotator=None,canonicalCaseAccepted=False,selectionReason=c['reason'],scope=c['scope'],tolerancesStatus='PENDING_PRE_RUN_HUMAN_ADJUDICATION',noProviderResultsUsedInSelection=True)
        labels=encode(label);(output/label_path).write_bytes(labels)
        bars_bytes=encode([serialize_bar(r) for r in selected]);(output/bars_path).write_bytes(bars_bytes)
        report['cases'].append(dict(caseId=cid,scenario=c['scenario'],timeframe=c['timeframe'],instrument=label['instrument'],rasterSha256=digest(png),inputSha256=digest(input_bytes),labelSha256=digest(labels),barsSha256=digest(bars_bytes),imagePath=image_path,inputPath=input_path,labelPath=label_path,barsPath=bars_path,width=WIDTH,height=HEIGHT,bars=len(selected),minutes=sum(r.source_count for r in selected),firstBar=selected[0].timestamp.isoformat(),lastBar=selected[-1].timestamp.isoformat(),canonicalCaseAccepted=False,sourceRightsStatus='PUBLISHED_RENDER_AND_PROCESSOR_GRANT_FOUND_EXECUTOR_SCOPE_PENDING',independentReviewStatus='PENDING_HUMAN'))
    (output/'SOURCE-VALIDATION.json').write_bytes(encode(report))
    (output/'reviews'/'independent-records.json').write_bytes(encode([]))
    (output/'SELECTION.json').write_bytes(plan_file.read_bytes())
    return report

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--source-zip',type=Path,required=True);p.add_argument('--selection',type=Path,required=True);p.add_argument('--output',type=Path,required=True);a=p.parse_args()
    r=build(a.source_zip,a.selection,a.output);print(json.dumps({k:r[k] for k in ['status','minuteRows','crossTimeframe','dispatchAuthorised','providerCalls','independentHumanReviews']}))
