import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {caseId,REAL_CASES,verifyPackedCase,loadRealCase,realObservation} from '../scripts/pocket-real-benchmark-fixture.ts';

test('six source-image SHA and input SHA pairs are pinned, one case at a time',()=>{
 assert.equal(Object.keys(REAL_CASES).length,6);
 for(const hashes of Object.values(REAL_CASES))for(const sha of hashes)assert.match(sha,/^[0-9a-f]{64}$/);
 assert.equal(caseId('range-clear-01'),'range-clear-01');
 assert.throws(()=>caseId('all'),/ONE/);
 assert.throws(()=>caseId('range-clear'),/ONE/);
});
test('no directory cannot silently download or fabricate a chart',async()=>{
 await assert.rejects(()=>loadRealCase('',caseId('range-clear-01')),/CORPUS_DIRECTORY/);
});
test('analysis without all three scanners fails instead of scoring NO SIGNAL',()=>{
 assert.throws(()=>realObservation(caseId('range-clear-01'),{levels:[],patterns:[],liquidity:{}},12),/Missing scanners/);
 assert.throws(()=>realObservation(caseId('range-clear-01'),{levels:[{kind:'support',price:'NaN',y:50}],patterns:[],liquidity:{zones:[]}},12),/Invalid level/);
});
test('model-normalized positions translate to original image coordinates',()=>{
 const o=realObservation(caseId('range-clear-01'),{
  levels:[{kind:'support',price:'6405.20',y:50}],
  patterns:[{name:'DOUBLE TOP',status:'CONFIRMED',geometry:{points:[{x:20,y:30}]}}],
  liquidity:{event:'SWEEP',zones:[{side:'BUY_SIDE',basis:'EQUAL_HIGHS',priceLow:6400,priceHigh:6410,x:10,x2:80}]}
 },900);
 assert.deepEqual(o.levels[0],{kind:'support',price:6405.2,y_px:425});
 assert.deepEqual(o.patterns[0].geometry[0],{x_px:280,y_px:255});
 assert.deepEqual(o.liquidity_zones[0].price_interval,[6400,6410]);
 assert.equal(o.scored,true);
});
test('all six external real-market PNGs pass strict original hash checks', {skip:!process.env.POCKET_REAL_CORPUS_DIRECTORY},async()=>{
 const dir=process.env.POCKET_REAL_CORPUS_DIRECTORY!;
 for(const id of Object.keys(REAL_CASES)){
  const verified=await loadRealCase(dir,caseId(id));
  assert.equal(verified.originalSha256,REAL_CASES[caseId(id)][0]);
  const bytes=await readFile(join(dir,id+'.scan-input.json'));
  const confirmation=verified.input.chartConfirmation as {currentPrice:string;timeframe:string};
  assert.throws(()=>verifyPackedCase(caseId(id),Buffer.concat([bytes,Buffer.from(' ')]),confirmation.currentPrice,confirmation.timeframe),/hash mismatch/);
 }
});
test('default runner is OFFLINE_ONLY and protected paid mode uses ledger release veto',async()=>{
 const src=await readFile(new URL('../scripts/run-pocket-real-image-benchmark.ts',import.meta.url),'utf8');
 assert.match(src,/POCKET_REAL_BENCHMARK_DISPATCH/);
 assert.match(src,/isBenchmarkPilotSpendHeld/);
 assert.match(src,/withPocketTestSpendScope/);
 assert.match(src,/releasePocketBenchmarkMeasurement/);
 assert.match(src,/costReconciled:true,scored:false/);
 assert.doesNotMatch(src,/syntheticSvg/);
});