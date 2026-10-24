/** Explicit continuation for d002-d006 only. All six frozen materials are
 * verified, but d001 is never claimed, submitted, voided or re-accounted.
 * A known max-output-token response remains incomplete. Only its retained
 * receipt and acknowledged accounting permit an honest unmeasured result and
 * the next untouched chart. Unknown effects remain terminal, without replay. */
import {createHash} from 'node:crypto';
import {CONTINUATION,CONTINUATION_IDS,validateContinuationIdentity,validateContinuationInspection}
  from './pocket-monaco-continuation-admission.mjs';

const ALL_IDS = Object.freeze(['d001', ...CONTINUATION_IDS]);
const SLOTS = Object.freeze(['main', 'primary_precision', 'rescue_precision']);
const MODEL = 'gpt-5-mini-2025-08-07';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const money = value => Number.isSafeInteger(value) && value >= 0;
const requireValue = value => { if (!value) throw Error('EXECUTOR_BOUNDARY_REFUSED'); };
const receiptValid = (r, slot) => r && typeof r._request_id === 'string' && r._request_id.trim()
  && typeof r.id === 'string' && r.id.trim() && r.model === MODEL && r.service_tier === 'default'
  && money(r.usage?.input_tokens) && money(r.usage?.output_tokens) && money(r.usage?.total_tokens)
  && r.usage.input_tokens + r.usage.output_tokens === r.usage.total_tokens
  && r.usage.total_tokens <= 400000 && r.usage.output_tokens <= (slot === 'main' ? 7000 : 1400)
  && typeof r.output_text === 'string';

export const isKnownOutputLimit = r => r?.status==='incomplete'
  && r.incomplete_details?.reason==='max_output_tokens'
  && Object.keys(r.incomplete_details).length===1 && (r.error===null || r.error===undefined);

/** The transport returns the existing scanner receipt shape (_request_id, id,
 * model, service_tier, usage, status, output_text), with optional raw response
 * fields. The entire returned JSON is retained privately, never in the ledger or
 * returned summary. write() must durably retain immutable bytes before returning
 * {retained:true, sha256}; the digest is checked before advancing a call.
 */
export function createContinuationExecutor({ledger, transport, privateArtifacts, prepare, needsRescue, finishCase, identity}) {
  const bound=validateContinuationIdentity(identity);
  requireValue(['inspect', 'claim', 'submit', 'recordReceipt', 'voidUnused', 'account'].every(k => typeof ledger?.[k] === 'function'));
  requireValue(typeof transport?.send === 'function' && typeof privateArtifacts?.write === 'function'
    && typeof prepare === 'function' && typeof needsRescue === 'function' && typeof finishCase === 'function');
  let used = false;

  return Object.freeze({async run(input, {signal} = {}) {
    const summary = {kind:'FIRST_SIX_CONTINUATION_EXECUTION', status:'HOLD', transportSendAttempts:0,
      providerAuthenticity:'NOT_ATTESTED_BY_EXECUTOR_LIBRARY', financiallySettled:false,
      actualMicroUsd:null, predecessorRunId:CONTINUATION.originalRunId,
      previousTransportSendAttempts:CONTINUATION.previousTransportSendAttempts, cases:[]};
    if (used) return {...summary, reason:'EXECUTOR_ALREADY_USED'};
    used = true; // Also excludes concurrent calls; SQL remains the durable replay guard.
    let prepared;
    try {
      // Snapshot all six before the first await. No packet loader or mutable input
      // can replace a later chart after its source/request checks have completed.
      prepared = structuredClone(prepare(structuredClone(input)));
      requireValue(Array.isArray(prepared) && JSON.stringify(prepared.map(c => c.caseId)) === JSON.stringify(ALL_IDS));
      for (const c of prepared) {
        requireValue(JSON.stringify(Object.keys(c.requests).sort()) === JSON.stringify([...SLOTS].sort()));
        for (const slot of SLOTS) {
          const r = c.requests[slot];
          requireValue(r.bytes instanceof Uint8Array && hash(r.bytes) === r.sha256 && /^[a-f0-9]{64}$/.test(r.fingerprint));
        }
      }
    } catch { return {...summary, reason:'PREPARATION_REFUSED'}; }
    if (signal?.aborted) return {...summary, status:'CANCELLED', reason:'CANCELLED_BEFORE_CLAIM'};
    try {
      const b = await ledger.inspect();
      validateContinuationInspection(b,bound,{initial:true});
    } catch { return {...summary, reason:'AUTHORITATIVE_HEADROOM_REFUSED'}; }

    const requestIds = new Set(), responseIds = new Set();
    async function retain(c, kind, slot, bytes, request = undefined) {
      const sha256 = hash(bytes);
      const ack = await privateArtifacts.write({caseId:c.caseId, kind, slot, bytes:Uint8Array.from(bytes), sha256,
        ...(request ? {requestSha256:request.sha256, fingerprint:request.fingerprint} : {})});
      requireValue(ack?.retained === true && ack.sha256 === sha256);
      return sha256;
    }

    for (const c of prepared.filter(c=>CONTINUATION_IDS.includes(c.caseId))) {
      if (signal?.aborted) return {...summary, status:'CANCELLED', reason:'CANCELLED_BEFORE_CLAIM'};
      const started = performance.now();
      const state = Object.fromEntries(SLOTS.map(s => [s, 'reserved']));
      const raw = {}, rawSha256 = {};
      let ownsClaim = false, stage = 'CLAIM', accountingAttempted = false, accounted = false;
      async function voidReserved() {
        let confirmed = true;
        for (const slot of SLOTS) if (state[slot] === 'reserved') {
          state[slot] = 'void_pending';
          try {
            const ack = await ledger.voidUnused(c.caseId, slot);
            requireValue(ack?.ok === true && ack.status === 'voided');
            state[slot] = 'voided';
          } catch { confirmed = false; }
        }
        return confirmed;
      }
      async function account() {
        accountingAttempted = true;
        const ack = await ledger.account(c.caseId);
        requireValue(ack?.accounted === true && ack.accounting_status === 'FULL_RESERVATION_HELD'
          && ack.financially_settled === false);
        accounted = true;
      }
      async function send(slot) {
        requireValue(!signal?.aborted);
        const request = c.requests[slot];
        stage = 'SUBMIT';
        state[slot] = 'submit_pending'; // Never void or retry after an ambiguous acknowledgement.
        const submitted = await ledger.submit(c.caseId, slot, request.fingerprint);
        requireValue(submitted?.ok === true && submitted.status === 'submitted' && submitted.claimed === true);
        state[slot] = 'submitted';
        requireValue(!signal?.aborted);
        stage = 'TRANSPORT';
        summary.transportSendAttempts++;
        const response = structuredClone(await transport.send({caseId:c.caseId, slot,
          requestBytes:Uint8Array.from(request.bytes), requestSha256:request.sha256,
          fingerprint:request.fingerprint, signal}));
        stage = 'PRIVATE_RECEIPT';
        const bytes = Buffer.from(JSON.stringify(response));
        rawSha256[slot] = await retain(c, 'provider-response', slot, bytes, request);
        stage = 'RECEIPT';
        requireValue(receiptValid(response, slot) && !requestIds.has(response._request_id) && !responseIds.has(response.id));
        const ack = await ledger.recordReceipt(c.caseId, slot, {requestId:response._request_id, responseId:response.id,
          model:response.model, serviceTier:response.service_tier,
          usage:{input_tokens:response.usage.input_tokens, output_tokens:response.usage.output_tokens, total_tokens:response.usage.total_tokens}});
        requireValue(ack?.ok === true && ack.status === 'submitted');
        state[slot] = 'receipted';
        requestIds.add(response._request_id); responseIds.add(response.id);
        raw[slot] = response;
        requireValue(!signal?.aborted);
        stage = 'RESPONSE_STATUS';
        requireValue(response.status === 'completed' || isKnownOutputLimit(response));
        return response;
      }
      try {
        const ack = await ledger.claim(c.caseId);
        if (ack?.claim?.allowed === false) return {...summary, reason:'CLAIM_REFUSED'};
        requireValue(ack?.claim?.allowed === true && ack.claim.status === 'reserved' && ack.claim.idempotent === false);
        ownsClaim = true;
        const main = await send('main');
        if(main.status==='completed') {
          const precision = await send('primary_precision');
          // Keep the original frozen predicate and its completed-response scope.
          // Truncated JSON never creates new rescue eligibility.
          if(precision.status==='completed' && needsRescue(precision.output_text)) await send('rescue_precision');
        }
        stage = 'VOID';
        requireValue(await voidReserved());
        stage = 'ACCOUNT';
        await account();
        requireValue(!signal?.aborted);
        stage = 'DIAGNOSTICS';
        const latencyMs = performance.now() - started;
        const diagnostics = finishCase(structuredClone(c), structuredClone(raw), latencyMs);
        requireValue(diagnostics && typeof diagnostics === 'object' && typeof diagnostics.then !== 'function');
        const diagnosticSha256 = await retain(c, 'diagnostic-output', null,
          Buffer.from(JSON.stringify({diagnostics, rawSha256, latencyMs})));
        summary.cases.push({caseId:c.caseId, status:'DIAGNOSTIC_RETAINED', diagnosticSha256, rawSha256,
          financiallySettled:false});
      } catch {
        // Cleanup belongs only to a fresh, acknowledged claim. It never touches
        // duplicate/unknown claims or a submitted/possibly submitted reservation.
        if (ownsClaim) await voidReserved();
        if (ownsClaim && Object.values(state).every(s => s==='voided')) {
          const status = signal?.aborted ? 'CANCELLED' : 'TECHNICAL_FAILURE';
          summary.cases.push({caseId:c.caseId,status,stage,rawSha256,financiallySettled:false});
          return {...summary,status,reason:'STOPPED_WITHOUT_REPLAY'};
        }
        const certain = ownsClaim && Object.values(state).every(s => ['receipted', 'voided'].includes(s));
        if (certain && !accountingAttempted) {
          try { await account(); } catch { /* No retry. */ }
        }
        const uncertain = !ownsClaim || !certain || !accounted;
        const status = uncertain ? 'UNCERTAIN' : signal?.aborted ? 'CANCELLED' : 'TECHNICAL_FAILURE';
        summary.cases.push({caseId:c.caseId, status, stage, rawSha256, financiallySettled:false});
        return {...summary, status, reason:'STOPPED_WITHOUT_REPLAY'};
      }
    }
    requireValue(summary.cases.length===CONTINUATION_IDS.length && summary.transportSendAttempts<=CONTINUATION.maximumAdditionalSends);
    return {...summary, status:'COMPLETED'};
  }});
}
