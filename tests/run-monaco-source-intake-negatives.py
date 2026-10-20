#!/usr/bin/env python3
"""Exercise tamper guards on a private real packet; no provider or CI credential."""
import argparse
import copy
import hashlib
import importlib.util
import json
from pathlib import Path
import shutil
import tempfile

p=argparse.ArgumentParser();p.add_argument('--packet',type=Path,required=True);args=p.parse_args()
spec=importlib.util.spec_from_file_location('intake',Path(__file__).resolve().parents[1]/'scripts/verify-monaco-source-intake.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
assert m.check(args.packet)['status']=='OFFLINE_INTEGRITY_PASS_NOT_ACCEPTANCE'
out=[]
for name in ['tampered-image','wrong-timeframe','duplicate-id','false-acceptance','label-leak','wrong-current-price','wrong-calibration','path-escape','missing-artifact','nonfinite-tick','legacy-input-tamper','crop-metadata-tamper']:
    with tempfile.TemporaryDirectory() as tmp:
        root=Path(tmp)/'packet';shutil.copytree(args.packet,root);mp=root/'SIX-CASE-INTAKE.json';manifest=json.loads(mp.read_text());c=manifest['cases'][3]
        def update(path_key,sha_key,change):
            f=root/c[path_key];data=json.loads(f.read_text());change(data);b=(json.dumps(data,indent=2)+'\n').encode();f.write_bytes(b);c[sha_key]=hashlib.sha256(b).hexdigest()
        if name=='tampered-image':(root/c['imagePath']).write_bytes(b'bad')
        if name=='wrong-timeframe':c['timeframe']='30m'
        if name=='duplicate-id':c['caseId']=manifest['cases'][0]['caseId']
        if name=='false-acceptance':c['canonicalCaseAccepted']=True
        if name=='label-leak':update('inputPath','inputSha256',lambda x:x.update(expected='bear flag'))
        if name=='wrong-current-price':
            update('inputPath','inputSha256',lambda x:x['chartConfirmation'].update(currentPrice='1'))
            update('labelPath','labelSha256',lambda x:x.update(inputSha256=c['inputSha256']))
        if name=='wrong-calibration':update('labelPath','labelSha256',lambda x:x['calibration']['ticks'][0].update(y=0))
        if name=='path-escape':c['imagePath']='../../outside.png'
        if name=='missing-artifact':(root/c['imagePath']).unlink()
        if name=='nonfinite-tick':update('labelPath','labelSha256',lambda x:x['calibration']['ticks'][0].update(y=float('nan')))
        if name=='legacy-input-tamper':(root/manifest['cases'][0]['legacyInputPath']).write_bytes(b'changed')
        if name=='crop-metadata-tamper':manifest['cases'][0]['precisionRect']['top']=52
        mp.write_text(json.dumps(manifest))
        try:m.check(root)
        except (ValueError,FileNotFoundError) as e:out.append(dict(case=name,status='PASS_REJECTED',reason=str(e)))
        else:raise AssertionError('Unsafe mutation passed: '+name)
print(json.dumps(dict(status='PASS',cases=out,tests=len(out),skipped=0,providerCalls=0),indent=2))
