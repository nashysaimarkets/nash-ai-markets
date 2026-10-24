/** Actual accepted route merge/calibration and unchanged original-pixel scorer.
 * No transport, reference changes, semantic acceptance or HTTP latency claim. */
import {stripTypeScriptTypes} from 'node:module';
import {recoverPrecisionGeometry} from '../app/api/pocket/precision-fallback.ts';
import {calibratePocketAnalysis} from '../app/api/pocket/analysis-calibration.ts';
import {scoreInternalDiagnostics} from './pocket-monaco-internal-diagnostics.ts';
import {readAcceptedRoute,cut,need,sha256,V2} from './pocket-scanner-evaluation-v2-source.mjs';
import {knownOutputLimit} from './pocket-scanner-evaluation-v2-executor.mjs';

export function createEvaluationDiagnostics(){
  const route=readAcceptedRoute();
  // Extract the unchanged actual predicate body; no independent retry policy.
  const predicate=cut(route,'            const readPrice =','            if (parsed.levels.length === 0 || missingSide)');
  const needRescue=new Function('parsed',stripTypeScriptTypes(predicate)+'\nreturn parsed.levels.length === 0 || missingSide;');
  const merge=new Function('initial','precisionResult','chartConfirmation','recoverPrecisionGeometry',
    stripTypeScriptTypes('let analysis=initial,contextPrecisionResult=null;\n'+cut(route,
      '    if (analysis && typeof analysis === "object")','    const calibrated = calibratePocketAnalysis'))+'\nreturn analysis;');
  return Object.freeze({
    needsRescue(outputText){try{const parsed=JSON.parse(outputText);return Boolean(parsed&&Array.isArray(parsed.levels)&&needRescue(parsed));}catch{return false;}},
    finishCase(c,raw,timing){
      need(raw?.main&&raw.primary_precision&&Object.values(raw).every(r=>r.status==='completed'||knownOutputLimit(r)));
      const common={caseId:c.sourceCaseId,inputSha256:c.artifacts.input.sha256,imageSha256:c.artifacts.image.sha256,
        oracleBytes:c.objectiveReference.bytes,oracleSha256:c.objectiveReference.sha256,protocolBytes:c.protocol.bytes,
        protocolSha256:c.protocol.sha256,latencyMs:timing.executionMs,evidenceKind:'RETAINED_SCANNER_OUTPUT'};
      const score=(value,status)=>{const bytes=Buffer.from(typeof value==='string'?value:JSON.stringify(value));
        return scoreInternalDiagnostics({...common,status,rawResponseBytes:bytes,rawResponseSha256:sha256(bytes)});};
      const rawMain=score(raw.main.output_text,raw.main.status==='completed'?'COMPLETED':'HOLD');
      let postprocessed;
      try{
        need(raw.main.status==='completed','MAIN_NOT_COMPLETED');
        let precision=raw.primary_precision.status==='completed'?raw.primary_precision:null;
        if(precision&&raw.rescue_precision?.status==='completed'){
          try{const p=JSON.parse(precision.output_text),rescue=JSON.parse(raw.rescue_precision.output_text);
            if(rescue)precision={output_text:JSON.stringify(recoverPrecisionGeometry(p,rescue)??rescue)};
          }catch{ /* Actual route preserves completed primary when rescue parsing fails. */ }
        }
        const input=JSON.parse(Buffer.from(c.artifacts.input.bytes));
        const result=calibratePocketAnalysis(merge(JSON.parse(raw.main.output_text),precision,input.chartConfirmation,recoverPrecisionGeometry));
        postprocessed=score(result,'COMPLETED');
      }catch{postprocessed={...score('{}','HOLD'),reason:raw.main.status==='completed'?'CANDIDATE_POSTPROCESSING_UNMEASURED':'PROVIDER_MAIN_INCOMPLETE'};}
      return {kind:'POCKET_SCANNER_EVALUATION_V2_DIAGNOSTICS',scopeId:V2.scopeId,caseId:c.caseId,sourceCaseId:c.sourceCaseId,
        attemptId:c.attemptId,planSha256:c.planSha256,appSourceSha:V2.appSourceSha,rawMain,postprocessed,
        providerOutcomes:Object.fromEntries(Object.entries(raw).map(([slot,r])=>[slot,{status:r.status,incompleteDetails:r.incomplete_details??null}])),
        timing,latencyMeaning:'SEQUENTIAL_DIAGNOSTIC_EXECUTION_WITH_ACCOUNTING_AND_RETENTION_NOT_DEPLOYED_HTTP',
        expertAccepted:false,humanReviewed:false,tradingInterpretation:'UNSCORED',
        observations:'Candidate postprocessing may filter claims and copy supplied identity/current price. Raw main remains separate.',
        originalArtifactsModified:false};
    },
  });
}
