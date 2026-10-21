/** Focused orchestration boundaries. Every port, receipt and request is synthetic.
 * No private packet, provider client, credential or hosted ledger is used.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createSequentialFirstSixExecutor} from '../scripts/pocket-monaco-isolated-executor.mjs';
import {prepareFirstSixBootstrap,validatePrivateArtifactLocation} from '../scripts/pocket-monaco-executor-bootstrap.mjs';
import {PINS,validateSetupEvidence} from '../scripts/pocket-monaco-setup-preflight.mjs';

const ids=['d001','d002','d003','d004','d005','d006'];
const slots=['main','primary_precision','rescue_precision'];
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
function materials() {return ids.map(caseId=>({caseId,requests:Object.fromEntries(slots.map(slot=>{
  const bytes=Buffer.from(JSON.stringify({caseId,slot,synthetic:true}));
  return [slot,{bytes,sha256:hash(bytes),fingerprint:hash(`synthetic-${caseId}-${slot}`)}];
}))}));}
function fixture({rescue=false}={}) {
  const events=[],states=new Map(),accounted=new Set();
  const ledger={
    async inspect(){events.push(['inspect']);return {binding_matches:true,prior_exposure_microusd:0,new_commitments_microusd:0,remaining_microusd:5000000};},
    async claim(id){events.push(['claim',id]);assert.ok([...states.keys()].every(k=>accounted.has(k)));
      states.set(id,Object.fromEntries(slots.map(s=>[s,'reserved'])));
      return {claim:{allowed:true,status:'reserved',idempotent:false}};},
    async submit(id,slot){events.push(['submit',id,slot]);assert.equal(states.get(id)[slot],'reserved');
      states.get(id)[slot]='submitted';return {ok:true,status:'submitted',claimed:true};},
    async recordReceipt(id,slot,receipt){events.push(['receipt',id,slot]);assert.deepEqual(Object.keys(receipt).sort(),['model','requestId','responseId','serviceTier','usage']);
      assert.equal(states.get(id)[slot],'submitted');states.get(id)[slot]='receipted';return {ok:true,status:'submitted'};},
    async voidUnused(id,slot){events.push(['void',id,slot]);assert.equal(states.get(id)[slot],'reserved');states.get(id)[slot]='voided';return {ok:true,status:'voided'};},
    async account(id){events.push(['account',id]);const s=states.get(id);assert.equal(s.main,'receipted');assert.equal(s.primary_precision,'receipted');
      assert.ok(['receipted','voided'].includes(s.rescue_precision));accounted.add(id);
      return {accounted:true,accounting_status:'FULL_RESERVATION_HELD',financially_settled:false};},
  };
  const transport={async send({caseId,slot,requestBytes,requestSha256}){
    events.push(['send',caseId,slot]);assert.equal(hash(requestBytes),requestSha256);
    return {_request_id:`synthetic-req-${caseId}-${slot}`,id:`synthetic-resp-${caseId}-${slot}`,
      model:'gpt-5-mini-2025-08-07',service_tier:'default',usage:{input_tokens:1,output_tokens:1,total_tokens:2},
      status:'completed',output_text:JSON.stringify({synthetic:true,rescue})};
  }};
  const privateArtifacts={async write(record){events.push(['retain',record.caseId,record.slot,record.kind]);
    assert.equal(hash(record.bytes),record.sha256);return {retained:true,sha256:record.sha256};}};
  const prepare=input=>input;
  const needsRescue=text=>JSON.parse(text).rescue;
  const finishCase=()=>({evidenceKind:'SYNTHETIC_FIXTURE',expertAccepted:false});
  return {events,states,accounted,ledger,transport,privateArtifacts,prepare,needsRescue,finishCase,
    executor(overrides={}){return createSequentialFirstSixExecutor({...this,...overrides});}};
}

test('six charts run sequentially; raw retention precedes receipt, accounting precedes next claim',async()=>{
  const f=fixture(),result=await f.executor().run(materials());
  assert.equal(result.status,'COMPLETED');assert.equal(result.transportSendAttempts,12);assert.equal(result.cases.length,6);
  assert.equal(result.financiallySettled,false);assert.equal(result.actualMicroUsd,null);
  for(const id of ids)for(const slot of slots.slice(0,2)){
    const index=kind=>f.events.findIndex(e=>e[0]===kind&&e[1]===id&&e[2]===slot);
    assert.ok(index('submit')<index('send')&&index('send')<index('retain')&&index('retain')<index('receipt'));
  }
  assert.equal(JSON.stringify(result).includes('output_text'),false);
  assert.equal(JSON.stringify(result).includes('synthetic-req'),false);
});

test('existing injected rescue predicate is the only optional send; maximum path is18',async()=>{
  const f=fixture({rescue:true}),result=await f.executor().run(materials());
  assert.equal(result.status,'COMPLETED');assert.equal(result.transportSendAttempts,18);
  assert.equal(f.events.some(e=>e[0]==='void'),false);
});

test('unknown/held-out, duplicate scope and changed request bytes refuse before any effect',async()=>{
  for(const change of [m=>m[0].caseId='e001',m=>m[1].caseId='d001',m=>m[5].requests.main.bytes=Buffer.from('changed')]){
    const f=fixture(),m=materials();change(m);const result=await f.executor().run(m);
    assert.equal(result.reason,'PREPARATION_REFUSED');assert.deepEqual(f.events,[]);
  }
});

test('unknown balance and existing commitments leaving insufficient whole-run headroom refuse',async()=>{
  for(const b of [{}, {binding_matches:true,prior_exposure_microusd:3082400,new_commitments_microusd:1,remaining_microusd:1917599}]){
    const f=fixture();f.ledger.inspect=async()=>b;
    assert.equal((await f.executor().run(materials())).reason,'AUTHORITATIVE_HEADROOM_REFUSED');assert.deepEqual(f.events,[]);
  }
});

test('denied or duplicate claim cannot send or clean up another claim',async()=>{
  for(const reason of ['case_already_claimed','previous_case_unresolved']){
    const f=fixture();f.ledger.claim=async()=>({claim:{allowed:false,idempotent:reason==='case_already_claimed',reason}});
    const result=await f.executor().run(materials());assert.equal(result.reason,'CLAIM_REFUSED');
    assert.equal(result.transportSendAttempts,0);assert.equal(f.events.some(e=>['void','account'].includes(e[0])),false);
  }
});

test('lost submit acknowledgement never sends, retries or voids possibly submitted slot',async()=>{
  const f=fixture(),submit=f.ledger.submit;let attempts=0;
  f.ledger.submit=async(...args)=>{attempts++;await submit(...args);throw Error('SYNTHETIC-SENSITIVE-DRIVER-DETAIL');};
  const result=await f.executor().run(materials());assert.equal(result.status,'UNCERTAIN');assert.equal(attempts,1);
  assert.equal(result.transportSendAttempts,0);assert.equal(f.states.get('d001').main,'submitted');
  assert.equal(f.states.get('d001').primary_precision,'voided');assert.equal(JSON.stringify(result).includes('SENSITIVE'),false);
});

test('already-submitted acknowledgement claimed:false cannot trigger send',async()=>{
  const f=fixture();f.ledger.submit=async()=>({ok:true,status:'submitted',claimed:false});
  const result=await f.executor().run(materials());assert.equal(result.status,'UNCERTAIN');assert.equal(result.transportSendAttempts,0);
  assert.equal(f.events.some(e=>e[0]==='void'&&e[2]==='main'),false);
});

test('transport rejection keeps reserve and sends only once',async()=>{
  const f=fixture();let attempts=0;f.transport.send=async()=>{attempts++;throw Error('SYNTHETIC-SENSITIVE-TRANSPORT');};
  const result=await f.executor().run(materials());assert.equal(result.status,'UNCERTAIN');assert.equal(attempts,1);
  assert.equal(f.states.get('d001').main,'submitted');assert.equal(JSON.stringify(result).includes('SENSITIVE'),false);
});

test('failed private receipt persistence blocks receipt acknowledgement and next send',async()=>{
  for(const wrongAck of [false,true]){
    const f=fixture();f.privateArtifacts.write=async()=>{if(wrongAck)return {retained:true,sha256:'0'.repeat(64)};throw Error('unavailable');};
    const result=await f.executor().run(materials());assert.equal(result.status,'UNCERTAIN');assert.equal(result.transportSendAttempts,1);
    assert.equal(f.events.some(e=>e[0]==='receipt'),false);assert.equal(f.states.get('d001').main,'submitted');
  }
});

test('lost receipt acknowledgement retains private bytes and blocks every later send',async()=>{
  const f=fixture(),record=f.ledger.recordReceipt;let attempts=0;
  f.ledger.recordReceipt=async(...args)=>{attempts++;await record(...args);throw Error('lost ack');};
  const result=await f.executor().run(materials());assert.equal(result.status,'UNCERTAIN');assert.equal(attempts,1);
  assert.equal(result.transportSendAttempts,1);assert.ok(f.events.some(e=>e[0]==='retain'));
  assert.equal(f.events.some(e=>e[0]==='void'&&e[2]==='main'),false);
});

test('unknown account acknowledgement stops before next chart and never repeats account',async()=>{
  const f=fixture(),account=f.ledger.account;let attempts=0;
  f.ledger.account=async(...args)=>{attempts++;await account(...args);throw Error('lost ack');};
  const result=await f.executor().run(materials());assert.equal(result.status,'UNCERTAIN');assert.equal(attempts,1);
  assert.equal(result.transportSendAttempts,2);assert.equal(f.events.filter(e=>e[0]==='claim').length,1);
});

test('cancellation before claim has no effects; after claim voids only known unused slots',async()=>{
  const before=new AbortController();before.abort();const f=fixture();
  assert.equal((await f.executor().run(materials(),{signal:before.signal})).status,'CANCELLED');assert.deepEqual(f.events,[]);
  const controller=new AbortController(),g=fixture(),claim=g.ledger.claim;
  g.ledger.claim=async(...args)=>{const result=await claim(...args);controller.abort();return result;};
  const result=await g.executor().run(materials(),{signal:controller.signal});
  assert.equal(result.status,'CANCELLED');assert.equal(result.transportSendAttempts,0);
  assert.deepEqual(Object.values(g.states.get('d001')),['voided','voided','voided']);
  assert.equal(g.events.some(e=>e[0]==='account'),false);
});

test('cancellation after submit preserves reservation without a provider send',async()=>{
  const f=fixture(),controller=new AbortController(),submit=f.ledger.submit;
  f.ledger.submit=async(...args)=>{const result=await submit(...args);controller.abort();return result;};
  const result=await f.executor().run(materials(),{signal:controller.signal});
  assert.equal(result.status,'UNCERTAIN');assert.equal(result.transportSendAttempts,0);assert.equal(f.states.get('d001').main,'submitted');
});

test('caller mutation after admission cannot replace a later chart or request',async()=>{
  const f=fixture(),m=materials(),inspect=f.ledger.inspect;
  f.ledger.inspect=async()=>{m[5].caseId='e001';m[5].requests.main.bytes.fill(0);return inspect();};
  const result=await f.executor().run(m);assert.equal(result.status,'COMPLETED');assert.equal(result.cases[5].caseId,'d006');
});

test('one executor object cannot be replayed or used concurrently',async()=>{
  const f=fixture(),executor=f.executor(),first=executor.run(materials());
  assert.equal((await executor.run(materials())).reason,'EXECUTOR_ALREADY_USED');
  assert.equal((await first).status,'COMPLETED');assert.equal((await executor.run(materials())).reason,'EXECUTOR_ALREADY_USED');
});

test('invalid/incomplete/duplicate receipts stop with private evidence and no later send',async()=>{
  for(const edit of [r=>r.model='other',r=>r.usage.total_tokens=3,r=>r.status='incomplete']){
    const f=fixture(),send=f.transport.send;f.transport.send=async args=>{const r=await send(args);edit(r);return r;};
    const result=await f.executor().run(materials());assert.notEqual(result.status,'COMPLETED');
    assert.equal(result.transportSendAttempts,1);assert.ok(f.events.some(e=>e[0]==='retain'));
  }
  const f=fixture(),send=f.transport.send;
  f.transport.send=async args=>({...await send(args),_request_id:'synthetic-duplicate'});
  assert.equal((await f.executor().run(materials())).transportSendAttempts,2);
});

test('bootstrap missing existing evidence remains inert; ephemeral output cannot claim persistence',async()=>{
  const result=await prepareFirstSixBootstrap({config:{},evidence:{},context:{}});
  assert.equal(result.status,'HOLD');assert.equal('runOnce' in result,false);
  const evidence={processorSecurityAcceptance:{privateArtifactLocation:{directory:'/tmp',persistent:true,acceptanceRef:'synthetic'}}};
  assert.throws(()=>validatePrivateArtifactLocation(evidence,'/tmp'),/REFUSED/);
});

function boundEvidence() {
  const sha='a'.repeat(40),key='synthetic-phase-key';
  const config={environment:PINS.environment,invocationBranch:PINS.branch,reviewer:'nashysaimarkets',
    administratorBypass:false,repositoryTokenPermissions:{contents:'read'},
    concurrency:{group:'monaco-first-six-existing-five-dollar-allowance',cancelInProgress:false,maxChartsInFlight:1,maxCallsInFlight:1},
    acceptedRunAttempt:1,realDispatchEnabled:false,paidScopeReceipt:PINS.paidScopeReceipt,planSha256:PINS.planSha256,
    ledger:{provider:'Neon',backendRef:PINS.backend,organisationId:PINS.organization,projectId:PINS.projectId,
      branchId:PINS.branchId,endpointHost:PINS.host,databaseName:PINS.database,runtimeRole:PINS.role,maximumNewMonthlyCostUsd:0,plan:'free'},
    secrets:{newOpenAIKeyAllowed:false,existingInferenceKeyEnvironmentSecret:'MONACO_FIRST_SIX_OPENAI_API_KEY',
      isolatedLedgerCredentialEnvironmentSecret:'MONACO_FIRST_SIX_LEDGER_KEY',existingInferenceKeyTrackingId:PINS.keyTrackingId,existingInferenceProject:PINS.project}};
  const evidence={existingCredentialBinding:{verified:true,environment:PINS.environment,sourceSha:sha,backendRef:PINS.backend,
    projectRef:PINS.project,keyTrackingId:PINS.keyTrackingId,keyFingerprintSha256:hash(key),planSha256:PINS.planSha256,
    ledgerKey:'synthetic-existing-allowance',controlPlaneEvidenceSha256:'b'.repeat(64)},
    processorSecurityAcceptance:{securityApprovalRef:'synthetic',onBehalfAccepted:true,retentionAccepted:true,
      trainingAccepted:true,territoryAccepted:true,privateArtifactsAccepted:true},
    authoritativeBudgetCarryIn:{evidenceComplete:true,aggregateCapMicroUsd:PINS.cap,historicalAccountingKeptSeparate:true,
      cashAllowanceApproved:true,spentMicroUsd:1000000,reservedMicroUsd:500000,unresolvedMicroUsd:250000}};
  const context={repository:PINS.repository,event:'push',ref:'refs/heads/'+PINS.branch,runAttempt:'1',
    reviewedSourceSha:sha,sourceSha:sha,reviewedEvidenceSha:'d'.repeat(40),evidenceSha:'d'.repeat(40)};
  return {config,evidence,context};
}
test('setup default preserves disabled control; explicit execution phase requires existing paid scope',()=>{
  const f=boundEvidence();assert.doesNotThrow(()=>validateSetupEvidence(f.config,f.evidence,f.context));
  assert.throws(()=>validateSetupEvidence(f.config,f.evidence,f.context,'execution'),/PROTECTION_SCOPE/);
  f.config.realDispatchEnabled=true;
  assert.doesNotThrow(()=>validateSetupEvidence(f.config,f.evidence,f.context,'execution'));
  assert.throws(()=>validateSetupEvidence(f.config,f.evidence,f.context),/PROTECTION_SCOPE/);
  f.config.paidScopeReceipt='synthetic-other';
  assert.throws(()=>validateSetupEvidence(f.config,f.evidence,f.context,'execution'),/PAID_SCOPE/);
  assert.throws(()=>validateSetupEvidence(f.config,f.evidence,f.context,'unknown'),/PHASE_INVALID/);
});
test('otherwise complete disabled configuration cannot expose runOnce or even read a key',async()=>{
  const f=boundEvidence();let keyReads=0;
  const responsesClient={get apiKey(){keyReads++;throw Error('must not be read');}};
  const result=await prepareFirstSixBootstrap({...f,responsesClient});
  assert.equal(result.status,'HOLD');assert.equal('runOnce' in result,false);assert.equal(keyReads,0);
});
