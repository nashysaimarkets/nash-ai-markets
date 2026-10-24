import json,hashlib,gzip,base64,re,math
from pathlib import Path
p=Path(__file__).parent
bb=Path('/workspace/scratch/616faf3e8649/private-six/inputs/first-six-input.bundle.gz').read_bytes()
assert hashlib.sha256(bb).hexdigest()=='8b7b3bb3cb0d7122cb6cad0b5936e12c5d5d3f83e725d5fd42c81e5ae1d4e2f0'
b=json.loads(gzip.decompress(bb));browser=json.loads((p/'BROWSER.json').read_text());rows=[]
for result in browser['results']:
 e=next(x for x in b['entries'] if x['path']=='packet/calibration/'+result['case']+'.json');raw=base64.b64decode(e['data']);assert hashlib.sha256(raw).hexdigest()==e['sha256'];c=json.loads(raw)
 prices=re.findall(r'([\d.]+) · POSITION CHECKED',result['status']);assert len(prices)==len(result['lines'])
 for price,line in zip(prices,result['lines']):
  exact=[t['y'] for t in c['ticks'] if float(t['price'])==float(price)]
  expected=exact[0] if exact else c['plot']['top']+(float(c['priceMax'])-float(price))/(float(c['priceMax'])-float(c['priceMin']))*(c['plot']['bottom']-c['plot']['top'])
  err=max(abs(line['y1']-expected),abs(line['y2']-expected))
  rows.append({'case':result['case'],'price':price,'expectedOriginalY':expected,'actualOriginalCoordinates':line,'maximumPriceRowErrorPixels':err,'status':'PASS' if err<=1 else 'FAIL','calibrationSha256':e['sha256']})
r={'status':'PASS' if all(x['status']=='PASS' for x in rows) else 'FAIL','tolerancePixels':1,'checkedPriceRows':rows,'maximumErrorPixels':max(x['maximumPriceRowErrorPixels'] for x in rows),'limitations':'Axis position only. Horizontal extent does not establish candle attribution. No trading or support/resistance semantic score. d005 remains HOLD.'}
(p/'COORDINATES.json').write_text(json.dumps(r,indent=2)+'\n');print(json.dumps({'status':r['status'],'rows':len(rows),'max':r['maximumErrorPixels']}))
