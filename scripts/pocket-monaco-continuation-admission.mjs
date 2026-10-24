/** Exact successor admission for the five untouched requests sets. Import is
 * inert. The original source, binding, d001 receipts and allowance stay intact.
 * Declarations never replace the matching append-only database authorization.
 */
import {validateSetupEvidence,PINS} from './pocket-monaco-setup-preflight.mjs';

export const CONTINUATION = Object.freeze({
  mode:'CONTINUATION_D002_D006',
  kind:'MONACO_FIRST_SIX_CONTINUATION_V1',
  originalSourceSha:'9e82c6d25dcb7f589e2328b2efc7910033d8fcdc',
  originalRunId:'40083992183',
  priorReceiptSha256:'bbb220a3e7b80611a17679e23454bfbc78aa16bad9580fa322c54312a59b9727',
  priorCommittedMicroUsd:216800,
  previousTransportSendAttempts:2,
  maximumAdditionalSends:15,
  maximumAdditionalExposureMicroUsd:1598000,
  maximumCombinedSends:17,
  maximumCombinedExposureMicroUsd:1814800,
});
export const CONTINUATION_IDS=Object.freeze(['d002','d003','d004','d005','d006']);
const need=ok=>{if(!ok)throw Error('CONTINUATION_BINDING_REFUSED');};
const equalIds=ids=>JSON.stringify(ids)===JSON.stringify(CONTINUATION_IDS);

export function validateContinuationEvidence(config,evidence,context) {
  const admission=validateSetupEvidence(config,evidence,context,'execution');
  const c=evidence?.continuationAdmission;
  need(config.executionMode===CONTINUATION.mode && c?.kind===CONTINUATION.kind
    && equalIds(c.remainingCaseIds) && c.originalCaseImmutable===true
    && Object.entries(CONTINUATION).filter(([k])=>!['mode','kind'].includes(k)).every(([k,v])=>c[k]===v)
    && context.sourceSha!==CONTINUATION.originalSourceSha
    && typeof context.runId==='string' && /^[1-9][0-9]{0,19}$/.test(context.runId)
    && context.runId!==CONTINUATION.originalRunId && context.runAttempt==='1');
  return {...admission,identity:{...admission.identity,continuation:{
    originalSourceSha:c.originalSourceSha,originalRunId:c.originalRunId,
    evidenceSha:context.reviewedEvidenceSha,runId:context.runId,runAttempt:context.runAttempt,
    priorReceiptSha256:c.priorReceiptSha256,
  }}};
}

export function validateContinuationIdentity(identity) {
  const keys=['environment','sourceSha','backendRef','projectRef','keyTrackingId','keyFingerprintSha256','planSha256','continuation'];
  const c=identity?.continuation;
  need(identity && JSON.stringify(Object.keys(identity).sort())===JSON.stringify(keys.sort())
    && identity.environment===PINS.environment && identity.backendRef===PINS.backend
    && identity.projectRef===PINS.project && identity.keyTrackingId===PINS.keyTrackingId
    && /^[a-f0-9]{40}$/.test(identity.sourceSha) && identity.sourceSha!==CONTINUATION.originalSourceSha
    && /^[a-f0-9]{64}$/.test(identity.keyFingerprintSha256) && identity.planSha256===PINS.planSha256
    && c && JSON.stringify(Object.keys(c).sort())===JSON.stringify(['originalSourceSha','originalRunId','evidenceSha','runId','runAttempt','priorReceiptSha256'].sort())
    && c.originalSourceSha===CONTINUATION.originalSourceSha && c.originalRunId===CONTINUATION.originalRunId
    && c.priorReceiptSha256===CONTINUATION.priorReceiptSha256 && /^[a-f0-9]{40}$/.test(c.evidenceSha)
    && typeof c.runId==='string' && /^[1-9][0-9]{0,19}$/.test(c.runId)
    && c.runId!==c.originalRunId && c.runAttempt==='1');
  return structuredClone(identity);
}

export function validateContinuationInspection(balance,identity,{initial=false}={}) {
  const i=validateContinuationIdentity(identity),c=i.continuation;
  const amounts=[balance?.prior_exposure_microusd,balance?.new_commitments_microusd,balance?.remaining_microusd];
  need(balance?.binding_matches===true && balance.setup_only===true
    && amounts.every(n=>Number.isSafeInteger(n)&&n>=0) && amounts.reduce((a,b)=>a+b,0)===PINS.cap
    && balance.continuation_allowed===true && equalIds(balance.continuation_case_ids)
    && balance.predecessor_source_sha===c.originalSourceSha && balance.predecessor_run_id===c.originalRunId
    && balance.prior_receipt_sha256===c.priorReceiptSha256 && balance.continuation_source_sha===i.sourceSha
    && balance.continuation_run_id===c.runId && balance.continuation_evidence_sha===c.evidenceSha
    && balance.continuation_previous_commitments_microusd===CONTINUATION.priorCommittedMicroUsd
    && typeof balance.continuation_valid_until==='string' && Number.isFinite(Date.parse(balance.continuation_valid_until)));
  if(initial) need(balance.new_commitments_microusd===CONTINUATION.priorCommittedMicroUsd
    && balance.remaining_microusd>=CONTINUATION.maximumAdditionalExposureMicroUsd);
  return balance;
}
