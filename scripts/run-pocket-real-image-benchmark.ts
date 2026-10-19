/** Genuine original-image benchmark runner. No provider calls by default.
 * The external original/reference corpus is NOT committed to GitHub.
 * Never interpret an HTTP error or unsettled receipt as an accuracy result.
 */
import {mkdir,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {caseId,loadRealCase,realObservation} from './pocket-real-benchmark-fixture.ts';

const id=caseId(process.env.POCKET_REAL_CASE);
const sample=await loadRealCase(process.env.POCKET_REAL_CORPUS_DIRECTORY??'',id);
if(process.env.POCKET_REAL_BENCHMARK_DISPATCH!=='true'){
 console.log('REAL_IMAGE_INPUT_VERIFIED',JSON.stringify({
  caseId:id,originalSha256:sample.originalSha256,inputSha256:sample.inputSha256,
  providerCalls:0,scored:false,status:'OFFLINE_ONLY'
 }));
}else{
 if(process.env.POCKET_REAL_CORPUS_REVIEWED!=='true')
  throw Error('Independent original-market licensing and ground-truth review is required before dispatch.');
 // Preserve the independent, cumulative $5 pilot's durable claim, per-call
 // reservation, receipt check, request attribution, settlement and release veto.
 const {isBenchmarkPilotSpendHeld}=await import('../app/api/pocket/torture/spending-hold.ts');
 if(isBenchmarkPilotSpendHeld())throw Error('Benchmark pilot remains disabled. No provider request was sent.');
 const output=process.env.POCKET_REAL_BENCHMARK_OUTPUT_DIRECTORY?.trim();
 if(!output)throw Error('Private output folder is required.');
 const {withPocketTestSpendScope,recordPocketBenchmarkMeasurement,releasePocketBenchmarkMeasurement}=await import('../app/api/pocket/torture/provider-spend.ts');
 const {POST}=await import('../app/api/pocket/analyse/route.ts');
 const request=new Request('http://localhost/api/pocket/analyse',{
  method:'POST',headers:{'content-type':'application/json'},
  body:JSON.stringify(sample.input)
 });
 const started=performance.now();
 const run=await withPocketTestSpendScope(id,async()=>POST(request));
 const elapsed=Math.round(performance.now()-started);
 const response=run.value;
 if(!response.ok){
  console.log('REAL_IMAGE_UNSCORED',JSON.stringify({caseId:id,status:response.status,scored:false,reason:'ANALYSIS_HTTP_FAILURE',latencyMs:elapsed}));
  process.exitCode=1;
 }else{
  const reply=await response.json() as {analysis?:unknown};
  const observation=realObservation(id,reply?.analysis,elapsed);
  const measurement={
   caseId:id,originalSha256:sample.originalSha256,inputSha256:sample.inputSha256,
   latencyMs:elapsed,analysisHttpStatus:response.status,observation,
   // These real-market reference annotations remain provisional. Only an
   // independent reviewed scorer can later promote release-acceptance metrics.
   scored:false,provisionalAnnotation:true,reason:'GROUND_TRUTH_SECOND_REVIEW_PENDING'
  };
  await recordPocketBenchmarkMeasurement(id,measurement);
  if(!run.reconciliation.reconciled||run.reconciliation.capExceeded){
   console.log('REAL_IMAGE_PENDING_SETTLEMENT',JSON.stringify({caseId:id,scored:false}));
   process.exitCode=2;
  }else{
   const released=await releasePocketBenchmarkMeasurement(id);
   if(released.released!==true||!released.measurement||typeof released.measurement!=='object'||Array.isArray(released.measurement)){
    console.log('REAL_IMAGE_PENDING_SETTLEMENT',JSON.stringify({caseId:id,scored:false}));
    process.exitCode=2;
   }else{
    const dir=resolve(output);
    await mkdir(dir,{recursive:true,mode:0o700});
    const path=join(dir,id+'.observation.json');
    await writeFile(path,JSON.stringify([observation],null,2)+'\n',{encoding:'utf8',flag:'wx',mode:0o600});
    console.log('REAL_IMAGE_RECONCILED_PROVISIONAL',JSON.stringify({
     caseId:id,originalSha256:sample.originalSha256,observationPath:path,
     costReconciled:true,scored:false,annotationReview:'PENDING'
    }));
   }
  }
 }
}
