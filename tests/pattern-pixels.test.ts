import test from 'node:test';import assert from 'node:assert/strict';
import {pixelCheckedPatterns} from '../app/pocket/pattern-pixels';
import type {Analysis} from '../app/pocket/analysis-types';
const bounds={left:5,right:90,top:10,bottom:90};
const pixels={width:1000,height:2000,candles:[{id:0,left:249,right:251,x:250,highY:400,lowY:600,upperWick:true,lowerWick:true},{id:1,left:549,right:551,x:550,highY:450,lowY:700,upperWick:true,lowerWick:true}]};
const pattern:Analysis['patterns'][number]={name:'RANGE',timeframe:'1h',status:'FORMING',confidence:'MEDIUM',evidence:'Reported',invalidation:'Break',geometry:{points:[{x:25,y:20},{x:55,y:35}],labelX:25,labelY:20}};
const check=(p=pattern,w=pixels)=>pixelCheckedPatterns([p],'1h',bounds,w);
test('every historical vertex must match a distinct original endpoint',()=>{assert.equal(check().length,1);assert.ok(Math.abs(check()[0].geometry!.points[1].x-55)<1e-10);assert.equal(check({...pattern,geometry:{...pattern.geometry!,points:[{x:25,y:21},{x:55,y:35}]}}).length,0);});
test('wrong source, timeframe, low confidence, future points and duplicates stay undrawn',()=>{
 for(const p of [{...pattern,sourceRole:'HIGHER_TIMEFRAME' as const},{...pattern,timeframe:'4h'},{...pattern,confidence:'LOW' as const},{...pattern,geometry:{...pattern.geometry!,points:[{x:25,y:20},{x:98,y:35}]}},{...pattern,geometry:{...pattern.geometry!,points:[{x:25,y:20},{x:25,y:30}]}}])assert.equal(check(p).length,0);
 assert.equal(pixelCheckedPatterns([pattern],'1h',bounds,null).length,0);
});
test('two possible endpoints, reverse history and invalid coordinates cannot be repaired',()=>{
 assert.equal(check(pattern,{...pixels,candles:[...pixels.candles,{...pixels.candles[0],id:2}]}).length,0);
 assert.equal(check({...pattern,geometry:{...pattern.geometry!,points:[...pattern.geometry!.points].reverse()}}).length,0);
 assert.equal(check({...pattern,geometry:{...pattern.geometry!,points:[{x:NaN,y:20},{x:55,y:35}]}}).length,0);
});
