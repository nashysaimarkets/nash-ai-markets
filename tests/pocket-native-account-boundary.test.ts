import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {stripTypeScriptTypes} from 'node:module';
const source=await readFile(new URL('../app/pocket/apple-storekit.ts',import.meta.url),'utf8');
const accountCode=stripTypeScriptTypes(source.slice(source.indexOf('async function account('),source.indexOf('async function verifyStatus')));
const proofCode=stripTypeScriptTypes(source.slice(source.indexOf('export async function pocketAuthenticatedFetch')).replace(/^export /,''));
const valid={appAccountToken:'00000000-0000-4000-8000-000000000001',entitled:true};
const clock=(fn:()=>void)=>setTimeout(fn,20);
function account(fetcher:typeof fetch){return new Function('fetch','setTimeout',accountCode+';return account;')(fetcher,clock);}
for(const body of [null,{}, {...valid,appAccountToken:'bad'}, {...valid,entitled:'true'}, {...valid,appAccountToken:4}])test('account rejects malformed identity/entitlement '+JSON.stringify(body),async()=>{
 await assert.rejects(account(async()=>Response.json(body))('fixture-proof'),/Invalid Apple account response/);
});
test('account positive preserves verified boolean and prevents proof redirects',async()=>{
 let options:RequestInit|undefined;const result=await account(async(_,init)=>{options=init;return Response.json(valid);})('fixture-proof');
 assert.deepEqual(result,valid);assert.equal(options?.redirect,'error');assert.equal(options?.credentials,'same-origin');
});
test('account bounds noncooperative fetch without echoing provider error',async()=>{
 await assert.rejects(account(async()=>new Promise(()=>{}))(),/timed out/);
});
test('account bounds stalled stream and cancels body',async()=>{
 let cancelled=false;const stream=new ReadableStream({cancel(){cancelled=true;}});
 await assert.rejects(account(async()=>new Response(stream))(),/timed out/);assert.equal(cancelled,true);
});
test('account rejects oversized and malformed JSON bodies',async()=>{
 for(const body of ['x'.repeat(17000),'{broken'])await assert.rejects(account(async()=>new Response(body))());
});
test('account refuses upstream error content and invalid proof without disclosure',async()=>{
 await assert.rejects(account(async()=>new Response('secret',{status:500}))(),/Subscription verification is unavailable/);
 let calls=0;await assert.rejects(account(async()=>{calls++;return Response.json(valid);})('bad\r\nproof'));assert.equal(calls,0);
});
function native(getStatus:()=>Promise<unknown>){let calls=0;const fn=new Function('isAppleNativeApp','native','APPLE_MONTHLY_PRODUCT_ID','fetch','setTimeout','const isGoogleNativeApp=()=>false;'+proofCode+';return pocketAuthenticatedFetch;')(()=>true,{getStatus},'fixture',async()=>{calls++;return new Response('{}');},clock);return {fn,calls:()=>calls};}
test('cancelled noncooperative StoreKit wait terminates and late proof cannot fetch',async()=>{
 let release!:(v:unknown)=>void;const h=native(()=>new Promise(r=>release=r));const a=new AbortController();
 const pending=h.fn('/api/pocket/analyse',{signal:a.signal});a.abort();await assert.rejects(pending,/cancelled/);
 release({signedTransactionInfo:'late-proof'});await new Promise(r=>setImmediate(r));assert.equal(h.calls(),0);
});
test('StoreKit timeout terminates without transport',async()=>{
 const h=native(()=>new Promise(()=>{}));await assert.rejects(h.fn('/api/pocket/analyse'),/timed out/);assert.equal(h.calls(),0);
});
test('malformed StoreKit proof cannot reach fetch',async()=>{
 for(const status of [null,{signedTransactionInfo:4},{signedTransactionInfo:'x'.repeat(24001)},{signedTransactionInfo:'bad\nproof'}]){const h=native(async()=>status);await assert.rejects(h.fn('/api/pocket/analyse'));assert.equal(h.calls(),0);}
});
test('late account response after timeout cancels its body',async()=>{
 let release!:(r:Response)=>void;let cancelled=false;
 const result=account(async()=>new Promise(r=>release=r))();await assert.rejects(result,/timed out/);
 release(new Response(new ReadableStream({cancel(){cancelled=true;}})));await new Promise(r=>setImmediate(r));assert.equal(cancelled,true);
});
const metadataCode=stripTypeScriptTypes(source.slice(source.indexOf('async function nativeMetadata'),source.indexOf('async function account')));
const metadata=new Function('setTimeout',metadataCode+';return nativeMetadata;')(clock);
test('read-only native metadata timeout rejects and cleans late listener registration',async()=>{
 let release!:(v:unknown)=>void,removed=false;const pending=metadata(new Promise(r=>release=r),(h:any)=>h.remove());
 await assert.rejects(pending,/timed out/);release({remove(){removed=true;}});await new Promise(r=>setImmediate(r));assert.equal(removed,true);
});
test('read-only native metadata preserves successful and rejected results',async()=>{
 assert.deepEqual(await metadata(Promise.resolve({isActive:true})),{isActive:true});await assert.rejects(metadata(Promise.reject(Error('fixture'))),/fixture/);
});
const subscribeCode=stripTypeScriptTypes(source.slice(source.indexOf('export async function subscribeAppleAccessChanges'),source.indexOf('/** Every billed route')).replace(/^export /,''));
test('timed-out listener registration suppresses late callbacks and removes late handle',async()=>{
 let callback!:(v:unknown)=>void,release!:(v:unknown)=>void,removed=false;const observations:unknown[]=[];
 const subscribe=new Function('native','App','verifyStatus','isAppleNativeApp','webStatus','APPLE_MONTHLY_PRODUCT_ID','setTimeout',metadataCode+subscribeCode+';return subscribeAppleAccessChanges;')(
 {addListener:(_:unknown,cb:typeof callback)=>{callback=cb;return new Promise(r=>release=r);}}, {},async()=>({}),()=>true,{entitled:false},'fixture',clock);
 await assert.rejects(subscribe((v:unknown)=>observations.push(v)),/timed out/);const count=observations.length;
 callback({entitled:true});release({remove:async()=>{removed=true;}});await new Promise(r=>setImmediate(r));assert.equal(removed,true);assert.equal(observations.length,count);
});
test('second listener timeout does not wait forever on first listener cleanup',async()=>{
 const subscribe=new Function('native','App','verifyStatus','isAppleNativeApp','webStatus','APPLE_MONTHLY_PRODUCT_ID','setTimeout',metadataCode+subscribeCode+';return subscribeAppleAccessChanges;')(
 {addListener:async()=>({remove:async()=>new Promise(()=>{})})},{addListener:async()=>new Promise(()=>{})},async()=>({}),()=>true,{entitled:false},'fixture',clock);
 await assert.rejects(subscribe(()=>{}),/timed out/);
});
test('server error codes survive bounded transport with no raw provider content',async()=>{
 for(const [status,code,expected] of [[401,'POCKET_LOGIN_REQUIRED',/Sign in to your existing/],[503,'POCKET_APPLE_CONFIGURATION',/not configured/],[503,'POCKET_APPLE_OWNERSHIP_UNAVAILABLE',/linking could not/],[503,'INVENTED_SECRET_CODE',/Subscription verification is unavailable/]] as const){
  await assert.rejects(account(async()=>Response.json({code,error:'PRIVATE RECEIPT'}, {status}))(),expected);
 }
});
test('client rejects proof above server limit before transport',async()=>{let calls=0;await assert.rejects(account(async()=>{calls++;return Response.json(valid);})('x'.repeat(16001)));assert.equal(calls,0);});
