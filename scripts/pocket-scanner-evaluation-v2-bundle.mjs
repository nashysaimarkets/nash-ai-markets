/** Offline preparation and one-case data envelopes. Never alters old inputs,
 * requests, plans, receipt identities or reference coordinates. */
import {gzipSync,gunzipSync} from 'node:zlib';
import {isDeepStrictEqual} from 'node:util';
import {V2,SLOTS,CASE_IDS,COSTS,APP_HASHES,sha256,need,digest,sourceCaseId,attemptId,
  extractEvaluationRequests,verifyAppSources,scopedFingerprint} from './pocket-scanner-evaluation-v2-source.mjs';
const MAX_BYTES=128*1024*1024;
const encode=x=>Buffer.from(JSON.stringify(x,null,2)+'\n');
const artifact=bytes=>({bytes:Uint8Array.from(bytes),sha256:sha256(bytes)});
const parse=bytes=>JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
const caseArtifacts=['input','image','bars','sourceZip','licence','calibration'];

export function prepareEvaluationPlan(originalBundleBytes){
  verifyAppSources();need(originalBundleBytes instanceof Uint8Array&&sha256(originalBundleBytes)===V2.originalBundleSha256);
  const old=parse(gunzipSync(originalBundleBytes,{maxOutputLength:MAX_BYTES}));
  need(old.kind==='MONACO_FIRST_SIX_BUNDLE_V1'&&isDeepStrictEqual(old.caseIds,CASE_IDS.map(sourceCaseId))&&old.entries.length<=64);
  const files=new Map();
  for(const e of old.entries){need(typeof e.path==='string'&&!files.has(e.path)&&digest(e.sha256));
    const bytes=Buffer.from(e.data,'base64');need(bytes.toString('base64')===e.data&&sha256(bytes)===e.sha256);files.set(e.path,bytes);}
  const read=(path,pin)=>{const bytes=files.get(path);need(bytes&&sha256(bytes)===pin);return artifact(bytes);};
  const manifest=parse(read('packet/BENCHMARK50.json',V2.originalManifestSha256).bytes);
  const objectiveReference=read('objective-reference.json',V2.oracleSha256),protocol=read('protocol.json',V2.protocolSha256);
  const oracle=parse(objectiveReference.bytes);need(isDeepStrictEqual(oracle.caseIds,CASE_IDS.map(sourceCaseId)));
  const prepared=CASE_IDS.map(caseId=>{
    const originalId=sourceCaseId(caseId),rows=manifest.cases.filter(c=>c.caseId===originalId);need(rows.length===1&&rows[0].split==='development');
    const c=rows[0],reference=oracle.cases.find(c=>c.caseId===originalId);need(reference);
    const mapping={input:[c.inputPath,c.inputSha256],image:[c.imagePath,c.rasterSha256],bars:[c.barsPath,c.barsSha256],
      sourceZip:[c.sourcePath,c.sourceZipSha256],licence:[c.licencePath,c.licenceSha256],calibration:[c.calibrationPath,c.calibrationSha256]};
    const artifacts=Object.fromEntries(Object.entries(mapping).map(([key,[path,pin]])=>[key,read(`packet/${path}`,pin)]));
    const input=parse(artifacts.input.bytes);
    need(input.image===`data:image/png;base64,${Buffer.from(artifacts.image.bytes).toString('base64')}`
      &&reference.identities.inputSha256===artifacts.input.sha256&&reference.identities.imageSha256===artifacts.image.sha256);
    return {caseId,sourceCaseId:originalId,attemptId:attemptId(caseId),artifacts,objectiveReference,protocol,
      sourceIdentity:reference.identities,requests:extractEvaluationRequests(input,caseId)};
  });
  const plan={schemaVersion:2,kind:'POCKET_SCANNER_EVALUATION_V2_PLAN',status:'OFFLINE_PREPARED',dispatchAuthorised:false,
    scopeId:V2.scopeId,appSourceSha:V2.appSourceSha,appSourceHashes:APP_HASHES,
    model:V2.model,serviceTier:'default',reasoningEffort:'low',store:false,originalBundleSha256:V2.originalBundleSha256,
    objectiveReferenceSha256:V2.oracleSha256,protocolSha256:V2.protocolSha256,
    originalCommitmentsMicroUsd:V2.originalCommitmentsMicroUsd,caseBoundMicroUsd:V2.caseBoundMicroUsd,
    scopeBoundMicroUsd:V2.scopeBoundMicroUsd,aggregateMaximumMicroUsd:V2.aggregateMaximumMicroUsd,
    aggregateCapMicroUsd:V2.aggregateCapMicroUsd,actualMicroUsd:null,financiallySettled:false,
    contextImage:'ABSENT',macroEvents:[],maximumCallsPerCase:3,maximumScopeCalls:18,maximumAttemptsPerCase:1,
    cases:prepared.map(c=>({caseId:c.caseId,sourceCaseId:c.sourceCaseId,attemptId:c.attemptId,
      artifacts:Object.fromEntries(Object.entries(c.artifacts).map(([k,a])=>[k,a.sha256])),
      calls:SLOTS.map(slot=>{const {bytes,...r}=c.requests[slot];return {slot,...r,model:V2.model,serviceTier:'default'};})})),
    approvalRequired:'NEW_EXPLICIT_SCOPE_APPROVAL_AND_INDEPENDENT_EXACT_RUN_ADMISSION',
    limitations:['Prepared requests are not execution approval','Original first-six send identities and financial history remain closed',
      'One named case per invocation; operator reassessment before each later case','Original one-pixel diagnostics; semantics remain unscored']};
  const planBytes=encode(plan),planSha256=sha256(planBytes);
  return {plan,planBytes,planSha256,cases:prepared.map(c=>({...c,planSha256}))};
}

export function validateEvaluationPlan(planBytes,expectedSha256){
  need(planBytes instanceof Uint8Array&&digest(expectedSha256)&&sha256(planBytes)===expectedSha256);
  const p=parse(planBytes);need(p.kind==='POCKET_SCANNER_EVALUATION_V2_PLAN'&&p.schemaVersion===2&&p.status==='OFFLINE_PREPARED'
    &&p.dispatchAuthorised===false&&p.scopeId===V2.scopeId&&p.appSourceSha===V2.appSourceSha
    &&isDeepStrictEqual(p.appSourceHashes,APP_HASHES)&&p.model===V2.model&&p.store===false&&p.serviceTier==='default'
    &&p.reasoningEffort==='low'&&p.contextImage==='ABSENT'&&isDeepStrictEqual(p.macroEvents,[])
    &&p.originalBundleSha256===V2.originalBundleSha256&&p.objectiveReferenceSha256===V2.oracleSha256&&p.protocolSha256===V2.protocolSha256
    &&p.originalCommitmentsMicroUsd===1506400&&p.caseBoundMicroUsd===330000&&p.scopeBoundMicroUsd===1980000
    &&p.aggregateMaximumMicroUsd===3486400&&p.aggregateCapMicroUsd===5000000
    &&p.maximumCallsPerCase===3&&p.maximumScopeCalls===18&&p.maximumAttemptsPerCase===1
    &&isDeepStrictEqual(p.cases?.map(c=>c.caseId),CASE_IDS));
  for(const c of p.cases){need(c.sourceCaseId===sourceCaseId(c.caseId)&&c.attemptId===attemptId(c.caseId)
      &&isDeepStrictEqual(Object.keys(c.artifacts).sort(),[...caseArtifacts].sort())&&Object.values(c.artifacts).every(digest)
      &&isDeepStrictEqual(c.calls?.map(r=>r.slot),SLOTS));
    for(const r of c.calls){need(r.model===V2.model&&r.serviceTier==='default'&&r.maxOutputTokens===(r.slot==='main'?7000:4000)
      &&r.costBoundMicroUsd===COSTS[r.slot]&&digest(r.requestSha256)
      &&r.requestId===`${c.caseId}-${r.slot}-${r.requestSha256.slice(0,16)}`
      &&r.fingerprint===scopedFingerprint({...r,caseId:c.caseId,sourceCaseId:c.sourceCaseId}));}}
  return p;
}

/** This selects exactly one logical case. Raw chart/request content stays private. */
export function packEvaluationCase(prepared,caseId){
  const plan=validateEvaluationPlan(prepared.planBytes,prepared.planSha256),c=prepared.cases.find(c=>c.caseId===caseId);
  need(c&&CASE_IDS.includes(caseId));
  const rows=Object.entries(c.artifacts).map(([kind,a])=>({path:`artifacts/${kind}`,sha256:a.sha256,data:Buffer.from(a.bytes).toString('base64')}));
  rows.push({path:'objective-reference',sha256:c.objectiveReference.sha256,data:Buffer.from(c.objectiveReference.bytes).toString('base64')},
    {path:'protocol',sha256:c.protocol.sha256,data:Buffer.from(c.protocol.bytes).toString('base64')});
  for(const slot of SLOTS){const r=c.requests[slot];rows.push({path:`requests/${slot}`,sha256:r.requestSha256,data:Buffer.from(r.bytes).toString('base64')});}
  const bytes=gzipSync(encode({kind:'POCKET_SCANNER_EVALUATION_V2_CASE_BUNDLE',scopeId:V2.scopeId,caseId,
    sourceCaseId:sourceCaseId(caseId),attemptId:attemptId(caseId),planSha256:prepared.planSha256,entries:rows}),{level:6});
  // The decoder independently checks exact plan/body/source agreement before use.
  unpackEvaluationCase({bytes,expectedBundleSha256:sha256(bytes),planBytes:prepared.planBytes,expectedPlanSha256:prepared.planSha256,caseId});
  return {bytes,sha256:sha256(bytes),caseId,sourceCaseId:sourceCaseId(caseId),planSha256:prepared.planSha256,
    requestPins:plan.cases.find(c=>c.caseId===caseId).calls};
}

export function unpackEvaluationCase({bytes,expectedBundleSha256,planBytes,expectedPlanSha256,caseId}){
  need(bytes instanceof Uint8Array&&bytes.length<MAX_BYTES/2&&sha256(bytes)===expectedBundleSha256);
  const p=validateEvaluationPlan(planBytes,expectedPlanSha256),planCase=p.cases.find(c=>c.caseId===caseId);need(planCase);
  const b=parse(gunzipSync(bytes,{maxOutputLength:MAX_BYTES}));
  need(b.kind==='POCKET_SCANNER_EVALUATION_V2_CASE_BUNDLE'&&b.scopeId===V2.scopeId&&b.caseId===caseId
    &&b.sourceCaseId===sourceCaseId(caseId)&&b.attemptId===attemptId(caseId)&&b.planSha256===expectedPlanSha256
    &&Array.isArray(b.entries)&&b.entries.length===11);
  const files=new Map();let total=0;
  for(const e of b.entries){need(!files.has(e.path)&&digest(e.sha256)&&typeof e.data==='string');const content=Buffer.from(e.data,'base64');
    total+=content.length;need(total<=MAX_BYTES/2&&content.toString('base64')===e.data&&sha256(content)===e.sha256);files.set(e.path,artifact(content));}
  const take=(path,pin)=>{const a=files.get(path);need(a&&a.sha256===pin);return a;};
  const artifacts=Object.fromEntries(caseArtifacts.map(k=>[k,take(`artifacts/${k}`,planCase.artifacts[k])]));
  const objectiveReference=take('objective-reference',V2.oracleSha256),protocol=take('protocol',V2.protocolSha256);
  const input=parse(artifacts.input.bytes);need(input.image===`data:image/png;base64,${Buffer.from(artifacts.image.bytes).toString('base64')}`);
  const oracle=parse(objectiveReference.bytes),reference=oracle.cases.find(c=>c.caseId===sourceCaseId(caseId));
  need(reference?.identities?.inputSha256===artifacts.input.sha256&&reference.identities.imageSha256===artifacts.image.sha256);
  const requests=extractEvaluationRequests(input,caseId);
  for(const slot of SLOTS){const r=requests[slot],pin=planCase.calls.find(r=>r.slot===slot),a=take(`requests/${slot}`,pin.requestSha256);
    need(a.sha256===r.requestSha256&&r.fingerprint===pin.fingerprint&&r.requestId===pin.requestId);}
  return {caseId,sourceCaseId:sourceCaseId(caseId),attemptId:attemptId(caseId),planSha256:expectedPlanSha256,
    artifacts,objectiveReference,protocol,sourceIdentity:reference.identities,requests};
}
