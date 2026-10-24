/** Synthetic geometry/control fixtures, never an accuracy measurement. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createEvaluationDiagnostics} from '../scripts/pocket-scanner-evaluation-v2-diagnostics.mjs';
import {sha256} from '../scripts/pocket-scanner-evaluation-v2-source.mjs';
import {response} from './support/pocket-scanner-evaluation-v2-fixture.mjs';
const bytes=value=>Buffer.from(JSON.stringify(value)),artifact=value=>{const b=bytes(value);return {bytes:b,sha256:sha256(b)};};
const protocolBytes=readFileSync(new URL('../docs/monaco-126/internal-diagnostics/PROTOCOL-v1.json',import.meta.url));
function fixture(){
  const input=artifact({chartConfirmation:{instrument:'SYNTHETIC',timeframe:'1h',currentPrice:'116',contextMatch:'NOT_PROVIDED'}}),h='a'.repeat(64);
  const source={caseId:'d001',instrument:'SYNTHETIC',inputInstrument:'SYNTHETIC',timeframe:'1h',identities:{subsetManifestSha256:h,inputSha256:input.sha256,imageSha256:h,
    sourceZipSha256:h,sourceMemberSha256:h,barsSha256:h,calibrationSha256:h},objective:{aggregation:{exactOhlcvMatch:true,barCount:1},
    priceScale:{width:1000,height:500,coordinates:'ORIGINAL_IMAGE_PIXELS',plot:{left:100,right:900,top:50,bottom:450},priceMin:90,priceMax:130,pricePerPixel:.1,pixelQuantizationBound:.5},
    candles:[{barIndex:0,timestamp:'synthetic',points:Object.fromEntries(Object.entries({open:110,high:120,low:100,close:115}).map(([key,price])=>[key,{x:200,y:450-(price-90)/.1,price}]))}]},
    perToolAssessability:Object.fromEntries(['pattern','level','liquidity_pool','liquidity_event'].map(k=>[k,{status:'OBJECTIVE_ONLY',reasonCode:'SYNTHETIC',reason:'Synthetic fixture only'}]))};
  const oracle=artifact({schemaVersion:1,kind:'MONACO_INTERNAL_SOURCE_REFERENCE',caseIds:['d001','d002','d003','d004','d005','d006'],cases:Array.from({length:6},(_,i)=>({...source,caseId:`d00${i+1}`}))});
  const main={instrument:'SYNTHETIC',timeframe:'1h',currentPrice:'116',evidenceQuality:{chartReadability:'CLEAR',candlesReadable:true,scaleReadable:true,instrumentConfidence:'HIGH',timeframeConfidence:'HIGH'},
    patterns:[],levels:[{kind:'support',label:'Synthetic support',price:'110',x:10,x2:90,y:50,y2:50},{kind:'resistance',label:'Synthetic resistance',price:'120',x:10,x2:90,y:30,y2:30}],
    plotBounds:{left:10,top:10,right:90,bottom:90},priceScaleAnchors:[{price:130,y:10},{price:110,y:50},{price:90,y:90}],
    liquidity:{state:'NONE',event:'NONE',confidence:'LOW',evidence:'',confirmation:'',invalidation:'',zones:[],observations:[]}};
  const precision={plotBounds:main.plotBounds,priceScaleAnchors:main.priceScaleAnchors,levels:main.levels,currentPrice:'116',confidence:'HIGH',limitation:'Synthetic only'};
  return {c:{caseId:'v2-d001',sourceCaseId:'d001',attemptId:'v2-d001-attempt-1',planSha256:h,artifacts:{input,image:{sha256:h}},
    objectiveReference:oracle,protocol:{bytes:protocolBytes,sha256:sha256(protocolBytes)}},
    raw:{main:response('main',{output_text:JSON.stringify(main)}),primary_precision:response('primary_precision',{output_text:JSON.stringify(precision)})},
    timing:{executionMs:12,providerCallMs:{main:3,primary_precision:3},deployedHttpLatencyMs:null}};
}
test('actual accepted route/calibration keeps explicit empty observations and separate raw versus processed diagnostics',()=>{
  const f=fixture(),before=structuredClone(f.raw),d=createEvaluationDiagnostics().finishCase(f.c,f.raw,f.timing);
  assert.equal(d.kind,'POCKET_SCANNER_EVALUATION_V2_DIAGNOSTICS');assert.equal(d.rawMain.status,'DIAGNOSTIC_RECORDED');assert.equal(d.postprocessed.status,'DIAGNOSTIC_RECORDED');
  assert.equal(d.expertAccepted,false);assert.equal(d.tradingInterpretation,'UNSCORED');assert.equal(d.caseId,'v2-d001');assert.equal(d.sourceCaseId,'d001');
  assert.equal(d.timing.deployedHttpLatencyMs,null);assert.deepEqual(f.raw,before);
});
test('main incompleteness holds postprocessing even when text is valid JSON',()=>{
  const f=fixture();Object.assign(f.raw.main,{status:'incomplete',incomplete_details:{reason:'max_output_tokens'}});
  const d=createEvaluationDiagnostics().finishCase(f.c,f.raw,f.timing);assert.equal(d.rawMain.status,'UNMEASURED');assert.equal(d.postprocessed.status,'UNMEASURED');
  assert.equal(d.postprocessed.reason,'PROVIDER_MAIN_INCOMPLETE');assert.equal(d.providerOutcomes.main.status,'incomplete');
});
test('primary and rescue incompleteness follows actual candidate fallback without fabricated completion',()=>{
  const adapter=createEvaluationDiagnostics(),f=fixture();Object.assign(f.raw.primary_precision,{status:'incomplete',incomplete_details:{reason:'max_output_tokens'},output_text:'{'});
  const d=adapter.finishCase(f.c,f.raw,f.timing);assert.equal(d.providerOutcomes.primary_precision.status,'incomplete');assert.equal(d.postprocessed.status,'DIAGNOSTIC_RECORDED');
  const g=fixture();g.raw.rescue_precision=response('rescue_precision',{status:'incomplete',incomplete_details:{reason:'max_output_tokens'},output_text:'{'});
  const baseline=adapter.finishCase(g.c,{main:g.raw.main,primary_precision:g.raw.primary_precision},g.timing),rescued=adapter.finishCase(g.c,g.raw,g.timing);
  assert.deepEqual(rescued.postprocessed,baseline.postprocessed);assert.equal(rescued.providerOutcomes.rescue_precision.status,'incomplete');
});
test('exact existing rescue predicate requires completed parsed primary shape; malformed output creates no eligibility',()=>{
  const a=createEvaluationDiagnostics();assert.equal(a.needsRescue('{'),false);assert.equal(a.needsRescue('{}'),false);
  assert.equal(a.needsRescue('{"levels":[]}'),true);assert.equal(a.needsRescue('{"levels":[{"price":"90"}],"currentPrice":"100"}'),true);
  assert.equal(a.needsRescue('{"levels":[{"price":"90"},{"price":"110"}],"currentPrice":"100"}'),false);
});
