import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
async function harness(nativeApp=true){
 const source=await readFile(new URL('../app/pocket/apple-storekit.ts',import.meta.url),'utf8');
 const code=stripTypeScriptTypes(source.slice(source.indexOf('export async function pocketAuthenticatedFetch')).replace(/^export /,''));
 let reads=0,proof:string|undefined='fresh-fixture';const calls:{url:string;init:RequestInit}[]=[];
 const fn=new Function('isAppleNativeApp','native','APPLE_MONTHLY_PRODUCT_ID','fetch',code+';return pocketAuthenticatedFetch;')(
 ()=>nativeApp,{getStatus:async()=>{reads++;return{signedTransactionInfo:proof};}},'existing-product',async(url:string,init:RequestInit)=>{calls.push({url,init});return new Response('{}');}
 ) as (url:string,init?:RequestInit)=>Promise<Response>;
 return{fn,calls,get reads(){return reads;},proof:(p:string|undefined)=>{proof=p;}};
}
for(const path of ['https://outside.example/api/pocket/analyse','//outside.example/api/pocket/analyse','/api/pocket/../../outside','/api/pocket/\\outside','/api/pocket/analyse#fragment','/api/pocket/%2e%2e/outside','/api/stripe/checkout'])test('native proof cannot escape Pocket endpoint: '+path,async()=>{const h=await harness();await assert.rejects(h.fn(path));assert.equal(h.reads,0);assert.equal(h.calls.length,0);});
test('native transport drops caller-supplied stale Apple proof when StoreKit has none',async()=>{const h=await harness();h.proof(undefined);await h.fn('/api/pocket/analyse',{headers:{'x-pocket-apple-transaction':'old-proof','content-type':'application/json'}});const headers=new Headers(h.calls[0].init.headers);assert.equal(headers.has('x-pocket-apple-transaction'),false);assert.equal(headers.get('content-type'),'application/json');});
test('native transport refuses redirect following and includes only fresh proof',async()=>{const h=await harness();await h.fn('/api/pocket/options-wall',{redirect:'follow',credentials:'include',headers:{'x-pocket-apple-transaction':'stale'}});assert.equal(h.calls[0].init.redirect,'error');assert.equal(h.calls[0].init.credentials,'same-origin');assert.equal(new Headers(h.calls[0].init.headers).get('x-pocket-apple-transaction'),'fresh-fixture');});
test('web transport retains existing fetch contract without StoreKit access',async()=>{const h=await harness(false);await h.fn('/api/pocket/analyse',{redirect:'manual'});assert.equal(h.reads,0);assert.equal(h.calls[0].init.redirect,'manual');});
