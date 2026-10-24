/** Diagnostic handling of retained provider outcomes. No request, scanner,
 * protocol or oracle bytes change. Incomplete text is never repaired, relabelled
 * completed, or supplied as calibrated geometry. d001 is handled separately.
 */
import {CONTINUATION_IDS} from './pocket-monaco-continuation-admission.mjs';
import {isKnownOutputLimit,createContinuationExecutor} from './pocket-monaco-continuation-executor.mjs';
import {createContinuationLedgerBridge} from './pocket-monaco-continuation-bridge.mjs';
import {prepareFrozenFirstSix,finishFrozenFirstSixCase} from './pocket-monaco-first-six-executor.ts';
import {needsRescue,sha256} from './pocket-monaco-offline-executor.ts';
import {scoreInternalDiagnostics} from './pocket-monaco-internal-diagnostics.ts';

const need=ok=>{if(!ok)throw Error('CONTINUATION_DIAGNOSTIC_REFUSED');};

export function finishContinuationCase(c,raw,latencyMs) {
  need(CONTINUATION_IDS.includes(c?.caseId) && raw?.main
    && Object.values(raw).every(r=>r?.status==='completed'||isKnownOutputLimit(r)));
  const states=Object.fromEntries(Object.entries(raw).map(([slot,r])=>[slot,{
    status:r.status,incompleteReason:r.status==='incomplete'?'max_output_tokens':null,
  }]));
  if(Object.values(raw).every(r=>r.status==='completed')) {
    return {...finishFrozenFirstSixCase(c,raw,latencyMs),providerOutcomes:states,
      continuationMeasurementPolicy:'ORIGINAL_COMPLETED_RESPONSE_COMPOSITION'};
  }
  const bytes=Buffer.from(raw.main.output_text);
  const common={caseId:c.caseId,inputSha256:c.material.artifacts.input.sha256,
    imageSha256:c.material.artifacts.image.sha256,oracleBytes:c.objectiveReference.bytes,
    oracleSha256:c.objectiveReference.sha256,protocolBytes:c.protocol.bytes,protocolSha256:c.protocol.sha256,
    rawResponseBytes:bytes,rawResponseSha256:sha256(bytes),latencyMs,evidenceKind:'RETAINED_SCANNER_OUTPUT'};
  const held=scoreInternalDiagnostics({...common,status:'HOLD'});
  const main=raw.main.status==='completed'
    ? scoreInternalDiagnostics({...common,status:'COMPLETED'})
    : {...held,reason:'PROVIDER_MAIN_MAX_OUTPUT_TOKENS',retainedOutputTextSha256:sha256(bytes)};
  const incompleteSlots=Object.entries(raw).filter(([,r])=>isKnownOutputLimit(r)).map(([slot])=>slot);
  return {kind:'FIRST_SIX_INTERNAL_DIAGNOSTICS',humanReviewed:false,expertAccepted:false,
    tradingInterpretation:'UNSCORED',rawMain:main,
    postprocessed:{...held,reason:'PROVIDER_OUTPUT_INCOMPLETE',incompleteSlots},
    precision:{status:'UNMEASURED',reason:'PROVIDER_OUTPUT_INCOMPLETE',incompleteSlots},
    providerOutcomes:states,sourceIdentity:c.sourceIdentity,
    postprocessingCaveat:'The original provider status remains incomplete. No truncated JSON was repaired and no calibrated output is claimed.',
    continuationMeasurementPolicy:'RETAINED_KNOWN_OUTPUT_LIMIT_ACCOUNTED_WITHOUT_RETRY'};
}

export function createFrozenContinuationExecutor({port,ledgerKey,identity,transport,privateArtifacts}) {
  return createContinuationExecutor({ledger:createContinuationLedgerBridge(port,ledgerKey,identity),
    identity,transport,privateArtifacts,prepare:prepareFrozenFirstSix,
    needsRescue,finishCase:finishContinuationCase});
}
