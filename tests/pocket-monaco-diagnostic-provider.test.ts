import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  OFFLINE_ONLY, INTERNAL_DIAGNOSTICS_MODE, MODEL, SOURCE_PINS, PACKET_PINS, SLOTS, sha256,
  materialDigest, diagnosticFreezeSha256, assertDiagnosticAdmission, assertAdmission,
  createMockTransport, createDisposableStore, disposeStore, snapshot, runOfflineDiagnosticCase,
  type CaseMaterial, type Binding, type DiagnosticAdmission,
} from '../scripts/pocket-monaco-offline-executor.ts';
import {INTERNAL_DIAGNOSTIC_PROTOCOL} from '../scripts/pocket-monaco-internal-diagnostics.ts';
import {FIRST_SIX, prepareInternalDiagnosticPlan, diagnosticPlanInventory, runInternalDiagnosticMockCase,
  diagnosticExecutionReadiness, dispatchRealInternalDiagnostics, type ExecutionEvidence} from '../scripts/pocket-monaco-diagnostic-provider.ts';
const artifact=(value:string|Uint8Array)=>{const bytes=Buffer.from(value);return {bytes,sha256:sha256(bytes)};};
const image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
const calculator=sha256(readFileSync(new URL('../scripts/monaco-diagnostic-source-reference.py',import.meta.url)));
function material(caseId='d001'):CaseMaterial {
  const input={image,intention:'UNSURE',chartConfirmation:{contextMatch:'NOT_PROVIDED',instrument:'SYNTHETIC FIXTURE',timeframe:'1m',currentPrice:'100'}};
  const requests=Object.fromEntries(SLOTS.map(slot=>{const e={model:MODEL,service_tier:'default',store:false,reasoning:{effort:'low'},max_output_tokens:slot==='main'?7000:1400,instructions:'SYNTHETIC FIXTURE',input:[{role:'user',content:[{type:'input_text',text:'fixture'},{type:'input_image',image_url:image,detail:'high'}]}],text:{format:{type:'json_schema',name:'fixture',strict:true,schema:{type:'object'}}}};
    return [slot,{...artifact(JSON.stringify(e)),fingerprint:sha256(JSON.stringify(e,(_k,v)=>typeof v==='string'&&v.startsWith('data:image/')?`sha256:${sha256(v)}`:v))}];})) as unknown as CaseMaterial['requests'];
  return {caseId,scope:'A',manifestSha256:PACKET_PINS.manifest,requests,artifacts:{input:artifact(JSON.stringify(input)),image:artifact(Buffer.from(image.split(',')[1]!,'base64')),bars:artifact('fixture bars'),sourceZip:artifact('fixture zip'),licence:artifact('fixture licence'),calibration:artifact('fixture calibration')}};
}
function admission(m=material()):DiagnosticAdmission {
  const materials=FIRST_SIX.map(id=>id===m.caseId?m:material(id));
  const oracle=artifact(JSON.stringify({schemaVersion:1,kind:'MONACO_INTERNAL_SOURCE_REFERENCE',packetManifestSha256:PACKET_PINS.manifest,
    sourceCalculatorSha256:calculator,caseIds:FIRST_SIX,cases:materials.map(c=>({caseId:c.caseId,identities:{inputSha256:c.artifacts.input.sha256,imageSha256:c.artifacts.image.sha256,barsSha256:c.artifacts.bars.sha256,sourceZipSha256:c.artifacts.sourceZip.sha256,calibrationSha256:c.artifacts.calibration.sha256},objective:{aggregation:{exactOhlcvMatch:true}}}))}));
  const protocol=artifact(JSON.stringify(INTERNAL_DIAGNOSTIC_PROTOCOL));
  const binding:Binding={mode:OFFLINE_ONLY,scope:'A',caseIds:[...FIRST_SIX],manifestSha256:PACKET_PINS.manifest,candidateSha:'f5e820b0bd7bf095153e31d692a10fb3640ba16e',scannerSourcesSha256:sha256(JSON.stringify(SOURCE_PINS)),requestInventorySha256:PACKET_PINS.requests,referenceSha256:oracle.sha256,protocolSha256:protocol.sha256,freezeSha256:null,model:MODEL,ledgerKey:'offline-A',capMicroUsd:5000000,priorExposureMicroUsd:0,caseDigests:Object.fromEntries(materials.map(c=>[c.caseId,materialDigest(c)]))};
  binding.freezeSha256=diagnosticFreezeSha256(binding);
  return {kind:INTERNAL_DIAGNOSTICS_MODE,binding,ownerAmendmentRef:'issue126-6309011401',budgetEvidenceKind:'DISPOSABLE_SIMULATION_NOT_OWNER_BALANCE',objectiveReference:oracle,protocol};
}
function resetFreeze(a:DiagnosticAdmission){a.binding.freezeSha256=diagnosticFreezeSha256(a.binding);}
const receipt=(id:string,body:unknown)=>({status:'completed',_request_id:`mock-${id}`,id:`mock-response-${id}`,model:MODEL,service_tier:'default',usage:{input_tokens:1,output_tokens:1,total_tokens:2},output_text:JSON.stringify(body)});
const primary={currentPrice:'100',levels:[{price:'90'},{price:'110'}]};
const mockSteps=()=>[{slot:'main' as const,response:receipt('main',{patterns:[],levels:[],evidenceQuality:{candlesReadable:true,scaleReadable:false}})},{slot:'primary_precision' as const,response:receipt('precision',primary)}];
test('internal amendment admits source-bound mocks without fabricated human annotations; expert path still blocks',()=>{
  const m=material(),a=admission(m);assert.doesNotThrow(()=>assertDiagnosticAdmission(a,m));
  assert.throws(()=>assertAdmission({binding:a.binding,reviews:[]},m),/primary/);
});
test('missing or different owner amendment cannot use internal track',()=>{
  assert.throws(()=>assertDiagnosticAdmission(undefined,material()),/amendment/);
  const a=admission();(a as unknown as {ownerAmendmentRef:string}).ownerAmendmentRef='unapproved';
  assert.throws(()=>assertDiagnosticAdmission(a,material()),/amendment/);
});
test('held-out scope and relabelled case are denied before dispatch',()=>{
  for(const changes of [{scope:'B' as const},{caseId:'e001'}])assert.throws(()=>assertDiagnosticAdmission(admission(),{...material(),...changes}),/first-six/);
});
test('source and request bytes must match even in no-human mode',()=>{
  for(const key of ['input','image','bars','sourceZip','licence','calibration'] as const){const m=material(),a=admission(m);m.artifacts[key].bytes=Buffer.from('tamper');assert.throws(()=>assertDiagnosticAdmission(a,m),/hash/);}
  for(const slot of SLOTS){const m=material(),a=admission(m);m.requests[slot].bytes=Buffer.from('{}');assert.throws(()=>assertDiagnosticAdmission(a,m),/hash/);}
});
test('objective oracle drift, source calculator substitution and wrong case identity fail',()=>{
  for(const edit of [(o:any)=>{o.sourceCalculatorSha256=sha256('changed');},(o:any)=>{o.cases[0].identities.imageSha256=sha256('other');},(o:any)=>{o.cases[0].objective.aggregation.exactOhlcvMatch=false;},(o:any)=>{o.caseIds.push('e001');}]){
    const a=admission(),o=JSON.parse(Buffer.from(a.objectiveReference.bytes).toString());edit(o);a.objectiveReference=artifact(JSON.stringify(o));a.binding.referenceSha256=a.objectiveReference.sha256;resetFreeze(a);
    assert.throws(()=>assertDiagnosticAdmission(a,material()),/calculator|binding|calculation|oracle/);
  }
});
test('protocol threshold changes cannot silently become approved diagnostic rules',()=>{
  const a=admission();a.protocol=artifact(JSON.stringify({...INTERNAL_DIAGNOSTIC_PROTOCOL,maximumCombinedPixelTolerance:99}));a.binding.protocolSha256=a.protocol.sha256;resetFreeze(a);
  assert.throws(()=>assertDiagnosticAdmission(a,material()),/protocol/);
});
test('first-six freeze binds all request digests, references and simulation budget',()=>{
  for(const edit of [(a:DiagnosticAdmission)=>{a.binding.caseDigests.d002=sha256('drift');},(a:DiagnosticAdmission)=>{a.binding.priorExposureMicroUsd=1;},(a:DiagnosticAdmission)=>{a.binding.referenceSha256=sha256('other');}]){
    const a=admission();edit(a);assert.throws(()=>assertDiagnosticAdmission(a,material()),/freeze/);
  }
});
test('unknown headroom is never silently assumed even for a simulation',()=>{
  for(const prior of [null,3082401]){const a=admission();a.binding.priorExposureMicroUsd=prior;resetFreeze(a);assert.throws(()=>assertDiagnosticAdmission(a,material()),/budget/);}
});
test('new no-human path uses existing reservation/receipt state machine and keeps mock/provider counts separate',async()=>{
  const store=createDisposableStore(),mock=createMockTransport(mockSteps());try{
    const out=await runOfflineDiagnosticCase({material:material(),admission:admission(),store,transport:mock.transport});
    assert.equal(out.status,'MOCK_COMPLETE');assert.equal(out.providerCalls,0);const s=snapshot(store);
    assert.equal(s.cases.d001.protocolTrack,INTERNAL_DIAGNOSTICS_MODE);assert.equal(s.cases.d001.calls.rescue_precision.status,'voided');
    await assert.rejects(runOfflineDiagnosticCase({material:material(),admission:admission(),store,transport:mock.transport}),/Duplicate/);
  }finally{disposeStore(store);}
});
test('new path rejects callback/client injection and cancellation before claim',async()=>{
  const store=createDisposableStore(),mock=createMockTransport(mockSteps()),controller=new AbortController();controller.abort();
  try{await assert.rejects(runOfflineDiagnosticCase({material:material(),admission:admission(),store,transport:{kind:OFFLINE_ONLY}}),/branded/);
    const out=await runOfflineDiagnosticCase({material:material(),admission:admission(),store,transport:mock.transport,signal:controller.signal});
    assert.equal(out.status,'CANCELLED_BEFORE_CLAIM');assert.deepEqual(mock.sends(),[]);assert.deepEqual(snapshot(store).events,[]);
  }finally{disposeStore(store);}
});
function declaredEvidence():ExecutionEvidence{return {paidApprovalRef:null,exactPlanApproved:false,executor:{identity:'saved-metadata-run-39467424486',isolationVerified:true,existingCredentialBound:false,inferenceCapable:false,metadataOnlyCredential:true,project:'proj_LTmAIE2Ve7gUAFJ9M74ZxIBI',securityApprovalRef:null},processor:{onBehalfAccepted:false,retentionAccepted:false,trainingAccepted:false,territoryAccepted:false,privateArtifactsAccepted:false},budget:{authoritativeLedgerVerified:false,ledgerIdentity:null,aggregateCapMicroUsd:5000000,spentReservedUnresolvedMicroUsd:null,historicalAccountingKeptSeparate:true,cashAllowanceApproved:false}};}
test('saved metadata-only executor and absent budget ledger produce explicit blocked conditions',()=>{
  const r=diagnosticExecutionReadiness(declaredEvidence());assert.equal(r.declaredHeadroomMicroUsd,null);
  assert.ok(r.blockers.includes('EXISTING_ISOLATED_INFERENCE_EXECUTOR_NOT_BOUND'));assert.ok(r.blockers.includes('AUTHORITATIVE_AGGREGATE_HEADROOM_UNVERIFIED_OR_INSUFFICIENT'));
  assert.equal(r.providerDispatchEnabled,false);assert.equal(r.scopeBApproved,false);
});
test('declared financial boundary is inclusive; no zero/unknown or historical borrowing',()=>{
  for(const [prior,ok] of [[3082400,true],[3082401,false],[null,false],[NaN,false],[-1,false]] as const){const e=declaredEvidence();Object.assign(e.budget,{authoritativeLedgerVerified:true,ledgerIdentity:'synthetic-disposable',spentReservedUnresolvedMicroUsd:prior});
    const r=diagnosticExecutionReadiness(e);assert.equal(r.blockers.includes('AUTHORITATIVE_AGGREGATE_HEADROOM_UNVERIFIED_OR_INSUFFICIENT'),!ok);assert.equal(r.actualHeadroomVerifiedByThisFunction,false);}
});
test('environment flags and declarations cannot activate real provider transport',()=>{
  const old=process.env.POCKET_BENCHMARK_PILOT_ENABLED;process.env.POCKET_BENCHMARK_PILOT_ENABLED='true';
  try{assert.throws(dispatchRealInternalDiagnostics,/DISABLED/);}finally{if(old===undefined)delete process.env.POCKET_BENCHMARK_PILOT_ENABLED;else process.env.POCKET_BENCHMARK_PILOT_ENABLED=old;}
});
test('empty or partial processor conditions cannot appear complete',()=>{
  for(const processor of [{},{onBehalfAccepted:true},{onBehalfAccepted:true,trainingAccepted:true,territoryAccepted:true,privateArtifactsAccepted:true}]){
    const e=declaredEvidence();e.executor.securityApprovalRef='synthetic';e.processor=processor as ExecutionEvidence['processor'];
    assert.ok(diagnosticExecutionReadiness(e).blockers.includes('ACTUAL_PROCESSOR_SECURITY_CONDITIONS_UNACCEPTED'));
  }
});
test('existing real first-six packet prepares exact 18 slots; retained mock reports never become scanner evidence',{
  skip:!process.env.MONACO_DIAGNOSTIC_PACKET||!process.env.MONACO_DIAGNOSTIC_ORACLE,
},async()=>{
  const protocol=artifact(readFileSync(new URL('../docs/monaco-126/internal-diagnostics/PROTOCOL-v1.json',import.meta.url)));
  const plan=prepareInternalDiagnosticPlan(process.env.MONACO_DIAGNOSTIC_PACKET!,artifact(readFileSync(process.env.MONACO_DIAGNOSTIC_ORACLE!)),protocol,0);
  const oracle=JSON.parse(Buffer.from(plan.admission.objectiveReference.bytes).toString());oracle.cases[0].objective.priceScale.priceMin='0';
  assert.throws(()=>prepareInternalDiagnosticPlan(process.env.MONACO_DIAGNOSTIC_PACKET!,artifact(JSON.stringify(oracle)),protocol,0),/independently calculated/);
  const changed=structuredClone(plan);changed.integrationSourceHashes['scripts/pocket-monaco-diagnostic-provider.ts']=sha256('changed');
  assert.throws(()=>diagnosticPlanInventory(changed),/freeze/);
  const inventory=diagnosticPlanInventory(plan);assert.equal(inventory.calls.length,18);assert.equal(inventory.maximumDirectTokenCostMicroUsd,1917600);
  assert.equal(inventory.verifiedRealHeadroomMicroUsd,null);assert.deepEqual(inventory.caseIds,[...FIRST_SIX]);
  const store=createDisposableStore();try{
    const raw={instrument:'SYNTHETIC_FIXTURE',timeframe:'30m',currentPrice:'100',patterns:[],levels:[],liquidity:{state:'NONE',event:'NONE',confidence:'LOW',zones:[],observations:[]},priceScaleAnchors:[],evidenceQuality:{chartReadability:'CLEAR',candlesReadable:true,scaleReadable:true}};
    const mock=createMockTransport([{slot:'main',response:receipt('actual-fixture-main',raw)},{slot:'primary_precision',response:receipt('actual-fixture-precision',primary)}]);
    const out=await runInternalDiagnosticMockCase(plan,'d001',{store,transport:mock.transport});assert.equal(out.actualProviderCalls,0);assert.equal(out.expertAccepted,false);assert.equal(out.rawMain.status,'DIAGNOSTIC_RECORDED');
    assert.ok(out.rawSlotSha256.main);assert.equal(out.tradingInterpretation,'UNSCORED');
    await assert.rejects(runInternalDiagnosticMockCase(plan,'e001',{store,transport:mock.transport}),/Held-out/);
  }finally{disposeStore(store);}
});
