#!/usr/bin/env python3
"""Offline real-price benchmark preparation. No network, inference or acceptance.
Reuses the frozen Decimal source reader/aggregator; preserves the old six packet.
"""
from __future__ import annotations
import argparse, base64, csv, hashlib, importlib.util, io, json, re, shutil, sys, zipfile
from collections import Counter
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from pathlib import Path
import math
from zoneinfo import ZoneInfo

spec=importlib.util.spec_from_file_location('monaco_source_core',Path(__file__).with_name('prepare-monaco-source-candidates.py'))
core=importlib.util.module_from_spec(spec);sys.modules[spec.name]=core;spec.loader.exec_module(core)
encode,digest=core.encode,core.digest
def strict_json(raw):
 value=json.loads(raw,parse_constant=lambda x: (_ for _ in ()).throw(ValueError('nonfinite JSON '+x)))
 def finite(x):
  if isinstance(x,float) and not math.isfinite(x):raise ValueError('nonfinite JSON number')
  if isinstance(x,dict):
   for y in x.values():finite(y)
  elif isinstance(x,list):
   for y in x:finite(y)
 finite(value);return value
RIGHTS_PINS={'frd-license.html': '1d26752ee925a447b9aa68d7736dd3d7687e2830256a7d184d1ed26b31b923cb', 'RIGHTS-RESEARCH.md': '4b508ae962bb2c1857ca54c11d5dba689b2639a1fc809a15b25728ae71dc5693', 'frd-faq.html': 'a3b757eeea426e4fbd0aa6c5338a7a9ff2dc145e269ca6831f758a0dfeb4f69c'}
RIGHTS='PUBLISHED_COMMERCIAL_RENDER_AND_PROCESSOR_GRANT_EXECUTOR_SCOPE_PENDING'
CANONICAL={'range-clear':'30m','double-top':'1h','head-shoulders':'4h','bear-flag':'5m','wedge':'15m','negative-no-signal':'5m'}
ALLOCATION={'clear_pattern':15,'structure':15,'near_miss':10,'phone':10}
SOURCE_INFO={
 'SPY':dict(zone='America/New_York',instrument='SPY ETF',family='US500',units='shares',basis='Vendor sample described as split-adjusted; corporate actions not independently audited',url='https://frd001.s3.us-east-2.amazonaws.com/frd_sample_etf_SPY.zip',sha256='f6031429ed0903be2a580be29529c37b6b017164d8b118c8d6267d2706148073'),
 'ES':dict(zone='America/New_York',instrument='ES continuous futures',family='US500',units='contracts',basis='Vendor sample described as unadjusted continuous; contract/roll map absent; not relabelled as a specific contract',url='https://frd001.s3.us-east-2.amazonaws.com/frd_sample_futures_ES.zip',sha256='359526b7043d72e476a2e8df9cbdc9a88891c00663f50e8176f76a4a0bd872d8'),
 'AAPL':dict(zone='America/New_York',instrument='AAPL stock',family='AAPL',units='shares',basis='Vendor sample described as split-adjusted; corporate actions not independently audited',url='https://frd001.s3.us-east-2.amazonaws.com/frd_sample_stock_AAPL.zip',sha256='c88833e3d7b30c34110064d4c1647db3bcecedb486f259a2638e53d6c9dbc491'),
 'BTC':dict(zone='UTC',instrument='BTC crypto',family='BTC',units='crypto units (vendor README)',basis='Vendor BTC instrument; exchange/pair routing not specified in sample; do not assume a venue',url='https://frd001.s3.us-east-2.amazonaws.com/frd_sample_crypto_BTC.zip',sha256='6a887bc7417b896bbd578eb0fecf5c3693c391a285dfd9a6d3d31325056a119c'),
}

def parse_crypto_csv(data,minutes):
 # BTC bytes include recorded zero-volume rows, contrary to the generic README.
 # Retain those observations and exact volumes; never fabricate trades or fill prices.
 reader=csv.reader(io.StringIO(data.decode('utf-8-sig')));rows=list(reader)
 if rows and tuple(rows[0])==core.FIELDS:rows=rows[1:]
 result=[]
 for row in rows:
  if len(row)!=6 or any(not re.fullmatch(r'\d+(?:\.\d+)?',x) for x in row[1:]):raise ValueError('invalid crypto row')
  t=core.local_time(row[0]);o,h,l,c,v=map(Decimal,row[1:])
  if t.second or (t.hour*60+t.minute)%minutes or (result and t<=result[-1].timestamp):raise ValueError('crypto timestamp')
  if not 0<l<=min(o,c)<=max(o,c)<=h or v<0:raise ValueError('crypto OHLCV')
  result.append(core.Bar(t,o,h,l,c,v))
 if not result:raise ValueError('empty crypto data')
 return result

LEGACY_PINS={
 'd004':dict(rasterSha256='d2277fadcea7c84ab500614f9d69e1ae7a7acae4b28f4e8cc6ec428711a640f7',inputSha256='fd6eb8064864889fcff3e80f13188a34f991a683c86980ac48f0ca7484ca4c05',barsSha256='7971d2a8c33a08fba7fa8464aa85c87bd6e931e35fa023eb3f02d3146ac30db3',labelSha256='726c73ae7c813bcc2b1df48296993bf743d055e075ce0afa4cb21ea85c104910'),
 'd005':dict(rasterSha256='2da8d62cf20c67658521fc4d22d79b509ca01e78d9eb2bdb76ae92ac02559618',inputSha256='5ed2fc0aef4efd1f573a9ccf7120fdc376776a2da8a5071928bda8d9254887a1',barsSha256='7ff826cbf983475b7893e0d6c3dff32ebdf97b036342890e2db6c27bae90f11c',labelSha256='9b15acebe6c5106e399bdbf3b78bdbba1c3e1f3ddf19ea81e3abdd86e8311797'),
 'd006':dict(rasterSha256='9029b022e8fa31139bf0abd98998a75c5e70948f40b1e66c634bda927b592eef',inputSha256='52af1a225c8139180171c1f69222217e3b23a6f9dd9ba497a780aecd3bd7e277',barsSha256='d33c0c71b69e3fe60367c917898869222684050a29c9bb4ab029f8623b0f5d55',labelSha256='02d8aef8c0acee79f9693eaf612be54fc8237e362393b6249fee992f7d6a3f15')}

def load_source(symbol,path):
 info=SOURCE_INFO[symbol];raw=path.read_bytes()
 if digest(raw)!=info['sha256']:raise ValueError('source ZIP pin mismatch '+symbol)
 oldzone=core.ZONE
 try:
  core.ZONE=ZoneInfo(info['zone'])
  with zipfile.ZipFile(io.BytesIO(raw)) as z:
   if any(x.file_size>8_000_000 for x in z.infolist()):raise ValueError('oversized source')
   parser=parse_crypto_csv if symbol=='BTC' else core.parse_csv
   member=symbol+'_1min_sample.csv';data=z.read(member);minute=parser(data,1);checks=[]
   for n,suffix in [(5,'5min'),(30,'30min'),(60,'1hour')]:
    agg=core.aggregate(minute,n);provided=parser(z.read(f'{symbol}_{suffix}_sample.csv'),n)
    am={r.timestamp:r for r in agg};pm={r.timestamp:r for r in provided}
    bad=[t for t in sorted(am.keys()|pm.keys()) if t not in am or t not in pm or any(getattr(am[t],f)!=getattr(pm[t],f) for f in (*core.PRICE_FIELDS,'volume'))]
    if bad and symbol!='BTC':raise ValueError('cross-timeframe mismatch '+symbol+str(n))
    checks.append(dict(minutes=n,bars=len(agg),vendorBars=len(provided),exactDecimalMatch=not bad,quarantinedIntervals=[dict(start=t.isoformat(),end=(t+timedelta(minutes=n)).isoformat()) for t in bad]))
   readmes={x:digest(z.read(x)) for x in z.namelist() if 'readme' in x.lower()}
 finally:core.ZONE=oldzone
 report=dict(symbol=symbol,**info,minuteMember=member,minuteSha256=digest(data),minuteRows=len(minute),zeroVolumeRows=sum(r.volume==0 for r in minute),observedStart=minute[0].timestamp.isoformat(),observedEnd=minute[-1].timestamp.isoformat(),readmeHashes=readmes,crossTimeframe=checks,limitations=['Actual October 4/5–19 bytes differ from advertised sample dates','Absent minutes are not filled; BTC retains recorded zero-volume rows despite generic README claiming omission; volume is not evidence of order-book liquidity','Short convenience sample; not representative across years, regimes or venues'])
 return minute,report

def window(rows,minutes,start,end):
 start,end=datetime.fromisoformat(start),datetime.fromisoformat(end)
 agg=rows if minutes==1 else core.aggregate(rows,minutes)
 chosen=[r for r in agg if start<=r.timestamp<=end]
 if not chosen or chosen[0].timestamp!=start or chosen[-1].timestamp!=end:raise ValueError('missing window endpoint')
 if len(chosen)<12 or len(chosen)>120:raise ValueError('unreadable candle count')
 if end+timedelta(minutes=minutes)>rows[-1].timestamp+timedelta(minutes=1):raise ValueError('last source bar not closed')
 return chosen

def check_quarantine(rows,minutes,report):
 start,end=rows[0].timestamp,rows[-1].timestamp+timedelta(minutes=minutes)
 for check in report['crossTimeframe']:
  for q in check['quarantinedIntervals']:
   if max(start,datetime.fromisoformat(q['start']))<min(end,datetime.fromisoformat(q['end'])):raise ValueError('selected window intersects vendor aggregation discrepancy')

def render(rows,info,tf,appearance):
 from PIL import Image,ImageDraw,ImageFont
 phone=appearance.startswith('phone');dark='dark' in appearance
 w,h=(960,1400) if phone else (1400,850)
 plot=dict(left=50 if phone else 90,right=w-150,top=210 if phone else 125,bottom=h-300 if phone else 650)
 bg,fg,grid=('#111b2a','#e6edf4','#304153') if dark else ('#f7f8fa','#172e43','#dce3e9')
 im=Image.new('RGB',(w,h),bg);d=ImageDraw.Draw(im);fp='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf';f=lambda n:ImageFont.truetype(fp,n)
 lo,hi=min(x.low for x in rows),max(x.high for x in rows);margin=max(Decimal('.05'),(hi-lo)*Decimal('.08'));pmin,pmax=lo-margin,hi+margin
 x=lambda i:plot['left']+(i+.5)*(plot['right']-plot['left'])/len(rows)
 y=lambda p:plot['bottom']-float((p-pmin)/(pmax-pmin))*(plot['bottom']-plot['top'])
 title=info['instrument']+' | '+tf
 if phone:d.text((50,22),'Historical chart  •  Mobile view',font=f(23),fill=fg)
 d.text((plot['left'],70 if phone else 24),title,font=f(32 if phone else 28),fill=fg)
 d.text((plot['left'],118 if phone else 66),f'{rows[0].timestamp:%d %b %H:%M} — {rows[-1].timestamp:%d %b %H:%M, %Y}',font=f(21 if phone else 18),fill=fg)
 d.text((plot['left'],155 if phone else 94),info['zone']+' | '+('USD quote' if info['instrument']!='BTC crypto' else 'Vendor BTC quote'),font=f(18),fill=fg)
 d.rectangle(tuple(plot[k] for k in ['left','top','right','bottom']),outline=grid)
 ticks=[]
 for i in range(7):
  p=(pmin+(pmax-pmin)*Decimal(i)/6).quantize(Decimal('.0001'));yp=y(p)
  d.line((plot['left'],round(yp),plot['right'],round(yp)),fill=grid)
  d.text((plot['right']+10,round(yp)-11),str(p),font=f(19 if phone else 16),fill=fg);ticks.append(dict(price=str(p),y=yp))
 candles=[];vmax=max(r.volume for r in rows)
 for i,r in enumerate(rows):
  xp=x(i);points={k:dict(x=xp,y=y(getattr(r,k)),price=str(getattr(r,k))) for k in core.PRICE_FIELDS}
  color='#38c6a0' if r.close>=r.open else '#ee6378';half=max(1,min(12,int((plot['right']-plot['left'])/len(rows)*.30)))
  d.line((round(xp),round(points['high']['y']),round(xp),round(points['low']['y'])),fill=color,width=2)
  a,b=sorted([round(points[k]['y']) for k in ('open','close')]);d.rectangle((round(xp)-half,a,round(xp)+half,max(a+1,b)),fill=color)
  vb=h-103 if phone else 750;v=int(r.volume/vmax*(80 if phone else 50));d.rectangle((round(xp)-half,vb-v,round(xp)+half,vb),fill=color)
  candles.append(dict(timestamp=r.timestamp.isoformat(),barIndex=i,points=points))
  if i and (r.timestamp-rows[i-1].timestamp)>timedelta(minutes=int(tf[:-1])*(60 if tf.endswith('h') else 1)):
   d.line((round(xp-(plot['right']-plot['left'])/len(rows)/2),plot['top'],round(xp-(plot['right']-plot['left'])/len(rows)/2),plot['bottom']),fill='#8090a0',width=1)
 for i in sorted(set([0,len(rows)//3,2*len(rows)//3,len(rows)-1])):
  d.text((min(w-230,max(10,int(x(i))-35)),plot['bottom']+16),rows[i].timestamp.strftime('%d %H:%M'),font=f(18 if phone else 16),fill=fg)
 d.text((plot['left'],h-82),'Volume: '+info['units'],font=f(18 if phone else 16),fill=fg)
 d.text((plot['left'],h-53),'Data: FirstRate Data | No missing candles filled',font=f(18 if phone else 16),fill=fg)
 d.text((plot['left'],h-28),'Equal-width observed bars; session gaps marked',font=f(16),fill=fg)
 b=io.BytesIO();im.save(b,format='PNG')
 return b.getvalue(),dict(kind='linear',width=w,height=h,plot=plot,priceMin=str(pmin),priceMax=str(pmax),ticks=ticks,candles=candles,pixelQuantizationBound=.5,cropMapping=dict(kind='identity',originalSize=[w,h],precisionRect=None))

def safe_file(root,path):
 p=(root/path).resolve()
 if not p.is_relative_to(root.resolve()) or not p.is_file():raise ValueError('unsafe/missing packet path')
 return p

def dates_between(start,end):
 a=datetime.fromisoformat(start).astimezone(timezone.utc).date();b=datetime.fromisoformat(end).astimezone(timezone.utc).date()
 return {str(a+timedelta(days=i)) for i in range((b-a).days+1)}

def validate_manifest(m,complete=True):
 cases=m['cases'];ids=[c['caseId'] for c in cases]
 if m['categoryCounts']!=dict(Counter(c['category'] for c in cases)) or m['splitCounts']!=dict(Counter(c['split'] for c in cases)):raise ValueError('summary counts mismatch')
 if len(ids)!=len(set(ids)) or any(not re.fullmatch(r'[a-z0-9-]{1,80}',x) for x in ids):raise ValueError('case identity')
 if complete and (len(cases)!=50 or Counter(c['split'] for c in cases)!={'development':6,'heldout':44} or Counter(c['category'] for c in cases)!=ALLOCATION):raise ValueError('allocation')
 if any(c['split'] not in ['development','heldout'] or c['category'] not in ALLOCATION for c in cases):raise ValueError('invalid split/category')
 dev=[c for c in cases if c['split']=='development']
 if len(dev)!=6 or {c['scenario']:c['timeframe'] for c in dev}!=CANONICAL:raise ValueError('canonical six changed')
 if m.get('heldoutInferencePermitted') is not False or m.get('referenceFreeze') is not None or m.get('protocolFreeze') is not None:raise ValueError('preparation execution/freeze claim')
 if m['acceptedCases']!=0 or m['dispatchAuthorised'] is not False or m['providerCalls']!=0 or m['humanReviewedCases']!=0:raise ValueError('preparation is not acceptance')
 if len({c['rasterSha256'] for c in cases})!=len(cases) or len({c['barsSha256'] for c in cases})!=len(cases):raise ValueError('duplicate underlying chart')
 groups={};dev_dates=set()
 for c in dev:dev_dates|=dates_between(c['firstBar'],c['sourceCutoff'])
 for c in cases:
  if c['groupId'] in groups and groups[c['groupId']]!=c['split']:raise ValueError('group split leakage')
  groups[c['groupId']]=c['split']
  if c['canonicalCaseAccepted'] is not False or c['humanReferenceStatus']!='PENDING_TWO_SEPARATE_QUALIFIED_HUMANS':raise ValueError('per-case acceptance claim')
  if c['legacyHashes'] is not None:
   if c['caseId'] not in LEGACY_PINS or c['legacyHashes']!=LEGACY_PINS[c['caseId']] or any(c[k]!=LEGACY_PINS[c['caseId']][k] for k in ['rasterSha256','inputSha256','barsSha256']):raise ValueError('legacy pin exemption')
  elif c['caseId'] in LEGACY_PINS:raise ValueError('legacy preservation required')
  if c['symbol'] not in SOURCE_INFO or c['sourceFamily']!=SOURCE_INFO[c['symbol']]['family'] or c['instrument']!=SOURCE_INFO[c['symbol']]['instrument'] or c['sourceZipSha256']!=SOURCE_INFO[c['symbol']]['sha256'] or c['sourceUrl']!=SOURCE_INFO[c['symbol']]['url'] or c['rightsStatus']!=RIGHTS:raise ValueError('source metadata pin')
  n=c['timeframeMinutes']
  if n not in [1,5,15,30,60,240] or c['timeframe']!=(f'{n//60}h' if n>=60 else f'{n}m'):raise ValueError('manifest timeframe')
  if c['split']=='heldout' and dev_dates&dates_between(c['firstBar'],c['sourceCutoff']):raise ValueError('development episode leakage')
 for i,a in enumerate(cases):
  for b in cases[i+1:]:
   # SPY and ES count as one underlying family, even within the same split.
   if a['sourceFamily']==b['sourceFamily']:
    ast,ae=datetime.fromisoformat(a['firstBar']),datetime.fromisoformat(a['sourceCutoff'])
    bst,be=datetime.fromisoformat(b['firstBar']),datetime.fromisoformat(b['sourceCutoff'])
    if max(ast,bst)<min(ae,be)+timedelta(minutes=30):raise ValueError('overlap/30-minute embargo '+a['caseId']+' '+b['caseId'])
 return True

def validate_selection(plan):
 if plan.get('schemaVersion')!=2 or not isinstance(plan.get('cases'),list) or len(plan['cases']) not in [6,50]:raise ValueError('selection version/size')
 if plan.get('sourceFiles')!={x:f'FRD-{x}.zip' for x in SOURCE_INFO}:raise ValueError('source filenames must be pinned basenames')
 ids=set()
 for c in plan['cases']:
  cid=c.get('caseId','')
  if not isinstance(cid,str) or not re.fullmatch(r'[a-z0-9-]{1,80}',cid) or cid in ids:raise ValueError('selection identity')
  ids.add(cid)
  if c.get('symbol') not in SOURCE_INFO or c.get('minutes') not in [1,5,15,30,60,240]:raise ValueError('selection instrument/timeframe')
  n=c['minutes'];tf=f'{n//60}h' if n>=60 else f'{n}m'
  if c.get('timeframe')!=tf:raise ValueError('timeframe mismatch')
  if c.get('split') not in ['development','heldout'] or c.get('category') not in ALLOCATION:raise ValueError('selection split/category')
  if not isinstance(c.get('groupId'),str) or not re.fullmatch(r'[a-z0-9-]{1,80}',c['groupId']):raise ValueError('selection group')
  if c.get('appearance','desktop-light') not in ['desktop-light','desktop-dark','phone-light','phone-dark']:raise ValueError('appearance')
  if not isinstance(c.get('reason'),str) or not c['reason'].strip():raise ValueError('selection reason')
  if not re.fullmatch(r'[a-z0-9_-]{1,80}',c.get('proposedLabel','')):raise ValueError('proposal label')
  start,end=datetime.fromisoformat(c['start']),datetime.fromisoformat(c['end'])
  if start.tzinfo is None or end.tzinfo is None or start>=end:raise ValueError('selection timestamps')
  if c.get('split')=='development' and CANONICAL.get(c.get('scenario'))!=tf:raise ValueError('canonical scenario')
  if len(c.get('anchors',[]))>50:raise ValueError('anchor count')
  last=None
  for a in c.get('anchors',[]):
   t=datetime.fromisoformat(a['timestamp'])
   if t.tzinfo is None or not start<=t<=end or a.get('field') not in core.PRICE_FIELDS or (last and t<last):raise ValueError('selection anchors')
   last=t
  if c.get('reuseCaseId') and c['reuseCaseId'] not in ['frd-spy-bear-flag-5m-01','frd-spy-wedge-15m-01','frd-spy-negative-5m-01']:raise ValueError('legacy reuse scope')
 dev=[c for c in plan['cases'] if c['split']=='development']
 if len(dev)!=6 or {c['scenario']:c['timeframe'] for c in dev}!=CANONICAL:raise ValueError('development scenarios')
 if len(plan['cases'])==50 and Counter(c['category'] for c in plan['cases'])!=ALLOCATION:raise ValueError('selection allocation')
 return True

def build(source_root,selection,legacy,output):
 plan=strict_json(selection.read_text());validate_selection(plan)
 if output.exists():raise ValueError('immutable output already exists')
 rights={name:(source_root/'rights'/name).read_bytes() for name in RIGHTS_PINS}
 if any(digest(rights[n])!=h for n,h in RIGHTS_PINS.items()):raise ValueError('rights evidence pin mismatch')
 rights_evidence=[dict(path='rights/'+n,sha256=h) for n,h in sorted(RIGHTS_PINS.items())]
 data={};source_reports=[]
 for symbol,filename in plan['sourceFiles'].items():
  rows,receipt=load_source(symbol,source_root/filename);data[symbol]=rows;source_reports.append(receipt)
 output.mkdir(mode=0o700)
 for folder in ['images','inputs','proposals','data','calibration','sources','rights','reviews/primary','reviews/independent','reviews/private-coordinator']:(output/folder).mkdir(parents=True,mode=0o700)
 for n,b in rights.items():(output/'rights'/n).write_bytes(b)
 for s in source_reports:shutil.copyfile(source_root/plan['sourceFiles'][s['symbol']],output/'sources'/f"{s['symbol']}.zip")
 cases=[]
 legacy_manifest=strict_json((legacy/'SIX-CASE-INTAKE.json').read_text());old={c['caseId']:c for c in legacy_manifest['cases']}
 for c in plan['cases']:
  cid,symbol=c['caseId'],c['symbol'];info=SOURCE_INFO[symbol];rows=window(data[symbol],c['minutes'],c['start'],c['end'])
  check_quarantine(rows,c['minutes'],next(x for x in source_reports if x['symbol']==symbol))
  reuse=c.get('reuseCaseId');oldhashes=None
  if reuse:
   src=old[reuse]
   def oldbytes(k,sha):
    raw=safe_file(legacy,src[k]).read_bytes()
    if digest(raw)!=src[sha]:raise ValueError('immutable legacy mismatch')
    return raw
   png=oldbytes('imagePath','rasterSha256');inp=oldbytes('inputPath','inputSha256');oldlabel=strict_json(oldbytes('labelPath','labelSha256'));oldbars=oldbytes('barsPath','barsSha256')
   if encode([core.serialize_bar(r) for r in rows])!=oldbars:raise ValueError('reused source rows changed')
   cal=oldlabel['calibration'];cal={**cal,'width':src['width'],'height':src['height'],'cropMapping':dict(kind='identity',originalSize=[src['width'],src['height']],precisionRect=None)}
   anchors=oldlabel['anchors'];features=oldlabel['features'];oldhashes={k:v for k,v in src.items() if k.endswith('Sha256')}
  else:
   png,cal=render(rows,info,c['timeframe'],c.get('appearance','desktop-light'))
   inp=encode(dict(image='data:image/png;base64,'+base64.b64encode(png).decode(),intention='UNSURE',chartConfirmation=dict(instrument=info['instrument'],timeframe=c['timeframe'],currentPrice=str(rows[-1].close),contextMatch='NOT_PROVIDED')))
   anchors=[]
   for a in c.get('anchors',[]):
    idx=next((i for i,r in enumerate(rows) if r.timestamp.isoformat()==a['timestamp']),None)
    if idx is None or a['field'] not in core.PRICE_FIELDS:raise ValueError('invalid anchor')
    anchors.append(dict(timestamp=rows[idx].timestamp.isoformat(),field=a['field'],barIndex=idx,**cal['candles'][idx]['points'][a['field']]))
   features=[dict(id=cid+'-proposal',label=c['proposedLabel'],pixels=[{k:a[k] for k in ['x','y']} for a in anchors],prices=[float(a['price']) for a in anchors])] if anchors else []
  proposal=dict(caseId=cid,annotationStatus='AUTOMATED_SELECTION_PROPOSAL_NOT_GROUND_TRUTH',humanReviewer=None,independentReviewer=None,accepted=False,scenario=c['scenario'],proposedLabel=c.get('proposedLabel'),category=c['category'],anchors=anchors,features=features,reason=c['reason'],scope='Visible observations only. Formation state and labels require blinded human adjudication. No scanner answers used.',targetStates={t:'UNREVIEWED' for t in ['pattern_watch','support_resistance','liquidity_pools','liquidity_events']},negativeProtocolStatus='DRAFT_OWNER_AND_INDEPENDENT_REVIEW_PENDING',rasterSha256=digest(png),inputSha256=digest(inp))
  rawbars=encode([core.serialize_bar(r) for r in rows]);calbytes=encode(cal);labbytes=encode(proposal)
  paths=dict(imagePath=f'images/{cid}.png',inputPath=f'inputs/{cid}.json',labelPath=f'proposals/{cid}.json',barsPath=f'data/{cid}.json',calibrationPath=f'calibration/{cid}.json')
  for k,raw in [('imagePath',png),('inputPath',inp),('labelPath',labbytes),('barsPath',rawbars),('calibrationPath',calbytes)]: (output/paths[k]).write_bytes(raw)
  raw_minute=[r for r in data[symbol] if rows[0].timestamp<=r.timestamp<rows[-1].timestamp+timedelta(minutes=c['minutes'])]
  record=dict(caseId=cid,split=c['split'],category=c['category'],groupId=c['groupId'],scenario=c['scenario'],symbol=symbol,instrument=info['instrument'],sourceFamily=info['family'],timeframe=c['timeframe'],timeframeMinutes=c['minutes'],sourceZipSha256=info['sha256'],sourceUrl=info['url'],sourcePath=f'sources/{symbol}.zip',sourceMinuteWindowSha256=digest(encode([core.serialize_bar(r) for r in raw_minute])),firstBar=rows[0].timestamp.isoformat(),lastBar=rows[-1].timestamp.isoformat(),sourceCutoff=(rows[-1].timestamp+timedelta(minutes=c['minutes'])).isoformat(),bars=len(rows),observedMinuteRows=sum(r.source_count for r in rows),missingMinuteSlots=sum(c['minutes']-r.source_count for r in rows),sessionGaps=[dict(after=a.timestamp.isoformat(),before=b.timestamp.isoformat()) for a,b in zip(rows,rows[1:]) if b.timestamp-a.timestamp>timedelta(minutes=c['minutes'])],**paths,rasterSha256=digest(png),inputSha256=digest(inp),labelSha256=digest(labbytes),barsSha256=digest(rawbars),calibrationSha256=digest(calbytes),width=cal['width'],height=cal['height'],appearance=c.get('appearance','reused-desktop-light'),cropMapping=cal['cropMapping'],rightsStatus=RIGHTS,rightsEvidenceSha256=digest(encode(rights_evidence)),licenceSha256=RIGHTS_PINS['frd-license.html'],licencePath='rights/frd-license.html',humanReferenceStatus='PENDING_TWO_SEPARATE_QUALIFIED_HUMANS',canonicalCaseAccepted=False,legacyHashes=oldhashes,replacesLegacyCaseId=c.get('replacesLegacyCaseId'))
  cases.append(record)
 manifest=dict(schemaVersion=2,status='PREPARED_CANDIDATES_NOT_ACCEPTED',candidateScannerRouteSha256='5a59b0cde257ad8ab885af9c9171198fe9732ad3a286efda301c6226903b7294',baseCheckpoint='856763146d293d91d22c2ce0e7700c9e73731187',sourceReports=source_reports,rightsEvidence=rights_evidence,cases=cases,acceptedCases=0,humanReviewedCases=0,providerCalls=0,dispatchAuthorised=False,categoryCounts=dict(Counter(c['category'] for c in cases)),splitCounts=dict(Counter(c['split'] for c in cases)),referenceFreeze=None,protocolFreeze=None,heldoutInferencePermitted=False,sourceSelectionSha256=digest(selection.read_bytes()))
 validate_manifest(manifest,complete=len(cases)==50)
 (output/'BENCHMARK50.json').write_bytes(encode(manifest));(output/'SELECTION.private.json').write_bytes(selection.read_bytes())
 if len(cases)>=6:
  (output/'SIX-CASE-REPLACEMENTS-v2.json').write_bytes(encode({**manifest,'cases':[c for c in cases if c['split']=='development'],'status':'VERSIONED_SIX_REPLACEMENT_CANDIDATES_NOT_ACCEPTED','categoryCounts':dict(Counter(c['category'] for c in cases if c['split']=='development')),'splitCounts':{'development':6}}))
 # Generic aliases in independent deterministic orders. Reviewer receives only their
 # assigned directory, never proposals/selection or the coordinator map.
 aliases={};review_order={}
 for role in ['primary','independent']:
  ordered=sorted(cases,key=lambda c:digest((role+c['rasterSha256']).encode()))
  worksheets=[]
  for n,c in enumerate(ordered,1):
   alias=f'review-{n:03d}';aliases[role+':'+alias]=c['caseId'];shutil.copyfile(output/c['imagePath'],output/'reviews'/role/(alias+'.png'))
   worksheets.append(dict(reviewId=alias,image=alias+'.png',imageSha256=c['rasterSha256'],instrument=c['instrument'],timeframe=c['timeframe'],readable=None,reviewerName=None,qualifications=None,reviewedAt=None,independenceAttestation=None,tools={t:dict(state=None,features=[],uncertainty=None) for t in ['pattern_watch','support_resistance','liquidity_pools','liquidity_events']},notes=None))
  (output/'reviews'/role/'WORKSHEETS.json').write_bytes(encode(worksheets));review_order[role]=[x['reviewId'] for x in worksheets if aliases[role+':'+x['reviewId']] in {c['caseId'] for c in cases if c['split']=='development'}]
 (output/'reviews/private-coordinator/MAP.json').write_bytes(encode(dict(aliases=aliases,firstSixPriority=review_order)))
 (output/'reviews/REVIEWER-INSTRUCTIONS.txt').write_text('Qualified human review required. Primary and independent reviewers work separately before adjudication. Receive only your role directory and this instruction. First-six priorities are supplied by coordinator without proposed labels. Judge only visible candles; mark each tool PRESENT, ABSENT, UNREADABLE or UNCERTAIN; never infer no support/resistance from no pattern. Record exact anchors and prices, qualification, identity, independence and uncertainty. Candle-derived liquidity is a price-based hypothesis, not verified resting orders. Do not consult scanner answers or future prices. No fields are preaccepted.\n')
 return manifest

def verify(root,complete=True):
 m=strict_json((root/'BENCHMARK50.json').read_text());validate_manifest(m,complete)
 subset=strict_json((root/'SIX-CASE-REPLACEMENTS-v2.json').read_text());validate_manifest(subset,False)
 if subset['cases']!=[c for c in m['cases'] if c['split']=='development']:raise ValueError('six subset mismatch')
 rights_evidence=[dict(path='rights/'+n,sha256=h) for n,h in sorted(RIGHTS_PINS.items())]
 if m.get('rightsEvidence')!=rights_evidence:raise ValueError('rights manifest mismatch')
 for e in rights_evidence:
  if digest(safe_file(root,e['path']).read_bytes())!=e['sha256']:raise ValueError('rights artifact mismatch')
 cached={};checks=[]
 for c in m['cases']:
  if c.get('rightsEvidenceSha256')!=digest(encode(rights_evidence)) or c.get('licenceSha256')!=RIGHTS_PINS['frd-license.html'] or c.get('licencePath')!='rights/frd-license.html':raise ValueError('per-case rights binding')
  artifacts={}
  for key,sha in [('imagePath','rasterSha256'),('inputPath','inputSha256'),('labelPath','labelSha256'),('barsPath','barsSha256'),('calibrationPath','calibrationSha256')]:
   raw=safe_file(root,c[key]).read_bytes()
   if digest(raw)!=c[sha]:raise ValueError('artifact hash mismatch '+c['caseId']+' '+key)
   artifacts[key]=raw
  symbol=c['symbol']
  if c['sourcePath']!=f'sources/{symbol}.zip':raise ValueError('source path metadata')
  if symbol not in cached:
   cached[symbol]=load_source(symbol,safe_file(root,c['sourcePath']))
   matching=[x for x in m['sourceReports'] if x['symbol']==symbol]
   if matching!=[cached[symbol][1]]:raise ValueError('recorded source report mismatch')
  rows=window(cached[symbol][0],c['timeframeMinutes'],c['firstBar'],c['lastBar'])
  check_quarantine(rows,c['timeframeMinutes'],cached[symbol][1])
  if c['bars']!=len(rows) or c['observedMinuteRows']!=sum(r.source_count for r in rows) or c['missingMinuteSlots']!=sum(c['timeframeMinutes']-r.source_count for r in rows):raise ValueError('source coverage mismatch')
  if encode([core.serialize_bar(r) for r in rows])!=artifacts['barsPath']:raise ValueError('source-to-bars mismatch')
  cutoff=rows[-1].timestamp+timedelta(minutes=c['timeframeMinutes'])
  if c['sourceCutoff']!=cutoff.isoformat():raise ValueError('future cutoff mismatch')
  minute=[r for r in cached[symbol][0] if rows[0].timestamp<=r.timestamp<cutoff]
  if digest(encode([core.serialize_bar(r) for r in minute]))!=c['sourceMinuteWindowSha256']:raise ValueError('source window mismatch')
  inp=strict_json(artifacts['inputPath']);cal=strict_json(artifacts['calibrationPath']);label=strict_json(artifacts['labelPath'])
  if set(inp.get('chartConfirmation',{}))!=set(['instrument','timeframe','currentPrice','contextMatch']):raise ValueError('nested answer/context leakage')
  expected_instrument='SPY ETF (FirstRate Data)' if c['legacyHashes'] is not None else c['instrument']
  if inp['chartConfirmation']['instrument']!=expected_instrument:raise ValueError('input instrument mismatch')
  if not inp['image'].startswith('data:image/png;base64,'):raise ValueError('input MIME')
  if set(inp)!=set(['image','intention','chartConfirmation']) or inp['intention']!='UNSURE' or inp['chartConfirmation']['contextMatch']!='NOT_PROVIDED':raise ValueError('input annotation/context leakage')
  if Decimal(inp['chartConfirmation']['currentPrice'])!=rows[-1].close or inp['chartConfirmation']['timeframe']!=c['timeframe']:raise ValueError('input price/timeframe mismatch')
  if base64.b64decode(inp['image'].split(',')[1],validate=True)!=artifacts['imagePath']:raise ValueError('input raster mismatch')
  if c['legacyHashes'] is None:
   regenerated,recal=render(rows,SOURCE_INFO[symbol],c['timeframe'],c['appearance'])
   if regenerated!=artifacts['imagePath'] or encode(recal)!=artifacts['calibrationPath']:raise ValueError('source raster/calibration reproduction mismatch')
  from PIL import Image
  im=Image.open(io.BytesIO(artifacts['imagePath']));im.load();rgbim=im.convert('RGB')
  if im.format!='PNG' or list(im.size)!=[c['width'],c['height']] or list(im.size)!=[cal['width'],cal['height']]:raise ValueError('raster dimensions')
  if c['cropMapping']!=dict(kind='identity',originalSize=list(im.size),precisionRect=None) or cal['cropMapping']!=c['cropMapping']:raise ValueError('crop mapping mismatch')
  if cal['kind']!='linear' or len(cal['ticks'])!=7:raise ValueError('calibration type/ticks')
  if len(cal['candles'])!=len(rows):raise ValueError('candle geometry length')
  pmin,pmax=Decimal(cal['priceMin']),Decimal(cal['priceMax']);p=cal['plot']
  if not pmin.is_finite() or not pmax.is_finite() or pmax<=pmin:raise ValueError('calibration range')
  for tick in cal['ticks']:
   price=Decimal(tick['price']);y=tick['y']
   if not price.is_finite() or not math.isfinite(y) or abs(y-(p['bottom']-float((price-pmin)/(pmax-pmin))*(p['bottom']-p['top'])))>1e-7:raise ValueError('tick calibration')
  for i,(r,g) in enumerate(zip(rows,cal['candles'])):
   if set(g['points'])!=set(core.PRICE_FIELDS):raise ValueError('missing OHLC geometry')
   if g['timestamp']!=r.timestamp.isoformat() or g['barIndex']!=i:raise ValueError('geometry index')
   for field,point in g['points'].items():
    if field not in core.PRICE_FIELDS or Decimal(point['price'])!=getattr(r,field):raise ValueError('geometry source price')
    xx=p['left']+(i+.5)*(p['right']-p['left'])/len(rows);yy=p['bottom']-float((getattr(r,field)-pmin)/(pmax-pmin))*(p['bottom']-p['top'])
    if abs(point['x']-xx)>1e-7 or abs(point['y']-yy)>1e-7:raise ValueError('price/pixel calibration')
    if not p['top']<=yy<=p['bottom']:raise ValueError('clipped source candle')
    # Source price extremum must have a candle-coloured pixel within raster quantization.
    if field in ['high','low']:
     colors=[rgbim.getpixel((round(xx)+dx,round(yy)+dy)) for dx in [-1,0,1] for dy in [-1,0,1]]
     if not any(max(rgb)-min(rgb)>55 for rgb in colors):raise ValueError('raster wick absent')
  for a in label['anchors']:
   i=a['barIndex'];g=cal['candles'][i]['points'][a['field']]
   if any(a[k]!=g[k] for k in ['x','y','price']) or a['timestamp']!=rows[i].timestamp.isoformat():raise ValueError('proposal anchor mismatch')
  if label['accepted'] is not False or label['humanReviewer'] is not None or label['independentReviewer'] is not None:raise ValueError('automated human claim')
  checks.append(dict(caseId=c['caseId'],status='OFFLINE_SOURCE_GEOMETRY_INPUT_PASS_NOT_ACCEPTANCE',rasterSha256=c['rasterSha256'],bars=len(rows)))
 for role in ['primary','independent']:
  sheets=strict_json((root/'reviews'/role/'WORKSHEETS.json').read_text())
  if len(sheets)!=len(m['cases']) or len({x['reviewId'] for x in sheets})!=len(sheets):raise ValueError('review worksheet coverage')
  if {x['imageSha256'] for x in sheets}!={c['rasterSha256'] for c in m['cases']}:raise ValueError('blind image coverage')
  for sheet in sheets:
   if set(sheet)!=set(['reviewId','image','imageSha256','instrument','timeframe','readable','reviewerName','qualifications','reviewedAt','independenceAttestation','tools','notes']):raise ValueError('blind answer fields')
   if any(sheet[x] is not None for x in ['readable','reviewerName','qualifications','reviewedAt','independenceAttestation','notes']):raise ValueError('prefilled human review')
   if sheet['tools']!={t:dict(state=None,features=[],uncertainty=None) for t in ['pattern_watch','support_resistance','liquidity_pools','liquidity_events']}:raise ValueError('prefilled target answers')
   sourcecase=next(c for c in m['cases'] if c['rasterSha256']==sheet['imageSha256'])
   if sheet['instrument']!=sourcecase['instrument'] or sheet['timeframe']!=sourcecase['timeframe']:raise ValueError('blind source facts mismatch')
   if digest(safe_file(root,'reviews/'+role+'/'+sheet['image']).read_bytes())!=sheet['imageSha256']:raise ValueError('blind image hash')
 return dict(status='OFFLINE_PASS_NOT_ACCEPTANCE',manifestSha256=digest((root/'BENCHMARK50.json').read_bytes()),casesChecked=len(checks),checks=checks,sourceZipPins=len(cached),crossTimeframeComparisons=len(cached)*3,providerCalls=0,humanReviews=0,semanticAccepted=0)

if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('command',choices=['build','verify']);p.add_argument('--source-root',type=Path);p.add_argument('--selection',type=Path);p.add_argument('--legacy',type=Path);p.add_argument('--packet',type=Path,required=True);p.add_argument('--six-only',action='store_true');a=p.parse_args()
 if a.command=='build':
  m=build(a.source_root,a.selection,a.legacy,a.packet);print(json.dumps(dict(prepared=len(m['cases']),split=m['splitCounts'],categories=m['categoryCounts'],accepted=0,providerCalls=0)))
 else:
  r=verify(a.packet,not a.six_only);(a.packet/'OFFLINE-VALIDATION.json').write_bytes(encode(r));print(json.dumps({k:v for k,v in r.items() if k!='checks'}))
