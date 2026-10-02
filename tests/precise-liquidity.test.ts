import test from 'node:test';import assert from 'node:assert/strict';
import {preciseLiquidityZones} from '../app/pocket/precise-liquidity';
import type {LiquidityShield} from '../app/pocket/liquidity-guard';
const bounds={left:5,right:90,top:10,bottom:90},anchors=[{price:3000,y:20},{price:2900,y:50},{price:2800,y:80}],axis={status:'verified' as const,anchors,matchedModelTicks:3,axisLeft:900};
const zone={side:'BELOW_PRICE' as const,pattern:'EQUAL_LOWS' as const,label:'Repeated lows',priceLow:2850,priceHigh:2850,confidence:'HIGH' as const,evidence:'Two lows',touchPoints:[{x:25,y:65},{x:55,y:65}]};
const shield:LiquidityShield={status:'VISIBLE_RISK_ZONES',summary:'Visible lows',stopGuidance:'Verify',zones:[zone]};
const check=(s=shield,a:Parameters<typeof preciseLiquidityZones>[4]=axis,h=1000)=>preciseLiquidityZones(s,'2900',anchors,bounds,a,1000,h);
test('independent axis corrects model drift, preserves exact band and excludes price labels',()=>{
 const r=preciseLiquidityZones(shield,'2900',anchors.map(a=>({...a,y:a.y+5})),bounds,axis,1000,1000);assert.equal(r.zones.length,1);assert.equal(r.zones[0].lineY,65);assert.equal(r.zones[0].height,0);assert.equal(r.zones[0].right,89);
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
