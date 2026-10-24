/** No network, credentials, actual ledger or private packet. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,materials,truncated,slots,balance} from './support/pocket-monaco-continuation-fixture.mjs';
import {CONTINUATION_IDS} from '../scripts/pocket-monaco-continuation-admission.mjs';

test('only untouched five charts run; immutable predecessor is never mutated',async()=>{
  const f=fixture(),r=await f.executor().run(materials());
  assert.equal(r.status,'COMPLETED');assert.equal(r.transportSendAttempts,10);assert.equal(r.previousTransportSendAttempts,2);
  assert.deepEqual(r.cases.map(c=>c.caseId),CONTINUATION_IDS);
  assert.equal(f.events.some(e=>e.includes('d001')),false);assert.equal(r.financiallySettled,false);assert.equal(r.actualMicroUsd,null);
  for(const id of CONTINUATION_IDS)for(const slot of slots.slice(0,2)){
    const at=kind=>f.events.findIndex(e=>e[0]===kind&&e[1]===id&&e[2]===slot);
    assert.ok(at('submit')<at('send')&&at('send')<at('retain')&&at('retain')<at('receipt'));
  }
});
test('original completed-response predicate alone permits each distinct rescue; maximum15 new sends',async()=>{
  const f=fixture({rescue:true}),r=await f.executor().run(materials());
  assert.equal(r.status,'COMPLETED');assert.equal(r.transportSendAttempts,15);
  assert.equal(f.events.filter(e=>e[0]==='rescue-predicate').length,5);
  assert.equal(f.events.filter(e=>e[0]==='send'&&e[2]==='rescue_precision').length,5);
});
test('known primary truncation is retained unchanged, gets no new rescue eligibility, and advances only after accounting',async()=>{
  const f=fixture(),send=f.transport.send;
  f.transport.send=async a=>a.slot==='primary_precision'?truncated(await send(a)):send(a);
  const r=await f.executor().run(materials());
  assert.equal(r.status,'COMPLETED');assert.equal(r.transportSendAttempts,10);assert.equal(f.accounted.size,5);
  assert.equal(f.events.some(e=>e[0]==='rescue-predicate'||e[0]==='send'&&e[2]==='rescue_precision'),false);
  for(const c of f.finished){assert.equal(c.raw.primary_precision.status,'incomplete');assert.equal(c.raw.primary_precision.output_text,'{"synthetic":');}
  assert.ok([...f.states.values()].every(s=>s.rescue_precision==='voided'));
});
test('known main truncation retains both mandatory distinct receipts and original completed-primary rescue eligibility',async()=>{
  for(const rescue of [false,true]){
    const f=fixture({rescue}),send=f.transport.send;
    f.transport.send=async a=>a.slot==='main'?truncated(await send(a)):send(a);
    const r=await f.executor().run(materials());assert.equal(r.status,'COMPLETED');
    assert.equal(r.transportSendAttempts,rescue?15:10);assert.equal(f.accounted.size,5);
    assert.equal(f.events.filter(e=>e[0]==='rescue-predicate').length,5);
    assert.ok(f.finished.every(c=>c.raw.main.status==='incomplete'&&c.raw.primary_precision.status==='completed'));
    assert.ok([...f.states.values()].every(s=>s.main==='receipted'&&s.primary_precision==='receipted'
      &&s.rescue_precision===(rescue?'receipted':'voided')));
    for(const id of CONTINUATION_IDS){
      assert.deepEqual(f.events.filter(e=>e[0]==='send'&&e[1]===id).map(e=>e[2]),rescue?slots:slots.slice(0,2));
      const accountAt=f.events.findIndex(e=>e[0]==='account'&&e[1]===id);
      assert.ok(accountAt>f.events.findIndex(e=>e[0]==='receipt'&&e[1]===id&&e[2]==='primary_precision'));
      const next=CONTINUATION_IDS[CONTINUATION_IDS.indexOf(id)+1];
      if(next)assert.ok(accountAt<f.events.findIndex(e=>e[0]==='claim'&&e[1]===next));
    }
  }
});
test('known limits in both mandatory calls still account without a rescue or fabricated completion',async()=>{
  const f=fixture(),send=f.transport.send;f.transport.send=async a=>truncated(await send(a));
  const r=await f.executor().run(materials());assert.equal(r.status,'COMPLETED');assert.equal(r.transportSendAttempts,10);
  assert.equal(f.accounted.size,5);assert.equal(f.events.some(e=>e[0]==='rescue-predicate'),false);
  assert.ok(f.finished.every(c=>c.raw.main.status==='incomplete'&&c.raw.primary_precision.status==='incomplete'));
  assert.ok([...f.states.values()].every(s=>s.main==='receipted'&&s.primary_precision==='receipted'&&s.rescue_precision==='voided'));
});
test('truncated original rescue is retained without any further send or relabelling',async()=>{
  const f=fixture({rescue:true}),send=f.transport.send;
  f.transport.send=async a=>a.slot==='rescue_precision'?truncated(await send(a)):send(a);
  const r=await f.executor().run(materials());assert.equal(r.status,'COMPLETED');assert.equal(r.transportSendAttempts,15);
  assert.ok(f.finished.every(c=>c.raw.rescue_precision.status==='incomplete'));
});
test('unknown incomplete reasons, errors and refusals stop before another chart',async()=>{
  for(const edit of [r=>r.incomplete_details.reason='content_filter',r=>delete r.incomplete_details,
    r=>r.error={code:'synthetic'},r=>r.status='failed']){
    for(const failedSlot of ['main','primary_precision']){
      const f=fixture(),send=f.transport.send;
      f.transport.send=async a=>{const r=await send(a);if(a.slot!==failedSlot)return r;const failed=truncated(r);edit(failed);return failed;};
      const r=await f.executor().run(materials());assert.equal(r.status,failedSlot==='main'?'UNCERTAIN':'TECHNICAL_FAILURE');
      assert.equal(r.transportSendAttempts,failedSlot==='main'?1:2);
      assert.equal(f.events.filter(e=>e[0]==='claim').length,1);assert.equal(f.accounted.size,failedSlot==='main'?0:1);
      assert.equal(f.events.some(e=>e[0]==='send'&&e[2]==='rescue_precision'),false);
    }
  }
});
test('missing, mismatched or changed predecessor/source/run admission has no claim',async()=>{
  for(const edit of [b=>delete b.continuation_allowed,b=>b.prior_receipt_sha256='0'.repeat(64),
    b=>b.continuation_source_sha='d'.repeat(40),b=>b.continuation_run_id='50000000002',
    b=>b.continuation_case_ids.unshift('d001'),b=>{b.new_commitments_microusd++;b.remaining_microusd--;}]){
    const f=fixture(),b=balance(f.identity);edit(b);f.ledger.inspect=async()=>b;
    const r=await f.executor().run(materials());assert.equal(r.reason,'AUTHORITATIVE_HEADROOM_REFUSED');assert.deepEqual(f.events,[]);
  }
});
test('held-out, duplicated scope and modified request bytes refuse before effects',async()=>{
  for(const edit of [m=>m[0].caseId='e001',m=>m[1].caseId='d001',m=>m[5].requests.main.bytes.fill(0)]){
    const f=fixture(),m=materials();edit(m);const r=await f.executor().run(m);
    assert.equal(r.reason,'PREPARATION_REFUSED');assert.deepEqual(f.events,[]);
  }
});
test('lost submit acknowledgement never sends or voids possibly submitted request',async()=>{
  const f=fixture(),submit=f.ledger.submit;let calls=0;
  f.ledger.submit=async(...a)=>{calls++;await submit(...a);throw Error('synthetic-lost-ack');};
  const r=await f.executor().run(materials());assert.equal(r.status,'UNCERTAIN');assert.equal(calls,1);
  assert.equal(r.transportSendAttempts,0);assert.equal(f.states.get('d002').main,'submitted');
});
test('duplicate or denied case claim does not affect its owner',async()=>{
  const f=fixture();f.ledger.claim=async()=>({claim:{allowed:false,idempotent:true}});
  const r=await f.executor().run(materials());assert.equal(r.reason,'CLAIM_REFUSED');assert.equal(r.transportSendAttempts,0);
  assert.equal(f.events.some(e=>['void','account'].includes(e[0])),false);
});
test('transport failure and private retention failure are uncertain without replay',async()=>{
  for(const mode of ['transport','retention']){
    const f=fixture();if(mode==='transport')f.transport.send=async()=>{throw Error('synthetic');};
    else f.privateArtifacts.write=async()=>({retained:true,sha256:'0'.repeat(64)});
    const r=await f.executor().run(materials());assert.equal(r.status,'UNCERTAIN');assert.equal(r.transportSendAttempts,1);
    assert.equal(f.events.some(e=>e[0]==='receipt'),false);assert.equal(f.states.get('d002').main,'submitted');
  }
});
test('lost receipt or account acknowledgement prevents every later claim without repeating accounting',async()=>{
  for(const method of ['recordReceipt','account']){
    const f=fixture(),original=f.ledger[method];let calls=0;
    f.ledger[method]=async(...a)=>{calls++;await original(...a);throw Error('synthetic-lost-ack');};
    const r=await f.executor().run(materials());assert.equal(r.status,'UNCERTAIN');assert.equal(calls,1);
    assert.equal(f.events.filter(e=>e[0]==='claim').length,1);
  }
});
test('bad model, usage or duplicate response IDs cannot advance',async()=>{
  for(const edit of [r=>r.model='wrong',r=>r.usage.total_tokens++,r=>r.usage.output_tokens=7001]){
    const f=fixture(),send=f.transport.send;f.transport.send=async a=>{const r=await send(a);edit(r);return r;};
    assert.equal((await f.executor().run(materials())).status,'UNCERTAIN');
  }
  const f=fixture(),send=f.transport.send;f.transport.send=async a=>({...await send(a),id:'synthetic-duplicate'});
  const r=await f.executor().run(materials());assert.equal(r.status,'UNCERTAIN');assert.equal(r.transportSendAttempts,2);
});
test('cancellation before claim is inert and cancellation after submit preserves unknown exposure',async()=>{
  const f=fixture(),before=new AbortController();before.abort();
  assert.equal((await f.executor().run(materials(),{signal:before.signal})).status,'CANCELLED');assert.deepEqual(f.events,[]);
  const g=fixture(),during=new AbortController(),submit=g.ledger.submit;
  g.ledger.submit=async(...a)=>{const r=await submit(...a);during.abort();return r;};
  const r=await g.executor().run(materials(),{signal:during.signal});assert.equal(r.status,'UNCERTAIN');
  assert.equal(r.transportSendAttempts,0);assert.equal(g.states.get('d002').main,'submitted');
});
test('one executor instance and its snapshotted materials cannot be replayed or replaced',async()=>{
  const f=fixture(),m=materials(),inspect=f.ledger.inspect;
  f.ledger.inspect=async()=>{m[5].caseId='e001';m[5].requests.main.bytes.fill(0);return inspect();};
  const e=f.executor(),first=e.run(m);assert.equal((await e.run(materials())).reason,'EXECUTOR_ALREADY_USED');
  const r=await first;assert.equal(r.status,'COMPLETED');assert.equal(r.cases.at(-1).caseId,'d006');
});
test('diagnostic retention failure after accounting stops before the next chart',async()=>{
  const f=fixture(),write=f.privateArtifacts.write;
  f.privateArtifacts.write=async r=>{if(r.kind==='diagnostic-output')throw Error('synthetic');return write(r);};
  const r=await f.executor().run(materials());assert.equal(r.status,'TECHNICAL_FAILURE');assert.equal(f.accounted.size,1);
  assert.equal(f.events.filter(e=>e[0]==='claim').length,1);
});
