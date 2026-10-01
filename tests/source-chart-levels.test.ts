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

test('real IG screenshot tick positions pass raster rounding checks without moving onto indicator panels',()=>{
 // Owner archive IMG_6272.PNG (944x2048). Prices read from the axis;
 // row centres measured from its horizontal grid pixels. Tests placement only.
 const ticks=[[7760,258],[7740,337],[7720,414],[7700,493.5],[7680,570.5],[7660,647],[7640,726.5],[7620,803.5]];
 const report={...sample,instrument:'US 500',timeframe:'30m',currentPrice:'7718.49',plotBounds:{left:0,top:250/2048*100,right:81,bottom:810/2048*100},priceScaleAnchors:ticks.map(([price,y])=>({price,y:y/2048*100})),levels:[{...sample.levels[0],kind:'support' as const,price:'7660',x:1,x2:80,y:647/2048*100,y2:647/2048*100}]};
 const result=sourceChartLevels(report,944,2048);assert.equal(result.reason,null);assert.equal(result.levels.length,1);assert.ok(Math.abs(result.levels[0].y*2048/100-647)<1.5);
});
test('narrow forex prices retain their exact labels and distinct calibrated rows',()=>{
 const y=(p:number)=>90-(p-1.172)/.002*80;
 const report={...sample,currentPrice:'1.17234',plotBounds:{left:5,right:90,top:5,bottom:95},priceScaleAnchors:[1.172,1.173,1.174].map(price=>({price,y:y(price)})),levels:[{...sample.levels[0],price:'1.17230',x:5,x2:90,y:y(1.17230),y2:y(1.17230)},{...sample.levels[1],price:'1.17238',x:5,x2:90,y:y(1.17238),y2:y(1.17238)}]};
 const result=sourceChartLevels(report,640,480);assert.equal(result.levels.length,2);assert.deepEqual(result.levels.map(l=>l.price),['1.17238','1.17230']);assert.notEqual(result.levels[0].y,result.levels[1].y);
});
