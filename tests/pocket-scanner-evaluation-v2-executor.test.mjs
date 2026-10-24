import test from 'node:test';
import assert from 'node:assert/strict';
import {createEvaluationExecutor} from '../scripts/pocket-scanner-evaluation-v2-executor.mjs';
import {harness,inspection} from './support/pocket-scanner-evaluation-v2-fixture.mjs';
const sends=h=>h.events.filter(e=>e.name.startsWith('send:')).length;

test('one named case consumes two exact slots, retains diagnostics and holds the full case ceiling',async()=>{
  const h=harness(),executor=createEvaluationExecutor(h),r=await executor.run(h.c);
  assert.equal(r.status,'COMPLETED');assert.equal(sends(h),2);assert.equal(r.caseId,'v2-d001');assert.equal(r.sourceCaseId,'d001');
  assert.equal(r.caseReservationMicroUsd,330000);assert.equal(r.financiallySettled,false);assert.equal(r.actualMicroUsd,null);
  assert.equal(h.slots.rescue_precision,'voided');assert.equal(r.timing.deployedHttpLatencyMs,null);
  const finish=h.events.find(e=>e.name==='finish');assert.equal(typeof finish.data.diagnosticArtifactId,'string');
  assert.equal((await executor.run(h.c)).reason,'INSTANCE_ALREADY_USED');assert.equal(sends(h),2);
});
test('existing completed empty-primary condition issues only the original conditional rescue',async()=>{
  const h=harness({responses:{primary_precision:{output_text:'{"levels":[]}'}}}),r=await createEvaluationExecutor(h).run(h.c);
  assert.equal(r.status,'COMPLETED');assert.equal(sends(h),3);assert.equal(h.slots.rescue_precision,'receipted');
});
test('known precision output limit is retained as incomplete and never creates a rescue',async()=>{
  const h=harness({responses:{primary_precision:{status:'incomplete',incomplete_details:{reason:'max_output_tokens'},output_text:'{"levels":'}}});
  let observed;h.finishCase=(_c,raw)=>{observed=raw;return {status:'UNMEASURED'};};
  const r=await createEvaluationExecutor(h).run(h.c);assert.equal(r.status,'COMPLETED');assert.equal(sends(h),2);
  assert.equal(observed.primary_precision.status,'incomplete');assert.equal(observed.primary_precision.output_text,'{"levels":');
});
test('known main output limit still accounts the distinct mandatory primary without fabricating main completion',async()=>{
  const h=harness({responses:{main:{status:'incomplete',incomplete_details:{reason:'max_output_tokens'},output_text:''}}});
  let raw;h.finishCase=(_c,r)=>{raw=r;return {status:'UNMEASURED'};};
  assert.equal((await createEvaluationExecutor(h).run(h.c)).status,'COMPLETED');assert.equal(sends(h),2);assert.equal(raw.main.status,'incomplete');
});
for(const failure of ['claim','submit:main','send:main','retain:provider-response:main','receipt:main','retain:diagnostic-output:null','finish']){
  test(`unknown ${failure} acknowledgement stops without retry or next case`,async()=>{
    const h=harness({fail:failure}),r=await createEvaluationExecutor(h).run(h.c);
    assert.equal(r.status,'UNCERTAIN');assert.equal(h.events.filter(e=>e.name===failure).length,1);
    assert.ok(sends(h)<=2);assert.equal(h.events.some(e=>e.name==='send:rescue_precision'),false);
    if(failure==='submit:main'){assert.equal(sends(h),0);assert.equal(h.slots.main,'submitted');}
    if(failure==='receipt:main'){assert.equal(sends(h),1);assert.equal(h.slots.main,'receipted');}
    const second=harness({journal:h.journal});const replay=await createEvaluationExecutor(second).run(second.c);
    assert.equal(replay.reason,'CLAIM_REFUSED');assert.equal(sends(second),0);
  });
}
test('cancellation before claim has zero effects; cancellation after submit preserves the uncertain hold',async()=>{
  const before=new AbortController();before.abort();const h=harness();assert.equal((await createEvaluationExecutor(h).run(h.c,{signal:before.signal})).status,'CANCELLED');assert.equal(h.events.length,0);
  const after=new AbortController(),g=harness({after:name=>{if(name==='submit:main')after.abort();}});
  const r=await createEvaluationExecutor(g).run(g.c,{signal:after.signal});assert.equal(r.status,'CANCELLED');assert.equal(sends(g),0);
  assert.equal(g.slots.main,'submitted');assert.equal(g.journal.stop,true);
});
test('authority refusal, original identities and payload tampering stop before any provider effect',async()=>{
  for(const patch of [{allowed:false,reason:'expired'},{allowed:false,reason:'previous_case_unresolved'},{originalCommitmentsMicroUsd:0},{remainingMicroUsd:5000000}]){
    const h=harness();h.ledger.inspect=async()=>({...inspection(h.identity),...patch});assert.equal((await createEvaluationExecutor(h).run(h.c)).reason,'AUTHORITATIVE_ADMISSION_REFUSED');assert.equal(sends(h),0);
  }
  const h=harness();h.c.caseId='d001';assert.equal((await createEvaluationExecutor(h).run(h.c)).reason,'PREPARATION_REFUSED');assert.equal(h.events.length,0);
  const g=harness();g.c.requests.main.bytes[0]^=1;assert.equal((await createEvaluationExecutor(g).run(g.c)).reason,'PREPARATION_REFUSED');assert.equal(g.events.length,0);
});
test('duplicate provider IDs and unknown provider terminal status stop after retention without further sends',async()=>{
  for(const responses of [{primary_precision:{id:'synthetic-res-main'}},{main:{status:'failed'}}]){
    const h=harness({responses}),r=await createEvaluationExecutor(h).run(h.c);assert.equal(r.status,'UNCERTAIN');assert.ok(sends(h)<=2);assert.equal(h.journal.stop,true);
  }
});
