/** Unmounted orchestration library. It constructs no client, reads no credential
 * or packet, and grants no execution authority. A protected caller must supply
 * the existing admitted ledger, a single-attempt transport and private retention.
 * The frozen production adapter is pocket-monaco-first-six-executor.ts; injected
 * preparations in unit tests are synthetic and cannot establish paid admission.
 */
import {createHash} from 'node:crypto';

const IDS = Object.freeze(['d001', 'd002', 'd003', 'd004', 'd005', 'd006']);
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

/** The transport returns the existing scanner receipt shape (_request_id, id,
 * model, service_tier, usage, status, output_text), with optional raw response
 * fields. The entire returned JSON is retained privately, never in the ledger or
 * returned summary. write() must durably retain immutable bytes before returning
 * {retained:true, sha256}; the digest is checked before advancing a call.
 */
export function createSequentialFirstSixExecutor({ledger, transport, privateArtifacts, prepare, needsRescue, finishCase}) {
  requireValue(['inspect', 'claim', 'submit', 'recordReceipt', 'voidUnused', 'account'].every(k => typeof ledger?.[k] === 'function'));
  requireValue(typeof transport?.send === 'function' && typeof privateArtifacts?.write === 'function'
    && typeof prepare === 'function' && typeof needsRescue === 'function' && typeof finishCase === 'function');
  let used = false;

  return Object.freeze({async run(input, {signal} = {}) {
    const summary = {kind:'UNMOUNTED_FIRST_SIX_EXECUTION', status:'HOLD', transportSendAttempts:0,
      providerAuthenticity:'NOT_ATTESTED_BY_EXECUTOR_LIBRARY', financiallySettled:false,
      actualMicroUsd:null, cases:[]};
    if (used) return {...summary, reason:'EXECUTOR_ALREADY_USED'};
    used = true; // Also excludes concurrent calls; SQL remains the durable replay guard.
    let prepared;
    try {
      // Snapshot all six before the first await. No packet loader or mutable input
      // can replace a later chart after its source/request checks have completed.
      prepared = structuredClone(prepare(structuredClone(input)));
      requireValue(Array.isArray(prepared) && JSON.stringify(prepared.map(c => c.caseId)) === JSON.stringify(IDS));
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
      const amounts = [b?.prior_exposure_microusd, b?.new_commitments_microusd, b?.remaining_microusd];
      requireValue(b?.binding_matches === true && amounts.every(money)
        && amounts.reduce((a, v) => a + v, 0) === 5000000 && b.remaining_microusd >= 1917600);
    } catch { return {...summary, reason:'AUTHORITATIVE_HEADROOM_REFUSED'}; }

    const requestIds = new Set(), responseIds = new Set();
    async function retain(c, kind, slot, bytes, request = undefined) {
      const sha256 = hash(bytes);
      const ack = await privateArtifacts.write({caseId:c.caseId, kind, slot, bytes:Uint8Array.from(bytes), sha256,
        ...(request ? {requestSha256:request.sha256, fingerprint:request.fingerprint} : {})});
      requireValue(ack?.retained === true && ack.sha256 === sha256);
      return sha256;
    }

    for (const c of prepared) {
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
        requireValue(response.status === 'completed');
        return response;
      }
      try {
        const ack = await ledger.claim(c.caseId);
        if (ack?.claim?.allowed === false) return {...summary, reason:'CLAIM_REFUSED'};
        requireValue(ack?.claim?.allowed === true && ack.claim.status === 'reserved' && ack.claim.idempotent === false);
        ownsClaim = true;
        await send('main');
        const precision = await send('primary_precision');
        if (needsRescue(precision.output_text)) await send('rescue_precision');
        stage = 'VOID';
        requireValue(await voidReserved());
        stage = 'ACCOUNT';
        await account();
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
    return {...summary, status:'COMPLETED'};
  }});
}
