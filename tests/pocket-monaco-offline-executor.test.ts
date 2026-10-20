import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { OFFLINE_ONLY, MODEL, SLOTS, SOURCE_PINS, sha256, materialDigest, assertAdmission,
  createMockTransport,createDisposableStore,reopenDisposableStore,disposeStore,snapshot,
  runOfflineCase,recoverReceipt,needsRescue, type Admission,type Binding,type CaseMaterial,type MockStep } from '../scripts/pocket-monaco-offline-executor.ts';
const image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
const artifact=(text:string|Buffer)=>{const bytes=Buffer.from(text);return {bytes,sha256:sha256(bytes)};};
function material(caseId='d001'):CaseMaterial {
  const input={image,intention:'UNSURE',chartConfirmation:{contextMatch:'NOT_PROVIDED',instrument:'SYNTHETIC ENGINEERING FIXTURE',timeframe:'1m',currentPrice:'100'}};
  const requests=Object.fromEntries(SLOTS.map(slot=>{const e={model:MODEL,service_tier:'default',store:false,reasoning:{effort:'low'},max_output_tokens:slot==='main'?7000:1400,instructions:'SYNTHETIC ENGINEERING FIXTURE',input:[{role:'user',content:[{type:'input_text',text:'fixture'},{type:'input_image',image_url:image,detail:'high'}]}],text:{format:{type:'json_schema',name:'fixture',strict:true,schema:{type:'object'}}}};
    const bytes=Buffer.from(JSON.stringify(e));return [slot,{bytes,sha256:sha256(bytes),fingerprint:sha256(JSON.stringify(e,(_k,v)=>typeof v==='string'&&v.startsWith('data:image/')?`sha256:${sha256(v)}`:v))}];})) as unknown as CaseMaterial['requests'];
  return {caseId,scope:caseId.startsWith('d')?'A':'B',manifestSha256:sha256('SYNTHETIC manifest'),requests,artifacts:{input:artifact(JSON.stringify(input)),image:artifact(Buffer.from(image.split(',')[1]!,'base64')),bars:artifact('synthetic bars'),sourceZip:artifact('synthetic zip'),licence:artifact('synthetic licence'),calibration:artifact('synthetic calibration')}};
}
function bind(m:CaseMaterial):Admission {
  const ids=Array.from({length:m.scope==='A'?6:44},(_,i)=>`${m.scope==='A'?'d':'e'}${String(i+1).padStart(3,'0')}`);
  const binding:Binding={mode:OFFLINE_ONLY,scope:m.scope,caseIds:ids,manifestSha256:m.manifestSha256,candidateSha:'f5e820b0bd7bf095153e31d692a10fb3640ba16e',scannerSourcesSha256:sha256(JSON.stringify(SOURCE_PINS)),requestInventorySha256:sha256('synthetic requests'),referenceSha256:sha256('synthetic refs'),protocolSha256:sha256('synthetic rules'),freezeSha256:sha256('synthetic freeze'),model:MODEL,ledgerKey:`offline-${m.scope}`,capMicroUsd:m.scope==='A'?5000000:14062400,priorExposureMicroUsd:0,caseDigests:Object.fromEntries(ids.map(id=>[id,materialDigest(id===m.caseId?m:material(id))]))};
  return reviewed(binding);
}
function reviewed(binding:Binding):Admission{return {binding,reviews:['primary','independent','protocol','finance','security','run'].map(kind=>({kind:kind as Admission['reviews'][number]['kind'],reviewer:`SYNTHETIC-${kind}`,decision:'APPROVED',bindingSha256:sha256(JSON.stringify(binding)),evidenceSha256:sha256(`synthetic-${kind}`),syntheticEngineeringFixture:true}))};}
function receipt(id:string,output:unknown={currentPrice:'100',levels:[{price:'90'},{price:'110'}]}) {return {status:'completed',_request_id:`mock-req-${id}`,id:`mock-res-${id}`,model:MODEL,service_tier:'default',usage:{input_tokens:10,output_tokens:20,total_tokens:30},output_text:JSON.stringify(output)};}
function steps(id='one',rescue=false):MockStep[]{return [{slot:'main',response:receipt(`${id}-main`,{patterns:[],levels:[],evidenceQuality:{candlesReadable:true,scaleReadable:false}})},{slot:'primary_precision',response:receipt(`${id}-precision`,rescue?{currentPrice:'100',levels:[]}:{currentPrice:'100',levels:[{price:'90'},{price:'110'}]})},...(rescue?[{slot:'rescue_precision' as const,response:receipt(`${id}-rescue`)}]:[])];}
async function withStore(run:(s:ReturnType<typeof createDisposableStore>)=>Promise<void>){const store=createDisposableStore();try{await run(store);}finally{disposeStore(store);}}

test('offline API rejects unscoped admission, arbitrary transports and arbitrary storage before any claim',async()=>withStore(async store=>{
  const m=material(),mock=createMockTransport(steps());
  await assert.rejects(runOfflineCase({material:m,store,transport:mock.transport}),/Mandatory/);
  await assert.rejects(runOfflineCase({admission:bind(m),material:m,store,transport:{kind:OFFLINE_ONLY}}),/branded inert/);
  await assert.rejects(runOfflineCase({admission:bind(m),material:m,store:{kind:OFFLINE_ONLY,directory:'/tmp/live'},transport:mock.transport}),/disposable/);
  assert.equal(snapshot(store).events.length,0);assert.equal(mock.sends().length,0);
}));
for(const kind of ['primary','independent','protocol','finance','security','run'])test(`missing ${kind} stops before mock dispatch`,async()=>withStore(async store=>{
  const m=material(),a=bind(m),mock=createMockTransport(steps());a.reviews=a.reviews.filter(r=>r.kind!==kind);
  await assert.rejects(runOfflineCase({admission:a,material:m,store,transport:mock.transport}),/Missing bound/);assert.equal(snapshot(store).events.length,0);assert.deepEqual(mock.sends(),[]);
}));
for(const field of ['referenceSha256','protocolSha256','freezeSha256'] as const)test(`missing ${field} blocks`,()=>{const m=material(),a=bind(m);a.binding[field]=null;assert.throws(()=>assertAdmission(reviewed(a.binding),m),/missing/);});
test('review identities must differ and every review binds exact candidate/source/request/scope',()=>{
  const m=material(),a=bind(m);a.reviews[1]!.reviewer=a.reviews[0]!.reviewer;assert.throws(()=>assertAdmission(a,m),/Separate reference/);
  const b=bind(m);b.binding.requestInventorySha256=sha256('changed');assert.throws(()=>assertAdmission(b,m),/Missing bound/);
  for(const field of ['candidateSha','model','scannerSourcesSha256'] as const){const b=bind(m);b.binding[field]='changed';assert.throws(()=>assertAdmission(reviewed(b.binding),m),/Exact/);}
});
for(const name of ['input','image','bars','sourceZip','licence','calibration'] as const)test(`${name} byte tamper rejected`,()=>{const m=material(),a=bind(m);m.artifacts[name].bytes=Buffer.from('tampered');assert.throws(()=>assertAdmission(a,m),/hash mismatch/);});
for(const slot of SLOTS)test(`${slot} exact request/fingerprint tamper rejected`,()=>{let m=material(),a=bind(m);m.requests[slot].bytes=Buffer.from('{}');assert.throws(()=>assertAdmission(a,m),/request hash mismatch/);
  m=material();m.requests[slot].fingerprint=sha256('wrong');a=bind(m);assert.throws(()=>assertAdmission(a,m),/Spend fingerprint/);
});
test('model/tier/output/feature drift remains rejected even when fixture request digest is rebound',()=>{
  for(const patch of [{model:'wrong'},{service_tier:'auto'},{max_output_tokens:8000},{tools:[]}]){
    const m=material(),r=m.requests.main,e={...JSON.parse(Buffer.from(r.bytes).toString()),...patch};r.bytes=Buffer.from(JSON.stringify(e));r.sha256=sha256(r.bytes);r.fingerprint=sha256(JSON.stringify(e));
    assert.throws(()=>assertAdmission(bind(m),m),/Provider request|Benchmark|benchmark/);
  }
});
test('unknown headroom, budget expansion, insufficient aggregate A and borrowing A for B all fail',()=>{
  for(const prior of [null,3100000]){const m=material(),a=bind(m);a.binding.priorExposureMicroUsd=prior;assert.throws(()=>assertAdmission(reviewed(a.binding),m),/budget|headroom/i);}
  for(const scope of ['d001','e001']){const m=material(scope),a=bind(m);a.binding.capMicroUsd++;assert.throws(()=>assertAdmission(reviewed(a.binding),m),/budget/);}
  const m=material('e001'),a=bind(m);a.binding.ledgerKey='offline-A';assert.throws(()=>assertAdmission(reviewed(a.binding),m),/Separate budget/);
  a.binding.ledgerKey='offline-B';a.binding.capMicroUsd=5000000;assert.throws(()=>assertAdmission(reviewed(a.binding),m),/budget/);
});
test('complete three-call reservation precedes dispatch; rescue is voided only when not required',async()=>withStore(async store=>{
  const m=material(),mock=createMockTransport(steps()),out=await runOfflineCase({admission:bind(m),material:m,store,transport:mock.transport});
  assert.equal(out.status,'MOCK_COMPLETE');assert.equal(out.providerCalls,0);const s=snapshot(store),c=s.cases.d001!;
  assert.equal(s.events[0]!.rpc,'claim_pocket_benchmark_case');assert.equal(c.calls.rescue_precision.status,'voided');assert.equal(c.calls.main.cost,114000);
  assert.equal(c.budgetAccounted,true);assert.equal(s.activeCase,null);assert.deepEqual(mock.sends(),['main','primary_precision']);assert.ok(c.latencyMs!>=0);assert.equal(Object.keys(c.raw).length,2);
}));
test('conditional rescue uses third slot once, no retry or alternate model',async()=>withStore(async store=>{
  const m=material(),mock=createMockTransport(steps('rescue',true));await runOfflineCase({admission:bind(m),material:m,store,transport:mock.transport});
  assert.deepEqual(mock.sends(),SLOTS);assert.equal(snapshot(store).cases.d001!.calls.rescue_precision.status,'submitted');
}));
test('conditional precision mirrors pinned scanner price rules and does not rescue malformed output',()=>{
  for(const v of [{currentPrice:'100',levels:[]},{currentPrice:'?',levels:[{price:'90'}]},{currentPrice:'100',levels:[{price:'90'}]}])assert.equal(needsRescue(JSON.stringify(v)),true);
  for(const v of ['bad','null','{}',JSON.stringify({currentPrice:'1,000',levels:[{price:'900'},{price:'1,100'}]})])assert.equal(needsRescue(v),false);
});
test('duplicates stay rejected after reopen; approved budgets cannot be reset or reassigned',async()=>withStore(async store=>{
  const m=material();await runOfflineCase({admission:bind(m),material:m,store,transport:createMockTransport(steps()).transport});
  const reopened=reopenDisposableStore(store.directory);await assert.rejects(runOfflineCase({admission:bind(m),material:m,store:reopened,transport:createMockTransport(steps()).transport}),/Duplicate/);
  const n=material('d002'),a=bind(n);a.binding.priorExposureMicroUsd=1;
  await assert.rejects(runOfflineCase({admission:reviewed(a.binding),material:n,store:reopened,transport:createMockTransport(steps()).transport}),/reseeded/);
}));
test('A and B budgets persist independently without widening legacy A cap',async()=>withStore(async store=>{
  for(const id of ['d001','e001']){const m=material(id);await runOfflineCase({admission:bind(m),material:m,store,transport:createMockTransport(steps(id)).transport});}
  const s=snapshot(store);assert.equal(s.bindings.A!.capMicroUsd,5000000);assert.equal(s.bindings.B!.capMicroUsd,14062400);assert.equal(s.cases.d001!.scope,'A');assert.equal(s.cases.e001!.scope,'B');
}));
test('global one-chart lease prevents cross-scope concurrency, no second mock send',async()=>withStore(async store=>{
  const m=material(),script=steps();script[0]!.pause=true;const mock=createMockTransport(script),pending=runOfflineCase({admission:bind(m),material:m,store,transport:mock.transport});
  assert.equal(snapshot(store).activeCase,'d001');const n=material('e001'),other=createMockTransport(steps('other'));
  await assert.rejects(runOfflineCase({admission:bind(n),material:n,store,transport:other.transport}),/One-chart/);assert.deepEqual(other.sends(),[]);
  mock.release();await pending;
}));
test('pre-cancellation does not claim or dispatch',async()=>withStore(async store=>{const ac=new AbortController();ac.abort();const m=material(),mock=createMockTransport(steps());
  const out=await runOfflineCase({admission:bind(m),material:m,store,transport:mock.transport,signal:ac.signal});assert.equal(out.status,'CANCELLED_BEFORE_CLAIM');assert.deepEqual(mock.sends(),[]);assert.equal(snapshot(store).events.length,0);
}));
test('cancellation after submission retains charge, voids unsent slots and blocks next chart',async()=>withStore(async store=>{
  const ac=new AbortController(),m=material(),script=steps();script[0]!.pause=true;const mock=createMockTransport(script);
  const promise=runOfflineCase({admission:bind(m),material:m,store,transport:mock.transport,signal:ac.signal});ac.abort();const out=await promise;mock.release();
  assert.equal(out.status,'UNCERTAIN');const s=snapshot(store);assert.equal(s.cases.d001!.cancelled,true);assert.equal(s.cases.d001!.calls.main.status,'submitted');assert.equal(s.cases.d001!.calls.primary_precision.status,'voided');assert.equal(s.activeCase,'d001');assert.equal(s.cases.d001!.budgetAccounted,false);
  const n=material('d002');await assert.rejects(runOfflineCase({admission:bind(n),material:n,store,transport:createMockTransport(steps()).transport}),/One-chart/);
}));
test('uncertain transport, invalid usage and missing receipt stay unmeasured and reserved',async()=>{
  for(const bad of [{fail:'transport'},{response:{...receipt('bad'),usage:{input_tokens:10,output_tokens:20,total_tokens:0}}},{}])await withStore(async store=>{
    const m=material(),mock=createMockTransport([{slot:'main',...bad} as MockStep]);const out=await runOfflineCase({admission:bind(m),material:m,store,transport:mock.transport});
    assert.equal(out.status,'UNCERTAIN');assert.equal(out.measurement,'UNMEASURED');assert.equal(snapshot(store).activeCase,'d001');assert.equal(snapshot(store).cases.d001!.budgetAccounted,false);
  });
});
test('receipt recovery survives restart, binds exact request, is idempotent and never redispatches or settles dollars',async()=>withStore(async store=>{
  const m=material(),script=steps('lost');script[1]!.fail='lost_receipt';const mock=createMockTransport(script);
  const out=await runOfflineCase({admission:bind(m),material:m,store,transport:mock.transport});assert.equal(out.status,'UNCERTAIN');
  const reopened=reopenDisposableStore(store.directory),r=m.requests.primary_precision,rec=script[1]!.response!;
  assert.throws(()=>recoverReceipt(reopened,'d001','primary_precision',sha256('wrong'),r.fingerprint,rec),/binding/);
  const recovered=recoverReceipt(reopened,'d001','primary_precision',r.sha256,r.fingerprint,rec);assert.equal(recovered.financiallySettled,false);assert.equal(recovered.actualMicroUsd,null);assert.equal(recovered.measurement,'UNMEASURED');
  recoverReceipt(reopened,'d001','primary_precision',r.sha256,r.fingerprint,rec);
  assert.throws(()=>recoverReceipt(reopened,'d001','primary_precision',r.sha256,r.fingerprint,{...rec,output_text:'changed'}),/Immutable/);
  const s=snapshot(reopened);assert.equal(s.activeCase,null);assert.equal(s.cases.d001!.status,'UNCERTAIN');assert.deepEqual(mock.sends(),['main','primary_precision']);
}));
test('recovered receipt for cancelled partial base path cannot bypass existing two-pass accounting gate',async()=>withStore(async store=>{
  const m=material(),mock=createMockTransport([{slot:'main',fail:'lost_receipt',response:receipt('partial')}]);await runOfflineCase({admission:bind(m),material:m,store,transport:mock.transport});
  const r=m.requests.main;recoverReceipt(store,'d001','main',r.sha256,r.fingerprint,receipt('partial'));assert.equal(snapshot(store).activeCase,'d001');assert.equal(snapshot(store).cases.d001!.budgetAccounted,false);
}));
test('raw receipt identity reuse across calls is rejected and charged exposure retained',async()=>withStore(async store=>{
  const m=material(),dup=receipt('same');const out=await runOfflineCase({admission:bind(m),material:m,store,transport:createMockTransport([{slot:'main',response:dup},{slot:'primary_precision',response:dup}]).transport});
  assert.equal(out.status,'UNCERTAIN');assert.equal(snapshot(store).cases.d001!.calls.primary_precision.receipt,undefined);
}));
test('malformed main response is a technical failure, not a measured abstention',async()=>withStore(async store=>{
  const m=material(),script=steps('malformed');script[0]!.response!.output_text='not-json';const out=await runOfflineCase({admission:bind(m),material:m,store,transport:createMockTransport(script).transport});
  assert.equal(out.status,'TECHNICAL_FAILURE');assert.equal(out.measurement,'UNMEASURED');assert.equal(snapshot(store).cases.d001!.budgetAccounted,true);
}));
test('journal checksum and stale transaction lock fail closed',async()=>withStore(async store=>{
  const path=join(store.directory,'journal.json'),original=readFileSync(path,'utf8'),wrapper=JSON.parse(original);wrapper.state.activeCase='forged';writeFileSync(path,JSON.stringify(wrapper));assert.throws(()=>reopenDisposableStore(store.directory),/integrity/);writeFileSync(path,original);
  mkdirSync(join(store.directory,'lock'));const m=material(),mock=createMockTransport(steps());await assert.rejects(runOfflineCase({admission:bind(m),material:m,store,transport:mock.transport}),/EEXIST/);assert.deepEqual(mock.sends(),[]);rmSync(join(store.directory,'lock'),{recursive:true});
}));
test('adapter stays unmounted, does not offer live callbacks or import network/client code',()=>{
  const source=readFileSync(new URL('../scripts/pocket-monaco-offline-executor.ts',import.meta.url),'utf8');
  assert.doesNotMatch(source,/\bfetch\s*\(|\bhttps?\.request|createAdminClient|createOpenAIClient|process\.env|withPocketTestSpendScope\(/);
  const route=readFileSync(new URL('../app/api/pocket/analyse/route.ts',import.meta.url),'utf8');assert.doesNotMatch(route,/monaco-offline-executor/);
  assert.throws(()=>createMockTransport([{slot:'main',response:(()=>{}) as never}]),/Mock data only/);
});
test('old idempotent receipt replay cannot release a newer chart lease',async()=>withStore(async store=>{
  const m=material(),first=steps('old');await runOfflineCase({admission:bind(m),material:m,store,transport:createMockTransport(first).transport});
  const n=material('d002'),second=steps('new');second[0]!.pause=true;const mock=createMockTransport(second),pending=runOfflineCase({admission:bind(n),material:n,store,transport:mock.transport});
  const r=m.requests.main;recoverReceipt(store,'d001','main',r.sha256,r.fingerprint,first[0]!.response!);assert.equal(snapshot(store).activeCase,'d002');mock.release();await pending;
}));
test('mock accessors and toJSON are rejected without evaluating their code',()=>{
  let effects=0;const getter={slot:'main',get response(){effects++;return receipt('accessor');}};
  assert.throws(()=>createMockTransport([getter as MockStep]),/accessors/);assert.equal(effects,0);
  const json={slot:'main',toJSON(){effects++;return {slot:'main',response:receipt('json')};}};
  assert.throws(()=>createMockTransport([json as MockStep]),/executable/);assert.equal(effects,0);
});
test('exported scanner pins and call slots are immutable runtime authority',()=>{
  const key=Object.keys(SOURCE_PINS)[0]!;assert.throws(()=>{delete (SOURCE_PINS as Record<string,string>)[key];},TypeError);
  assert.throws(()=>{(SLOTS as unknown as string[]).push('extra');},TypeError);assert.equal(SLOTS.length,3);
});
test('incomplete response usage is retained but never called a completed analysis',async()=>withStore(async store=>{
  const m=material(),script=steps('incomplete');script[0]!.response!.status='incomplete';const out=await runOfflineCase({admission:bind(m),material:m,store,transport:createMockTransport(script).transport});
  assert.equal(out.status,'TECHNICAL_FAILURE');assert.equal(out.measurement,'UNMEASURED');assert.equal(snapshot(store).cases.d001!.raw.main!.status,'incomplete');assert.equal(snapshot(store).cases.d001!.budgetAccounted,true);
}));
test('mock proxy is rejected without executing traps',()=>{
  let effects=0;const step=new Proxy({slot:'main'},{getPrototypeOf(){effects++;return Object.prototype;}});
  assert.throws(()=>createMockTransport([step as MockStep]),/proxies/);assert.equal(effects,0);
});
test('replacing caller signal/store after admission cannot bypass original cancellation',async()=>withStore(async store=>{
  const ac=new AbortController(),m=material(),script=steps('mutable');script[0]!.pause=true;const mock=createMockTransport(script);
  const args={admission:bind(m),material:m,store,transport:mock.transport,signal:ac.signal};const pending=runOfflineCase(args);
  args.signal=new AbortController().signal;args.store={kind:OFFLINE_ONLY,directory:'/tmp/not-the-store'};ac.abort();const out=await pending;mock.release();
  assert.equal(out.status,'UNCERTAIN');assert.equal(snapshot(store).cases.d001!.cancelled,true);assert.deepEqual(mock.sends(),['main']);
}));
