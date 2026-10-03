import test from 'node:test';import assert from 'node:assert/strict';
import {preciseLiquidityZones} from '../app/pocket/precise-liquidity';
import type {LiquidityShield} from '../app/pocket/liquidity-guard';
const bounds={left:5,right:90,top:10,bottom:90},anchors=[{price:3000,y:20},{price:2900,y:50},{price:2800,y:80}],axis={status:'verified' as const,anchors,matchedModelTicks:3,axisLeft:900};
const zone={side:'BELOW_PRICE' as const,pattern:'EQUAL_LOWS' as const,label:'Repeated lows',priceLow:2850,priceHigh:2850,confidence:'HIGH' as const,evidence:'Two lows',touchPoints:[{x:25,y:65},{x:55,y:65}]};
const shield:LiquidityShield={status:'VISIBLE_RISK_ZONES',summary:'Visible lows',stopGuidance:'Verify',zones:[zone]};
const pixels={width:1000,height:1000,candles:[250,550].map((x,id)=>({id,left:x-1,right:x+1,x,highY:600,lowY:650,upperWick:true,lowerWick:true}))};
const check=(s=shield,a:Parameters<typeof preciseLiquidityZones>[4]=axis,h=1000)=>preciseLiquidityZones(s,'2900',anchors,bounds,a,1000,h,pixels);
test('independent axis corrects model drift, preserves exact band and excludes price labels',()=>{
 const r=preciseLiquidityZones(shield,'2900',anchors.map(a=>({...a,y:a.y+5})),bounds,axis,1000,1000,pixels);assert.equal(r.zones.length,1);assert.equal(r.zones[0].lineY,65);assert.equal(r.zones[0].height,0);assert.equal(r.zones[0].right,89);
});
test('pending, conflicting, nonlinear or unsupported axes withhold zones',()=>{
 for(const a of [null,{status:'held' as const,reason:'conflict'},{...axis,anchors:anchors.slice(0,2)},{...axis,anchors:anchors.map((v,i)=>({...v,y:v.y+(i===1?1:0)}))},{...axis,anchors:anchors.map(v=>({...v,price:v.price*10}))}])assert.equal(check(shield,a).zones.length,0);
});
test('wrong side, uncovered price, low confidence and imprecise touch rows fail closed',()=>{
 for(const z of [{...zone,side:'ABOVE_PRICE' as const},{...zone,priceLow:2790,priceHigh:2790},{...zone,confidence:'MEDIUM' as const},{...zone,touchPoints:[{x:25,y:66},{x:55,y:66}]},{...zone,touchPoints:[{x:25,y:65},{x:25.1,y:65}]}])assert.equal(check({...shield,zones:[z]}).zones.length,0);
 assert.equal(check({...shield,zones:[{...zone,touchPoints:[{x:25,y:65.15},{x:55,y:65.15}]}]}).zones.length,1);
 assert.equal(check({...shield,zones:[{...zone,touchPoints:[{x:25,y:65.15},{x:55,y:65.15}]}]},axis,2000).zones.length,0);
});
test('bands preserve supplied price endpoints without adding visual padding',()=>{
 const r=check({...shield,zones:[{...zone,priceLow:2849,priceHigh:2851}]});assert.equal(r.zones.length,1);assert.ok(Math.abs(r.zones[0].top-64.7)<1e-8);assert.ok(Math.abs(r.zones[0].height-.6)<1e-8);
});

test('AI-aligned rows cannot substitute for missing, wrong-dimension or displaced wick pixels',()=>{
 for(const p of [null,{...pixels,height:2000},{...pixels,candles:[]},{...pixels,candles:pixels.candles.map(c=>({...c,lowY:670}))}])assert.equal(preciseLiquidityZones(shield,'2900',anchors,bounds,axis,1000,1000,p).zones.length,0);
});
test('ambiguous horizontal association and duplicate candle witnesses fail closed',()=>{
 for(const candles of [[...pixels.candles,{...pixels.candles[0],id:2,x:252,left:252,right:254}],pixels.candles.map(c=>({...c,id:0}))])assert.equal(preciseLiquidityZones(shield,'2900',anchors,bounds,axis,1000,1000,{...pixels,candles}).zones.length,0);
});
test('uses measured endpoints without inflating a band or ignoring a third unsupported touch',()=>{
 const witness={...pixels,candles:pixels.candles.map(c=>({...c,lowY:651}))};
 const result=preciseLiquidityZones(shield,'2900',anchors,bounds,axis,1000,1000,witness);assert.equal(result.zones.length,1);assert.equal(result.zones[0].touchPoints[0].y,65.10000000000001);assert.equal(result.zones[0].height,0);
 assert.equal(check({...shield,zones:[{...zone,touchPoints:[...zone.touchPoints,{x:70,y:65}]}]}).zones.length,0);
});

test('a distant annotation at the same x cannot become a wick witness',()=>{
 const annotation={...pixels.candles[0],id:2,highY:100,lowY:150};
 const r=preciseLiquidityZones(shield,'2900',anchors,bounds,axis,1000,1000,{...pixels,candles:[...pixels.candles,annotation]});assert.equal(r.zones.length,1);
 const wrong={...shield,zones:[{...zone,touchPoints:[{x:25,y:10},{x:55,y:10}]}]};assert.equal(check(wrong).zones.length,0);
});


test('held candidates identify a scale-coverage failure separately from a candle match failure',()=>{
 const outside=check({...shield,zones:[{...zone,priceHigh:3010}]});assert.match(outside.candidateReasons[0].reason,/complete price band.*2800–3000/);
 const displaced=preciseLiquidityZones(shield,'2900',anchors,bounds,axis,1000,1000,{...pixels,candles:pixels.candles.map(c=>({...c,lowY:670}))});assert.match(displaced.candidateReasons[0].reason,/distinct original candle endpoint/);
});

test('an independently read boundary label can sit inside the OCR margin while drawings stay inside the plot',()=>{
 const clipped={...bounds,top:21};assert.equal(preciseLiquidityZones(shield,'2900',anchors,clipped,axis,1000,1000,pixels).zones.length,1);
 const remote={...bounds,top:23};assert.equal(preciseLiquidityZones(shield,'2900',anchors,remote,axis,1000,1000,pixels).zones.length,0);
 const outside={...shield,zones:[{...zone,side:'ABOVE_PRICE' as const,pattern:'EQUAL_HIGHS' as const,priceLow:3000,priceHigh:3000,touchPoints:[{x:25,y:20},{x:55,y:20}]}]};
 assert.equal(preciseLiquidityZones(outside,'2900',anchors,clipped,axis,1000,1000,pixels).zones.length,0);
});
