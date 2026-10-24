/** Every request, receipt and ledger in this helper is synthetic. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {CONTINUATION,CONTINUATION_IDS} from '../../scripts/pocket-monaco-continuation-admission.mjs';
import {PINS} from '../../scripts/pocket-monaco-setup-preflight.mjs';
import {createContinuationExecutor} from '../../scripts/pocket-monaco-continuation-executor.mjs';
export const slots=['main','primary_precision','rescue_precision'];
export const hash=b=>createHash('sha256').update(b).digest('hex');
export function identity() {return {environment:PINS.environment,sourceSha:'b'.repeat(40),backendRef:PINS.backend,
  projectRef:PINS.project,keyTrackingId:PINS.keyTrackingId,keyFingerprintSha256:'f'.repeat(64),planSha256:PINS.planSha256,
  continuation:{originalSourceSha:CONTINUATION.originalSourceSha,originalRunId:CONTINUATION.originalRunId,
    evidenceSha:'c'.repeat(40),runId:'50000000001',runAttempt:'1',priorReceiptSha256:CONTINUATION.priorReceiptSha256}};}
export function balance(i=identity()) {return {ledger_key:'synthetic-existing-ledger',binding_matches:true,setup_only:true,
  prior_exposure_microusd:0,new_commitments_microusd:216800,remaining_microusd:4783200,
  continuation_allowed:true,continuation_case_ids:[...CONTINUATION_IDS],predecessor_source_sha:i.continuation.originalSourceSha,
  predecessor_run_id:i.continuation.originalRunId,prior_receipt_sha256:i.continuation.priorReceiptSha256,
  continuation_source_sha:i.sourceSha,continuation_run_id:i.continuation.runId,continuation_evidence_sha:i.continuation.evidenceSha,
  continuation_valid_until:'2030-01-01T00:00:00Z',continuation_previous_commitments_microusd:216800};}
export function materials() {return ['d001',...CONTINUATION_IDS].map(caseId=>({caseId,
  requests:Object.fromEntries(slots.map(slot=>{const bytes=Buffer.from(JSON.stringify({caseId,slot,synthetic:true}));
    return [slot,{bytes,sha256:hash(bytes),fingerprint:hash(`synthetic-${caseId}-${slot}`)}];}))}));}
export function fixture({rescue=false}={}) {
  const events=[],states=new Map(),accounted=new Set(),retained=[],finished=[];
  const f={events,states,accounted,retained,finished,identity:identity(),prepare:m=>m,
    ledger:{
      async inspect(){events.push(['inspect']);return balance(f.identity);},
      async claim(id){assert.ok(CONTINUATION_IDS.includes(id));assert.ok([...states.keys()].every(k=>accounted.has(k)));
        events.push(['claim',id]);assert.equal(states.has(id),false);states.set(id,Object.fromEntries(slots.map(s=>[s,'reserved'])));
        return {claim:{allowed:true,status:'reserved',idempotent:false}};},
      async submit(id,slot){events.push(['submit',id,slot]);assert.equal(states.get(id)[slot],'reserved');
        states.get(id)[slot]='submitted';return {ok:true,status:'submitted',claimed:true};},
      async recordReceipt(id,slot){events.push(['receipt',id,slot]);assert.equal(states.get(id)[slot],'submitted');
        states.get(id)[slot]='receipted';return {ok:true,status:'submitted'};},
      async voidUnused(id,slot){events.push(['void',id,slot]);assert.equal(states.get(id)[slot],'reserved');
        states.get(id)[slot]='voided';return {ok:true,status:'voided'};},
      async account(id){events.push(['account',id]);assert.ok(Object.values(states.get(id)).every(s=>['receipted','voided'].includes(s)));
        assert.equal(accounted.has(id),false);accounted.add(id);
        return {accounted:true,accounting_status:'FULL_RESERVATION_HELD',financially_settled:false};},
    },
    transport:{async send({caseId,slot,requestBytes,requestSha256}) {events.push(['send',caseId,slot]);
      assert.equal(hash(requestBytes),requestSha256);
      return {_request_id:`synthetic-req-${caseId}-${slot}`,id:`synthetic-resp-${caseId}-${slot}`,
        model:PINS.model,service_tier:'default',usage:{input_tokens:1,output_tokens:1,total_tokens:2},
        status:'completed',output_text:JSON.stringify({synthetic:true,rescue})};}},
    privateArtifacts:{async write(r){events.push(['retain',r.caseId,r.slot,r.kind]);assert.equal(hash(r.bytes),r.sha256);
      retained.push(structuredClone(r));return {retained:true,sha256:r.sha256};}},
    needsRescue(text){events.push(['rescue-predicate']);return JSON.parse(text).rescue;},
    finishCase(c,raw,latencyMs){finished.push({caseId:c.caseId,raw,latencyMs});
      return {kind:'SYNTHETIC_DIAGNOSTIC',providerOutcomes:Object.fromEntries(Object.entries(raw).map(([k,v])=>[k,v.status])),expertAccepted:false};},
    executor(overrides={}){return createContinuationExecutor({...f,...overrides});},
  };
  return f;
}
export function truncated(r) {return {...r,status:'incomplete',incomplete_details:{reason:'max_output_tokens'},error:null,
  usage:{input_tokens:2025,output_tokens:1400,total_tokens:3425,output_tokens_details:{reasoning_tokens:832}},output_text:'{"synthetic":'};}
