import assert from 'node:assert/strict';import test from 'node:test';
import {verifyPocketNativeManifest as verify} from '../scripts/pocket-native-manifest.mjs';
const url='https://immutable.invalid/pocket',revision='a'.repeat(40);
test('bounded manifest verifies exact revision and rejects mismatch/invalid JSON',async()=>{
 assert.equal((await verify(url,revision,{transport:async()=>Response.json({revision})})).revision,revision);
 await assert.rejects(()=>verify(url,revision,{transport:async()=>Response.json({revision:'b'.repeat(40)})}),/MISMATCH/);
 await assert.rejects(()=>verify(url,revision,{transport:async()=>new Response('invalid')}));
});
test('noncooperative pending fetch and body both terminate on deadline',async()=>{
 await assert.rejects(()=>verify(url,revision,{timeoutMs:10,transport:()=>new Promise(()=>{})}),/TIMEOUT/);
 await assert.rejects(()=>verify(url,revision,{timeoutMs:10,transport:async()=>new Response(new ReadableStream({pull(){return new Promise(()=>{});}}))}),/TIMEOUT/);
});
test('streamed oversized payload stops and cancels before full consumption',async()=>{
 let count=0,cancelled=false;
 await assert.rejects(()=>verify(url,revision,{transport:async()=>new Response(new ReadableStream({pull(c){count++;c.enqueue(new Uint8Array(17000));},cancel(){cancelled=true;}}))}),/TOO_LARGE/);
 assert.ok(count<=2);assert.equal(cancelled,true);
});
test('redirect/credential/production/branch URLs denied before transport',async()=>{
 for(const bad of ['http://immutable.invalid/pocket','https://user:pass@immutable.invalid/pocket','https://pocket.nashaimarkets.com/pocket','https://app-git-main.invalid/pocket','https://immutable.invalid/pocket?key=x']){
 let calls=0;await assert.rejects(()=>verify(bad,revision,{transport:async()=>{calls++;return Response.json({revision});}}));assert.equal(calls,0);}
});
test('late fetch response is cancelled after timeout; request forbids redirects',async()=>{
 let cancelled=false;let resolve;let options;
 const pending=verify(url,revision,{timeoutMs:10,transport:(_url,o)=>{options=o;return new Promise(r=>resolve=r);}});
 await assert.rejects(()=>pending,/TIMEOUT/);assert.equal(options.redirect,'error');assert.equal(options.signal.aborted,true);
 resolve(new Response(new ReadableStream({cancel(){cancelled=true;}})));await new Promise(r=>setImmediate(r));assert.equal(cancelled,true);
});
