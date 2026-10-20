import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { MONACO_REQUIRED_SCENARIOS } from '../scripts/pocket-monaco-corpus-coverage.ts';
import { evidenceHash, validateMonacoEvidencePack, scoreMonacoObservation, summarizeMonacoMeasurements } from '../scripts/pocket-monaco-measurement.ts';
import type { CorpusCase, EvidenceReview, Feature, RecordedObservation } from '../scripts/pocket-monaco-measurement.ts';
const feature=(id='level1',x=10,price=100):Feature=>({id,label:'support',pixels:[{x,y:20}],prices:[price]});
async function pack(){
 const files=new Map<string,Uint8Array>(); const put=(v:string|Buffer)=>{const b=Buffer.isBuffer(v)?v:Buffer.from(v);const h=evidenceHash(b);files.set(h,b);return h;};
 const cases:CorpusCase[]=[],reviews:EvidenceReview[]=[];
 for(let i=0;i<6;i++){
  const s=MONACO_REQUIRED_SCENARIOS[i],image=await sharp({create:{width:64,height:48,channels:3,background:{r:20+i*30,g:40,b:80}}}).png().toBuffer();
  const rasterSha256=put(image),timeframe=s.timeframe??'5m',caseId=s.key,features=i===5?[]:[feature()],negative=i===5;
  const inputSha256=put(JSON.stringify({image:'data:image/png;base64,'+image.toString('base64'),chartConfirmation:{instrument:'SYNTHETIC',timeframe}}));
  const labelSha256=put(JSON.stringify({caseId,rasterSha256,scenario:s.scenario,timeframe,negative,features}));
  const licenceSha256=put('SYNTHETIC NOT A LICENCE '+i),reviewSha256=put('SYNTHETIC NOT AN ANNOTATION '+i);
  cases.push({caseId,scenario:s.scenario,timeframe,instrument:'SYNTHETIC',rasterSha256,inputSha256,labelSha256,licenceSha256,reviewSha256,width:64,height:48,primaryAnnotator:'first',independentAnnotator:'second',negative,features});
  for(const [kind,documentSha256]of[['LICENCE',licenceSha256],['ANNOTATION',reviewSha256]] as const)reviews.push({documentSha256,kind,reviewer:kind==='ANNOTATION'?'second':'licensor-reviewer',rasterSha256,inputSha256,labelSha256,validUntil:'2099-01-01T00:00:00Z',analysisAllowed:true,providerProcessingAllowed:true,canonicalCaseAccepted:true});
 }
 return{cases,files,reviews};
}
function score(c:CorpusCase,features:readonly Feature[],patch:Partial<RecordedObservation>={},tolerance=2){
 const response=Buffer.from(JSON.stringify({features,noSignal:features.length===0}));
 const o:RecordedObservation={caseId:c.caseId,rasterSha256:c.rasterSha256,inputSha256:c.inputSha256,labelSha256:c.labelSha256,candidateSha:'a'.repeat(40),model:'pinned-test-model',requestId:'synthetic-'+c.caseId,executorReceiptSha256:'b'.repeat(64),rawResponseSha256:evidenceHash(response),status:'COMPLETED',latencyMs:50,features,noSignal:features.length===0,...patch};
 return scoreMonacoObservation(c,o,{candidateSha:'a'.repeat(40),model:'pinned-test-model',reviewedExecutorReceipts:[{receiptSha256:'b'.repeat(64),caseId:c.caseId,requestId:'synthetic-'+c.caseId,candidateSha:'a'.repeat(40),model:'pinned-test-model',rawResponseSha256:evidenceHash(response),rasterSha256:c.rasterSha256,inputSha256:c.inputSha256,labelSha256:c.labelSha256,costReconciled:true,provenance:'SYNTHETIC_OFFLINE'}],rawResponse:response,pixelTolerance:tolerance,priceTolerance:1});
}
const sample=await pack();
test('six synthetic packet contracts validate without granting dispatch/production permission',async()=>{const r=await validateMonacoEvidencePack(sample.cases,sample.files,sample.reviews);assert.equal(r.status,'PACK_CONTRACT_PASS',JSON.stringify(r));assert.equal(r.dispatchAuthorised,false);});
for(const [name,mutate]of [
 ['duplicate raster',(p:Awaited<ReturnType<typeof pack>>)=>{p.cases[1]={...p.cases[1],rasterSha256:p.cases[0].rasterSha256};}],
 ['wrong timeframe',(p:Awaited<ReturnType<typeof pack>>)=>{p.cases[3]={...p.cases[3],timeframe:'30m'};}],
 ['negative contains positive label',(p:Awaited<ReturnType<typeof pack>>)=>{p.cases[5]={...p.cases[5],features:[feature()]};}],
 ['self annotation',(p:Awaited<ReturnType<typeof pack>>)=>{p.cases[0]={...p.cases[0],independentAnnotator:'first'};}],
 ['tampered raster',(p:Awaited<ReturnType<typeof pack>>)=>{p.files.set(p.cases[0].rasterSha256,Buffer.from('bad'));}],
 ['wrong raster dimensions',(p:Awaited<ReturnType<typeof pack>>)=>{p.cases[0]={...p.cases[0],width:65};}],
 ['no provider-processing rights',(p:Awaited<ReturnType<typeof pack>>)=>{p.reviews[0]={...p.reviews[0],providerProcessingAllowed:false};}],
 ['expired evidence',(p:Awaited<ReturnType<typeof pack>>)=>{p.reviews[0]={...p.reviews[0],validUntil:'2000-01-01T00:00:00Z'};}],
 ['missing independent reviews',(p:Awaited<ReturnType<typeof pack>>)=>{p.reviews=[];}],
 ['substituted labels',(p:Awaited<ReturnType<typeof pack>>)=>{p.cases[0]={...p.cases[0],features:[feature('wrong',12)]};}],
 ['impossible coordinate',(p:Awaited<ReturnType<typeof pack>>)=>{p.cases[0]={...p.cases[0],features:[feature('wrong',500)]};}],
] as const)test('packet rejects '+name,async()=>{const p=await pack();mutate(p);assert.equal((await validateMonacoEvidencePack(p.cases,p.files,p.reviews)).status,'BLOCKED');});
test('positive score calculates exact TP FP FN and latency',()=>{const r=score(sample.cases[0],[feature(),feature('wrong',40)]);assert.equal(r.status,'MEASURED');if(r.status==='MEASURED'){assert.equal(r.metrics.tp,1);assert.equal(r.metrics.fp,1);assert.equal(r.metrics.fn,0);assert.equal(r.metrics.precision,.5);assert.equal(r.metrics.recall,1);assert.equal(r.metrics.latencyMs,50);}});
test('finite wrong prices are FP plus FN with retained error, not discarded',()=>{const r=score(sample.cases[0],[feature('wrong',10,150)]);assert.equal(r.status,'MEASURED');if(r.status==='MEASURED'){assert.deepEqual([r.metrics.tp,r.metrics.fp,r.metrics.fn],[0,1,1]);assert.equal(r.nearestErrors[0].nearestPriceError,50);}});
test('empty completed positive is measured false negative',()=>{const r=score(sample.cases[0],[]);assert.equal(r.status,'MEASURED');if(r.status==='MEASURED'){assert.equal(r.metrics.fn,1);assert.equal(r.metrics.precision,null);assert.equal(r.metrics.recall,0);}});
test('negative empty result is true negative; null precision is not inflated to100percent',()=>{const r=score(sample.cases[5],[]);assert.equal(r.status,'MEASURED');if(r.status==='MEASURED'){assert.equal(r.metrics.trueNegative,true);assert.equal(r.metrics.precision,null);assert.equal(r.metrics.recall,null);}});
test('negative false hypothesis is false positive',()=>{const r=score(sample.cases[5],[feature()]);assert.equal(r.status,'MEASURED');if(r.status==='MEASURED'){assert.equal(r.metrics.fp,1);assert.equal(r.metrics.negativeCasePassed,false);}});
test('matching handles crossing candidate edges and does not double-count reference',()=>{const c={...sample.cases[0],features:[feature('a',10),feature('b',12)]};const r=score(c,[feature('flexible',11),feature('restricted',8)],{},2);assert.equal(r.status,'MEASURED');if(r.status==='MEASURED')assert.equal(r.metrics.tp,2);});
test('duplicate predictions are FP even when positions are identical',()=>{const r=score(sample.cases[0],[feature('a'),feature('b')]);assert.equal(r.status,'MEASURED');if(r.status==='MEASURED')assert.equal(r.metrics.fp,1);});
for(const status of ['TRANSPORT_ERROR','HOLD','CANCELLED'] as const)test(status+' remains unmeasured not false negative',()=>{const r=score(sample.cases[0],[],{status});assert.equal(r.status,'UNMEASURED');assert.equal(r.metrics,null);});
for(const patch of [{candidateSha:'c'.repeat(40)},{model:'wrong'},{executorReceiptSha256:'c'.repeat(64)},{rawResponseSha256:'d'.repeat(64)},{noSignal:true},{latencyMs:NaN},{requestId:''},{labelSha256:'e'.repeat(64)}])test('measurement provenance/contradiction rejected '+JSON.stringify(patch),()=>{assert.equal(score(sample.cases[0],[feature()],patch).status,'UNMEASURED');});
test('six repeated measurements cannot satisfy six-case gate',()=>{const r=score(sample.cases[0],[feature()]);assert.equal(summarizeMonacoMeasurements([r,r,r,r,r,r]).status,'DUPLICATE_EVIDENCE');});
test('complete six-case measurements remain distinct from production readiness',()=>{const results=sample.cases.map(c=>score(c,c.features));const r=summarizeMonacoMeasurements(results);assert.equal(r.status,'SIX_OFFLINE_FIXTURES_SCORED');assert.equal(r.genuineMeasured,0);assert.equal(r.productionReady,false);});
test('missing transport case retains required denominator',()=>{const r=summarizeMonacoMeasurements([score(sample.cases[0],[]),score(sample.cases[1],[],{status:'TRANSPORT_ERROR'})]);assert.equal(r.required,6);assert.equal(r.measured,1);assert.equal(r.unmeasured,1);assert.equal(r.missing,4);assert.equal(r.status,'INCOMPLETE');});

async function addCrop(p:Awaited<ReturnType<typeof pack>>, wrong=false){
 const c=p.cases[0],rect={left:0,top:0,width:32,height:24};
 const original=p.files.get(c.rasterSha256)!;
 const crop=wrong?await sharp({create:{width:32,height:24,channels:3,background:'#ffffff'}}).png().toBuffer():await sharp(original).extract(rect).png().toBuffer();
 const oldInput=JSON.parse(Buffer.from(p.files.get(c.inputSha256)!).toString('utf8'));
 const input=Buffer.from(JSON.stringify({...oldInput,precisionImage:'data:image/png;base64,'+crop.toString('base64')})),inputSha256=evidenceHash(input);
 const labels=Buffer.from(JSON.stringify({caseId:c.caseId,rasterSha256:c.rasterSha256,scenario:c.scenario,timeframe:c.timeframe,negative:c.negative,features:c.features,precisionRect:rect})),labelSha256=evidenceHash(labels);
 p.files.set(inputSha256,input);p.files.set(labelSha256,labels);p.cases[0]={...c,inputSha256,labelSha256,precisionRect:rect};
 p.reviews=p.reviews.map(r=>r.rasterSha256===c.rasterSha256?{...r,inputSha256,labelSha256}:r);
}
test('secondary raster is compared with exact original crop pixels',async()=>{const p=await pack();await addCrop(p);assert.equal((await validateMonacoEvidencePack(p.cases,p.files,p.reviews)).status,'PACK_CONTRACT_PASS');});
test('secondary raster cannot substitute unrelated pixels despite matching dimensions and hashes',async()=>{const p=await pack();await addCrop(p,true);const r=await validateMonacoEvidencePack(p.cases,p.files,p.reviews);assert.equal(r.status,'BLOCKED');assert.ok(r.issues.some(s=>s.includes('SECONDARY_PIXELS_DO_NOT_MATCH_ORIGINAL')));});
