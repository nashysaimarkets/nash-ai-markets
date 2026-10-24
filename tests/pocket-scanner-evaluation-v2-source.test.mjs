import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {V2,APP_HASHES,verifyAppSources,extractEvaluationRequests,scopedFingerprint,sha256,validateEnvelope} from '../scripts/pocket-scanner-evaluation-v2-source.mjs';
import {validateEvaluationPlan,prepareEvaluationPlan,unpackEvaluationCase} from '../scripts/pocket-scanner-evaluation-v2-bundle.mjs';
import {input} from './support/pocket-scanner-evaluation-v2-fixture.mjs';
const planBytes=readFileSync(new URL('../docs/monaco-126/scanner-evaluation-v2-2026-10-24/PLAN.json',import.meta.url));
const planHash=sha256(planBytes);
test('accepted app hashes and original guards remain pinned; concrete v2 plan closes six distinct new identities',()=>{
  assert.deepEqual(verifyAppSources(),APP_HASHES);
  const p=validateEvaluationPlan(planBytes,planHash);assert.equal(p.cases.length,6);assert.equal(p.cases.flatMap(c=>c.calls).length,18);
  assert.deepEqual(p.cases.map(c=>c.caseId),['v2-d001','v2-d002','v2-d003','v2-d004','v2-d005','v2-d006']);
  assert.equal(p.originalCommitmentsMicroUsd+p.scopeBoundMicroUsd,3486400);assert.equal(p.dispatchAuthorised,false);
  const legacy=readFileSync(new URL('../scripts/pocket-monaco-offline-executor.ts',import.meta.url),'utf8');
  assert.ok(legacy.includes("'app/api/pocket/analyse/route.ts': '5a59b0cde257ad8ab885af9c9171198fe9732ad3a286efda301c6226903b7294'"));
  assert.ok(legacy.includes('7000:1400'));assert.ok(legacy.includes('319600'));
});
test('exact production initializers produce7000/4000 strict requests and new scope-bound identities',()=>{
  const a=extractEvaluationRequests(input,'v2-d001'),b=extractEvaluationRequests(input,'v2-d002');
  assert.deepEqual(Object.keys(a),['main','primary_precision','rescue_precision']);
  for(const [slot,r] of Object.entries(a)){const envelope=JSON.parse(Buffer.from(r.bytes));
    assert.equal(envelope.max_output_tokens,slot==='main'?7000:4000);assert.equal(envelope.model,V2.model);
    assert.equal(envelope.store,false);assert.equal(envelope.text.format.strict,true);assert.deepEqual(envelope.reasoning,{effort:'low'});
    assert.equal(r.requestSha256,sha256(r.bytes));assert.equal(r.fingerprint,scopedFingerprint({caseId:'v2-d001',sourceCaseId:'d001',slot,requestSha256:r.requestSha256}));
    assert.notEqual(r.fingerprint,b[slot].fingerprint);assert.notEqual(r.requestId,b[slot].requestId);
  }
});
test('optional rescue reading crop is represented only in its exact rescue envelope',()=>{
  const a=extractEvaluationRequests({...input,precisionImage:input.image},'v2-d001');
  for(const [slot,r] of Object.entries(a))assert.equal(JSON.parse(Buffer.from(r.bytes)).input[0].content.filter(c=>c.type==='input_image').length,slot==='rescue_precision'?2:1);
});
test('old, held-out, context and arbitrary provider envelopes are refused',()=>{
  for(const id of ['d001','e001','v2-e001','v2-d007'])assert.throws(()=>extractEvaluationRequests(input,id));
  assert.throws(()=>extractEvaluationRequests({...input,contextImage:input.image},'v2-d001'));
  const r=extractEvaluationRequests(input,'v2-d001'),body=JSON.parse(Buffer.from(r.primary_precision.bytes));
  for(const patch of [{max_output_tokens:1400},{model:'different'},{store:true},{service_tier:'flex'}])assert.throws(()=>validateEnvelope({...body,...patch},'primary_precision'));
});
test('concrete plan rejects oldcaps, relaxed carry-in, mismapped source cases or changed fingerprints',()=>{
  const mutate=fn=>{const p=JSON.parse(planBytes);fn(p);const bytes=Buffer.from(JSON.stringify(p));assert.throws(()=>validateEvaluationPlan(bytes,sha256(bytes)));};
  mutate(p=>p.cases[0].calls[1].maxOutputTokens=1400);mutate(p=>p.originalCommitmentsMicroUsd=0);
  mutate(p=>p.cases[0].sourceCaseId='d002');mutate(p=>p.cases[0].calls[0].fingerprint='0'.repeat(64));
  mutate(p=>p.maximumScopeCalls=19);mutate(p=>p.dispatchAuthorised=true);
});
test('bundle boundary refuses missing original packet, altered digest, and any unmatched one-case payload',()=>{
  assert.throws(()=>prepareEvaluationPlan(Buffer.from('not an original chart packet')));
  assert.throws(()=>unpackEvaluationCase({bytes:Buffer.from('invalid'),expectedBundleSha256:'0'.repeat(64),planBytes,expectedPlanSha256:planHash,caseId:'v2-d001'}));
  assert.throws(()=>unpackEvaluationCase({bytes:Buffer.from('invalid'),expectedBundleSha256:sha256('invalid'),planBytes,expectedPlanSha256:planHash,caseId:'d001'}));
});
