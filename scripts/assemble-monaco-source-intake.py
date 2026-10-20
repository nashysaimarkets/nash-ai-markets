#!/usr/bin/env python3
"""Bind three preserved originals and three new candidates; no approval/dispatch."""
import argparse
import base64
import hashlib
import io
import json
from pathlib import Path
from PIL import Image

ORIGINALS=('range-clear-01','double-top-01','head-shoulders-01')
PINS={
 'range-clear-01':('eab89b05051a24f9f4721d25634223ab2f1dd2b9fba6c1c1764d707d1ced2beb','55f965d8b8f38f10cf5fd336601c1a3ab3f7750cc2fbe0d3f4b7f18ae93c2bf9'),
 'double-top-01':('1981b9c89e5e11d4e8011f9149457360d7e27137c5c7ab666384e7485ae37871','2ac8933cc0592bcc7243e7c98a3ecea731045c10ca0ed2bbe2f9427e3289d7ea'),
 'head-shoulders-01':('4d29ac52ab63330f4caff56150dcd76ab55b46f626f5e2a183201ca8ecdc03ce','8003d0ba17370d732fe9b94bd903631b6bbe553650991bd8973722c2b6632ffc')}
def digest(b):return hashlib.sha256(b).hexdigest()
def encode(v):return (json.dumps(v,indent=2,allow_nan=False)+'\n').encode()
def assemble(original_inputs,original_labels,output):
    if (output/'SIX-CASE-INTAKE.json').exists():raise ValueError('never replace an assembled packet')
    new=json.loads((output/'SOURCE-VALIDATION.json').read_text())
    if new['status']!='SOURCE_INTEGRITY_PASS_NOT_ACCEPTANCE' or len(new['cases'])!=3:raise ValueError('prepared three-case source receipt required')
    (output/'legacy-inputs').mkdir(mode=0o700)
    items=[];repairs=[]
    for cid in ORIGINALS:
        raw=(original_inputs/(cid+'.scan-input.json')).read_bytes();inp=json.loads(raw);image=base64.b64decode(inp['image'].split(',')[1],validate=True)
        if (digest(image),digest(raw))!=PINS[cid]:raise ValueError('immutable original pin mismatch')
        label_bytes=(original_labels/('original-'+cid+'.json')).read_bytes();label=json.loads(label_bytes)
        if label['id']!=cid or label['scoring_ready'] is not False:raise ValueError('unexpected reference identity/status')
        source=Image.open(io.BytesIO(image));source.load()
        if source.size!=(1400,850) or source.format!='PNG':raise ValueError('original raster identity')
        exact=source.convert('RGB').crop((0,51,1400,748));old=Image.open(io.BytesIO(base64.b64decode(inp['precisionImage'].split(',')[1],validate=True))).convert('RGB')
        if old.size!=exact.size:raise ValueError('legacy precision dimensions')
        differences=[abs(a-b) for a,b in zip(old.tobytes(),exact.tobytes())]
        encoded=io.BytesIO();exact.save(encoded,format='PNG');inp['precisionImage']='data:image/png;base64,'+base64.b64encode(encoded.getvalue()).decode()
        fixed=encode(inp)
        paths=dict(imagePath='images/'+cid+'.png',inputPath='inputs/'+cid+'.lossless.scan-input.json',labelPath='labels/'+cid+'.recovered.json',legacyInputPath='legacy-inputs/'+cid+'.scan-input.json')
        for k,b in [('imagePath',image),('inputPath',fixed),('labelPath',label_bytes),('legacyInputPath',raw)]:
            with (output/paths[k]).open('xb') as f:f.write(b)
        items.append(dict(caseId=cid,scenario=label['scenario'],timeframe=label['timeframe'],instrument=inp['chartConfirmation']['instrument'],**paths,rasterSha256=digest(image),inputSha256=digest(fixed),legacyInputSha256=digest(raw),labelSha256=digest(label_bytes),width=1400,height=850,firstBar=label['start'],lastBar=label['last_bar_open'],sourceUrl=label['source_url'],originalUnchanged=True,legacyInputUnchanged=True,inputTransport='LOSSLESS_PRECISION_DERIVATIVE_REQUIRES_NEW_SCOPE_REVIEW',precisionRect=dict(left=0,top=51,width=1400,height=697),sourceRightsStatus='UNVERIFIED_DATA_SCOPE_AND_PROCESSOR_RIGHTS',independentReviewStatus='PENDING_HUMAN',canonicalCaseAccepted=False))
        repairs.append(dict(caseId=cid,legacyInputSha256=digest(raw),proposedInputSha256=digest(fixed),originalRasterUnchanged=True,beforeMeanAbsoluteRgbError=sum(differences)/len(differences),beforeMaximumRgbError=max(differences),afterMeanAbsoluteRgbError=0,afterMaximumRgbError=0,existingThresholdsUnchanged=dict(mean=3,maximum=40)))
    packet=dict(schemaVersion=1,status='SIX_CANDIDATE_SLOTS_ASSEMBLED_NOT_ACCEPTED',baseCheckpoint='8aa7b8e02ce78629aebb8036fe6ca1ad9f69689a',cases=items+new['cases'],genuineMeasurements=0,acceptedCases=0,dispatchAuthorised=False,independentReferenceAcceptance=False,independentRecords='reviews/independent-records.json')
    (output/'SIX-CASE-INTAKE.json').write_bytes(encode(packet));(output/'PRECISION-REPAIR.json').write_bytes(encode(repairs))
    return packet
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--original-inputs',type=Path,required=True);p.add_argument('--original-labels',type=Path,required=True);p.add_argument('--packet',type=Path,required=True);a=p.parse_args()
    r=assemble(a.original_inputs,a.original_labels,a.packet);print(json.dumps(dict(status=r['status'],cases=len(r['cases']),dispatchAuthorised=False)))
