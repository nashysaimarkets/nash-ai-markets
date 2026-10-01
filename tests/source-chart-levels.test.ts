import test from 'node:test';
import assert from 'node:assert/strict';
import { createSampleCharts } from '../app/pocket/sample-analysis';
import { sourceChartLevels } from '../app/pocket/source-chart-levels';
const sample=createSampleCharts()[0].report!;
const resolve=(report=sample)=>sourceChartLevels(report,640,480);

test('known fictional image projects both levels to the independently specified sample scale',()=>{
 const result=resolve();assert.equal(result.reason,null);assert.equal(result.levels.length,2);
 const a=sample.priceScaleAnchors![0],b=sample.priceScaleAnchors!.at(-1)!;
 for(const line of result.levels){const expected=a.y+(line.value-a.price)/(b.price-a.price)*(b.y-a.y);assert.ok(Math.abs(line.y-expected)<1e-10);assert.equal(line.x,sample.plotBounds!.left);assert.equal(line.x2,sample.plotBounds!.right);}
});
test('missing, conflicting, duplicate, tightly spaced and non-linear scales withhold all lines',()=>{
 for(const anchors of [[],sample.priceScaleAnchors!.slice(0,2),[...sample.priceScaleAnchors!,sample.priceScaleAnchors![0]],sample.priceScaleAnchors!.map(a=>({...a,y:50-a.price*.001})),sample.priceScaleAnchors!.map((a,i)=>({...a,y:a.y+(i===1?1:0)}))]) assert.equal(resolve({...sample,priceScaleAnchors:anchors}).levels.length,0);
 assert.equal(resolve({...sample,evidenceQuality:{...sample.evidenceQuality,limitations:['LOG scale enabled']}}).levels.length,0);
});
test('pixel tolerance scales with original image resolution, not viewport size',()=>{
 const altered={...sample,priceScaleAnchors:sample.priceScaleAnchors!.map((a,i)=>({...a,y:a.y+(i===1?.2:0)}))};
 assert.equal(sourceChartLevels(altered,640,480).levels.length,2);
 assert.equal(sourceChartLevels(altered,2560,1920).levels.length,0);
});
test('source geometry, price coverage and report identity fail closed without clamping',()=>{
 for(const report of [ {...sample,evidenceQuality:{...sample.evidenceQuality,timeframeConfidence:'LOW' as const}}, {...sample,trustGate:{...sample.trustGate!,scaleLocked:false}}, {...sample,plotBounds:{...sample.plotBounds!,right:Infinity}} ]) assert.equal(resolve(report).levels.length,0);
 assert.equal(sourceChartLevels(sample,0,0).levels.length,0);
 const levels=sample.levels.map(l=>({...l,y:l.y+1,y2:l.y2+1}));assert.equal(resolve({...sample,levels}).levels.length,0);
 assert.equal(resolve({...sample,levels:sample.levels.map(l=>({...l,source:'CONTEXT' as const}))}).levels.length,0);
 const out=sample.levels.map(l=>({...l,price:'999999'}));assert.equal(resolve({...sample,levels:out}).levels.length,0);
});
test('all five timeframes retain their own screenshot coordinates and precision',()=>{
 for(const chart of createSampleCharts()){const report=chart.report!;const result=resolve(report);assert.equal(result.levels.length,2);for(const l of result.levels){const original=report.levels.find(o=>o.price===l.price)!;assert.ok(Math.abs(l.y-original.y)<1e-10);}}
});
