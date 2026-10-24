import test from 'node:test';import assert from 'node:assert/strict';
import {sendIgDemoAction} from '../app/lib/ig-demo-client.ts';
const signal=()=>new AbortController().signal;
test('browser bridge forwards opaque reference only through fixed local route',async()=>{
 let request:RequestInit|undefined;const result=await sendIgDemoAction('connect',signal(),'opaque-token',async(url,init)=>{assert.equal(url,'/api/pocket/ig-demo');request=init;return Response.json({environment:'DEMO'});});assert.deepEqual(result,{environment:'DEMO'});assert.equal(request?.redirect,'error');assert.equal(request?.credentials,'same-origin');assert.deepEqual(JSON.parse(request?.body as string),{action:'connect',chartToken:'opaque-token'});
});
test('malformed JSON/media type and advertised/streamed oversize fail closed',async()=>{
 for(const r of [new Response('{bad',{headers:{'content-type':'application/json'}}),new Response('{}'),new Response('{}',{headers:{'content-type':'application/json','content-length':'65537'}}),new Response('x'.repeat(65537),{headers:{'content-type':'application/json'}})])await assert.rejects(sendIgDemoAction('refresh',signal(),undefined,async()=>r));
});
test('cancellation bounds stalled response body and cancels stream',async()=>{let cancelled=false,started!:()=>void;const ready=new Promise<void>(r=>started=r);const a=new AbortController();const p=sendIgDemoAction('refresh',a.signal,undefined,async()=>{started();return new Response(new ReadableStream({cancel(){cancelled=true;}}),{headers:{'content-type':'application/json'}});});await ready;await new Promise(r=>setImmediate(r));a.abort();await assert.rejects(p);assert.equal(cancelled,true);});
test('late response after cancellation cannot resurrect or keep body open',async()=>{let release!:(r:Response)=>void,cancelled=false;const a=new AbortController();const p=sendIgDemoAction('refresh',a.signal,undefined,async()=>new Promise(r=>release=r));a.abort();await assert.rejects(p);release(new Response(new ReadableStream({cancel(){cancelled=true;}})));await new Promise(r=>setImmediate(r));assert.equal(cancelled,true);});
test('429 remains rate-limited and other upstream details remain redacted',async()=>{await assert.rejects(sendIgDemoAction('refresh',signal(),undefined,async()=>new Response('private',{status:429})),/RATE_LIMITED/);await assert.rejects(sendIgDemoAction('refresh',signal(),undefined,async()=>new Response('private',{status:500})),/UNAVAILABLE/);});
test('invalid reference or already cancelled request cannot reach transport',async()=>{let n=0;const transport=async()=>{n++;return Response.json({});};await assert.rejects(sendIgDemoAction('refresh',signal(),'../bad',transport));const a=new AbortController();a.abort();await assert.rejects(sendIgDemoAction('refresh',a.signal,undefined,transport));assert.equal(n,0);});
test('rejected header or HTTP status cancels noncooperative body before reading',async()=>{
 for(const init of ([{status:500},{headers:{'content-type':'text/plain'}},{headers:{'content-type':'application/json','content-length':'70000'}}] as ResponseInit[])){let cancelled=false;const body=new ReadableStream({cancel(){cancelled=true;}});await assert.rejects(sendIgDemoAction('refresh',signal(),undefined,async()=>new Response(body,init)));assert.equal(cancelled,true);}
});
test('fixed browser deadline bounds noncooperative transport',async(t)=>{
 t.mock.timers.enable({apis:['setTimeout']});const p=sendIgDemoAction('refresh',signal(),undefined,async()=>new Promise(()=>{}));const rejected=assert.rejects(p,/UNAVAILABLE/);t.mock.timers.tick(10000);await rejected;t.mock.timers.reset();
});
