import test from 'node:test';import assert from 'node:assert/strict';
import {createSharedAxisReader} from '../app/pocket/axis-reader-cache';
import type {AxisVerification} from '../app/pocket/axis-verification';
const image={src:'data:image/png;base64,source',currentSrc:'',naturalWidth:1000,naturalHeight:1000} as HTMLImageElement;
const bounds={left:0,right:90,top:10,bottom:90},anchors=[{price:3,y:20},{price:2,y:50},{price:1,y:80}];
const verified:AxisVerification={status:'verified',anchors,matchedModelTicks:3};
test('concurrent scanners share one reader; cancelling one does not cancel the other',async()=>{
 let calls=0,signal:AbortSignal|undefined,finish!:(r:AxisVerification)=>void;
 const shared=createSharedAxisReader(async(_i,_b,_r,_m,s)=>{calls++;signal=s;return new Promise(resolve=>finish=resolve);});
 const a=new AbortController(),b=new AbortController();
 const first=shared(image,bounds,[20,50,80],anchors,a.signal),second=shared(image,bounds,[20,50,80],anchors,b.signal);
 a.abort();assert.equal((await first).status,'held');assert.equal(signal?.aborted,false);finish(verified);assert.equal((await second).status,'verified');assert.equal(calls,1);
 assert.equal((await shared(image,bounds,[20,50,80],anchors,new AbortController().signal)).status,'verified');assert.equal(calls,1);
});
test('last consumer cancellation stops the worker and incomplete results are never reused',async()=>{
 let calls=0;const signals:AbortSignal[]=[];
 const shared=createSharedAxisReader(async(_i,_b,_r,_m,s)=>{calls++;signals.push(s);return new Promise(resolve=>s.addEventListener('abort',()=>resolve({status:'held',reason:'cancelled'}),{once:true}));});
 const controller=new AbortController(),first=shared(image,bounds,[],anchors,controller.signal);controller.abort();await first;assert.equal(signals[0].aborted,true);
 const next=new AbortController(),second=shared(image,bounds,[],anchors,next.signal);assert.equal(calls,2);next.abort();await second;
});
test('failed reads retry; different source pixels or scale evidence require separate reads',async()=>{
 let calls=0;const shared=createSharedAxisReader(async()=>{calls++;return calls===1?{status:'held',reason:'unreadable'}:verified;});
 const signal=new AbortController().signal;await shared(image,bounds,[],anchors,signal);await shared(image,bounds,[],anchors,signal);assert.equal(calls,2);
 await shared({...image,src:'different'} as HTMLImageElement,bounds,[],anchors,signal);await shared(image,bounds,[20,50,80],anchors,signal);assert.equal(calls,4);
});
