#!/usr/bin/env bash
# Exact stdin replay executed from this workspace. Its output is immutable:
# flag:'wx' refuses to replace an existing RETAINED-REPLAY.json.
cd /workspace/scratch/616faf3e8649
node --input-type=module <<'JS'
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {stripTypeScriptTypes} from 'node:module';
import {isDeepStrictEqual} from 'node:util';
import assert from 'node:assert/strict';
import {calibratePocketAnalysis as beforeCalibration} from './scanner-evaluation-v2/app/api/pocket/analysis-calibration.ts';
import {calibratePocketAnalysis as afterCalibration} from './scanner-geometry-repair/app/api/pocket/analysis-calibration.ts';
import {recoverPrecisionGeometry} from './scanner-geometry-repair/app/api/pocket/precision-fallback.ts';
import {unpackEvaluationCase} from './scanner-evaluation-v2/scripts/pocket-scanner-evaluation-v2-bundle.mjs';
import {scoreInternalDiagnostics} from './scanner-geometry-repair/scripts/pocket-monaco-internal-diagnostics.ts';
const hash=x=>createHash('sha256').update(x).digest('hex');
const base='/workspace/scratch/616faf3e8649';
const root=base+'/private-six/results/v2-run40095819408/decrypted';
const source=base+'/scanner-geometry-repair';
const expected={main:'6a271af7026e5b6c6447437d32ce4c67a262965a1df9c962439d892575468f06',primary_precision:'cdaaf844e6c51ab0f33d0f3c9d12392c7d97c45ad95b7a5385cc2fe276c29803',rescue_precision:'5575ffbe4d18e9fe4ca42a0637e43388590b99ed79cdc63966dc00b66090ab58'};
const raw={},inputHashes={};
for(const [slot,digest] of Object.entries(expected)){
 const name='provider-response-'+slot+'.json',b=readFileSync(root+'/'+name);assert.equal(hash(b),digest);raw[slot]=JSON.parse(b);inputHashes[name]=digest;
}
const diagnosticBytes=readFileSync(root+'/diagnostic-output-final.json'),retained=JSON.parse(diagnosticBytes);inputHashes['diagnostic-output-final.json']=hash(diagnosticBytes);
const planBytes=readFileSync(base+'/scanner-evaluation-v2/docs/monaco-126/scanner-evaluation-v2-2026-10-24/PLAN.json');
const c=unpackEvaluationCase({bytes:readFileSync(base+'/scanner-evaluation-v2-private/v2-d001.bundle.gz'),expectedBundleSha256:'91da0d22a88dcee0d27d342d524f77354d559312406d4f51fd579ba025e6f7a0',planBytes,expectedPlanSha256:'cb2a6588759abd36b0cacf5972515dbd2a114d52c9e3224754d01af6b8a3e109',caseId:'v2-d001'});
const route=readFileSync(source+'/app/api/pocket/analyse/route.ts','utf8');assert.equal(hash(route),'7b47dcd1d25cc03213a3b0c9052fb24a10418c34f5ed76e5c06953a0c34d4ea7');
const start=route.indexOf('    if (analysis && typeof analysis === "object")'),end=route.indexOf('    const calibrated = calibratePocketAnalysis',start);assert(start>0&&end>start);
const merge=new Function('initial','precisionResult','chartConfirmation','recoverPrecisionGeometry',stripTypeScriptTypes('let analysis=initial,contextPrecisionResult=null;\n'+route.slice(start,end))+'\nreturn analysis;');
const p=JSON.parse(raw.primary_precision.output_text),r=JSON.parse(raw.rescue_precision.output_text);
const precision={output_text:JSON.stringify(recoverPrecisionGeometry(p,r)??r)};
const input=JSON.parse(Buffer.from(c.artifacts.input.bytes)),merged=merge(JSON.parse(raw.main.output_text),precision,input.chartConfirmation,recoverPrecisionGeometry);
const before=beforeCalibration(structuredClone(merged)),after=afterCalibration(structuredClone(merged));
const score=value=>{const b=Buffer.from(JSON.stringify(value));return scoreInternalDiagnostics({caseId:c.sourceCaseId,inputSha256:c.artifacts.input.sha256,imageSha256:c.artifacts.image.sha256,oracleBytes:c.objectiveReference.bytes,oracleSha256:c.objectiveReference.sha256,protocolBytes:c.protocol.bytes,protocolSha256:c.protocol.sha256,latencyMs:retained.timing.executionMs,evidenceKind:'RETAINED_SCANNER_OUTPUT',status:'COMPLETED',rawResponseBytes:b,rawResponseSha256:hash(b)});};
const baselineScore=score(before),candidateScore=score(after);
assert(isDeepStrictEqual(baselineScore,retained.diagnostics.postprocessed),'Exact baseline must reproduce the retained diagnostic');
assert.deepEqual(after.plotBounds,{left:70,top:100,right:100,bottom:20});
assert.equal(after.evidenceQuality.scaleReadable,false);
assert.deepEqual(after.levels,[]);assert.deepEqual(after.fibLevels,[]);
assert.deepEqual(after.priceScaleAnchors,before.priceScaleAnchors);
assert.equal(after.liquidity.state,'PARTIAL');
assert.deepEqual(after.liquidity.observations,[]);
assert.deepEqual(candidateScore.existingLiquidityChain,{status:'BLOCKED',zones:[],reasons:['PLOT_BOUNDS_UNVERIFIED']});
assert(candidateScore.axis.every(a=>a.projection.status==='UNSCORED'));
assert.equal(candidateScore.absence,'UNSCORED_NO_SEMANTIC_NEGATIVE_REFERENCE');
for(const [name,digest] of Object.entries(inputHashes))assert.equal(hash(readFileSync(root+'/'+name)),digest);
const compact=(report,scored)=>({plotBounds:report.plotBounds,scaleReadable:report.evidenceQuality.scaleReadable,anchorCount:report.priceScaleAnchors.length,emittedLevels:report.levels.length,emittedFibLevels:report.fibLevels?.length??null,liquidityState:report.liquidity.state,observations:report.liquidity.observations,evidenceChain:report.liquidity.evidenceChain??null,finalLiquidityChain:scored.existingLiquidityChain,axis:scored.axis,levelSummary:scored.tools.level.summary,absence:scored.absence,status:scored.status});
const result={kind:'POCKET_SCANNER_GEOMETRY_REPAIR_RETAINED_REPLAY',baseCommit:'b118c7a38a35514eb4cbd4cc86b3341de91a5ca5',acceptedAppSource:'2812bfbc6e8f62e93d0bc56957fd5ce71cc819dc',frozenEvaluationRuntime:'20783ed5e8eb95a11df86b0d60766ffcbbf4fa79',caseId:'v2-d001',sourceCaseId:'d001',providerRunId:'40095819408',rawArtifactSha256:inputHashes,baselineMatchesRetainedPostprocessedDiagnostic:true,before:compact(before,baselineScore),after:compact(after,candidateScore),originalPixelTolerance:retained.diagnostics.postprocessed.tolerance.originalPixels,unchangedRawMainLevelSummary:retained.diagnostics.rawMain.tools.level.summary,sourceFiles:{'app/api/pocket/analysis-calibration.ts':hash(readFileSync(source+'/app/api/pocket/analysis-calibration.ts')),'app/api/pocket/liquidity-chain.ts':hash(readFileSync(source+'/app/api/pocket/liquidity-chain.ts')),'app/api/pocket/analyse/route.ts':hash(route),'scripts/pocket-monaco-internal-diagnostics.ts':hash(readFileSync(source+'/scripts/pocket-monaco-internal-diagnostics.ts'))},rawArtifactsUnchanged:true,promptsModelScorerToleranceUnchanged:true,providerCalls:0,hostedDatabaseCalls:0,heldoutReads:0,privateKeyReads:0,accuracyAccepted:false,meaning:'Reject impossible model plotting bounds without repairing units or claiming geometric accuracy. Suppressed assertions and unreadable scale earn no accuracy/absence credit.'};
const out=base+'/scanner-geometry-repair-evidence/RETAINED-REPLAY.json';writeFileSync(out,JSON.stringify(result,null,2)+'\n',{flag:'wx',mode:0o600});console.log(JSON.stringify(result));
JS
