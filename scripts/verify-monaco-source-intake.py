#!/usr/bin/env python3
"""Offline hash/raster/calibration audit of candidate intake, never approval."""
import argparse
import base64
import hashlib
import io
import json
import math
from decimal import Decimal
from pathlib import Path
from PIL import Image

EXPECTED={'range-clear':'30m','double-top':'1h','head-shoulders':'4h','bear-flag':'5m','wedge':'15m','negative-no-signal':None}
ORIGINAL_PINS={
 'range-clear':('range-clear-01','eab89b05051a24f9f4721d25634223ab2f1dd2b9fba6c1c1764d707d1ced2beb','55f965d8b8f38f10cf5fd336601c1a3ab3f7750cc2fbe0d3f4b7f18ae93c2bf9'),
 'double-top':('double-top-01','1981b9c89e5e11d4e8011f9149457360d7e27137c5c7ab666384e7485ae37871','2ac8933cc0592bcc7243e7c98a3ecea731045c10ca0ed2bbe2f9427e3289d7ea'),
 'head-shoulders':('head-shoulders-01','4d29ac52ab63330f4caff56150dcd76ab55b46f626f5e2a183201ca8ecdc03ce','8003d0ba17370d732fe9b94bd903631b6bbe553650991bd8973722c2b6632ffc')}
PRECISION_RECT=dict(left=0,top=51,width=1400,height=697)
def finite_json(raw):
    def reject(value):raise ValueError('nonfinite JSON number')
    value=json.loads(raw,parse_constant=reject)
    def visit(v):
        if isinstance(v,float) and not math.isfinite(v):reject(v)
        if isinstance(v,dict):
            for child in v.values():visit(child)
        if isinstance(v,list):
            for child in v:visit(child)
    visit(value);return value
def finite_number(value):
    result=float(value)
    if not math.isfinite(result):raise ValueError('nonfinite numeric coordinate or price')
    return result
def check(root):
    root=root.resolve();packet=finite_json((root/'SIX-CASE-INTAKE.json').read_text())
    if packet.get('dispatchAuthorised') is not False or packet.get('genuineMeasurements')!=0 or packet.get('acceptedCases')!=0:
        raise ValueError('candidate packet may not claim acceptance or dispatch')
    cases=packet.get('cases',[])
    if len(cases)!=6 or {c['scenario'] for c in cases}!=set(EXPECTED):raise ValueError('six distinct canonical slots required')
    if len({c['caseId'] for c in cases})!=6 or len({c['rasterSha256'] for c in cases})!=6:raise ValueError('duplicate identity')
    def load(rel,sha):
        if not isinstance(rel,str) or Path(rel).is_absolute():raise ValueError('relative artifact path required')
        path=(root/rel).resolve()
        if not path.is_relative_to(root):raise ValueError('artifact escapes packet')
        if path.stat().st_size>40_000_000:raise ValueError('oversized artifact')
        b=path.read_bytes()
        if hashlib.sha256(b).hexdigest()!=sha:raise ValueError('artifact hash mismatch')
        return b
    reports=[]
    for c in cases:
        if EXPECTED[c['scenario']] not in (None,c['timeframe']):raise ValueError('canonical timeframe mismatch')
        if c.get('canonicalCaseAccepted') is not False or c.get('independentReviewStatus')!='PENDING_HUMAN':raise ValueError('unreviewed candidate cannot claim acceptance')
        image=load(c['imagePath'],c['rasterSha256']);payload=load(c['inputPath'],c['inputSha256']);labels=load(c['labelPath'],c['labelSha256'])
        im=Image.open(io.BytesIO(image));im.load()
        if im.format not in ('PNG','JPEG') or im.size!=(c['width'],c['height']):raise ValueError('raster dimensions')
        inp=finite_json(payload)
        if set(inp) not in ({'image','intention','chartConfirmation'},{'image','precisionImage','intention','chartConfirmation'}):raise ValueError('label/extra content may not enter scanner input')
        facts=inp['chartConfirmation']
        if set(facts)!={'instrument','timeframe','currentPrice','contextMatch'} or facts['instrument']!=c['instrument'] or facts['timeframe']!=c['timeframe'] or facts['contextMatch']!='NOT_PROVIDED' or inp['intention']!='UNSURE':raise ValueError('chart identity mismatch')
        if base64.b64decode(inp['image'].split(',')[1],validate=True)!=image:raise ValueError('embedded original mismatch')
        if c['scenario'] in ORIGINAL_PINS:
            if (c['caseId'],c['rasterSha256'],c.get('legacyInputSha256'))!=ORIGINAL_PINS[c['scenario']]:raise ValueError('immutable original pins changed')
            legacy=finite_json(load(c['legacyInputPath'],c['legacyInputSha256']))
            if {k:v for k,v in legacy.items() if k!='precisionImage'}!={k:v for k,v in inp.items() if k!='precisionImage'}:raise ValueError('original input changed outside precision image')
            if 'precisionImage' not in inp:raise ValueError('original precision image required')
        if 'precisionImage' in inp:
            if c.get('precisionRect')!=PRECISION_RECT:raise ValueError('precision crop metadata mismatch')
            crop=Image.open(io.BytesIO(base64.b64decode(inp['precisionImage'].split(',')[1],validate=True))).convert('RGB');source=im.convert('RGB').crop((0,51,1400,748))
            if crop.size!=source.size:raise ValueError('recovered precision dimensions')
            diff=[abs(a-b) for a,b in zip(crop.tobytes(),source.tobytes())]
            if sum(diff)/len(diff)>3 or max(diff)>40:raise ValueError('recovered crop pixels')
        elif c.get('precisionRect') is not None:raise ValueError('crop metadata without precision image')
        label=finite_json(labels)
        if 'calibration' in label:
            cal=label['calibration'];p=cal['plot'];lo=finite_number(cal['priceMin']);hi=finite_number(cal['priceMax']);ticks=cal['ticks']
            anchors=label['anchors'];stored_bars=finite_json(load(c['barsPath'],c['barsSha256']))
            if label['inputSha256']!=c['inputSha256'] or label['rasterSha256']!=c['rasterSha256']:raise ValueError('label scope')
            if label['scenario']!=c['scenario'] or label['timeframe']!=c['timeframe'] or label['instrument']!=c['instrument']:raise ValueError('label identity')
            if len(stored_bars)!=len(cal['candles']):raise ValueError('bar/calibration count')
            if Decimal(facts['currentPrice'])!=Decimal(stored_bars[-1]['close']):raise ValueError('current price does not match last source close')
            if hi<=lo:raise ValueError('invalid price scale')
            price_y=lambda price:p['bottom']-(finite_number(price)-lo)/(hi-lo)*(p['bottom']-p['top'])
            for i,(bar,candle) in enumerate(zip(stored_bars,cal['candles'])):
                if bar['timestamp']!=candle['timestamp'] or candle['barIndex']!=i:raise ValueError('candle identity')
                for field in ['open','high','low','close']:
                    point=candle['points'][field]
                    if point['price']!=bar[field] or abs(point['y']-price_y(bar[field]))>1e-7:raise ValueError('candle price calibration')
                    expected_x=p['left']+(i+.5)*(p['right']-p['left'])/len(stored_bars)
                    if abs(point['x']-expected_x)>1e-7:raise ValueError('candle x calibration')
            for anchor in anchors:
                point=cal['candles'][anchor['barIndex']]['points'][anchor['field']]
                if any(anchor[k]!=point[k] for k in ('x','y','price')):raise ValueError('anchor changed')
        else:
            if not math.isfinite(float(facts['currentPrice'])) or abs(float(facts['currentPrice'])-label['last_close'])>1e-8:raise ValueError('original current price mismatch')
            p=label['price_scale']['plot_pixels'];lo=label['price_scale']['min'];hi=label['price_scale']['max'];ticks=[{'price':t['price'],'y':t['y_px']} for t in label['axis_ticks']]
            if hi<=lo:raise ValueError('invalid price scale')
            price_y=lambda price:p['bottom']-(finite_number(price)-lo)/(hi-lo)*(p['bottom']-p['top'])
            anchors=[v for feature in label['expected']['patterns'] for v in feature['geometry']]
            for a in anchors:
                if abs(a['y_px']-price_y(a['price']))>.002:raise ValueError('original reference price calibration')
        if not math.isfinite(hi-lo) or hi<=lo:raise ValueError('invalid price scale')
        for tick in ticks:
            if abs(tick['y']-price_y(tick['price']))>.002:raise ValueError('tick price calibration')
        reports.append(dict(caseId=c['caseId'],hashes=True,raster=True,embeddedInput=True,calibration=True,anchorCount=len(anchors),rightsAccepted=False,referenceAccepted=False))
    return dict(status='OFFLINE_INTEGRITY_PASS_NOT_ACCEPTANCE',cases=reports,dispatchAuthorised=False,genuineMeasurements=0,independentHumanReviews=0)

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--packet',type=Path,required=True);a=p.parse_args();print(json.dumps(check(a.packet),indent=2))
