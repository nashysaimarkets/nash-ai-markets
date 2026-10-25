import test from 'node:test';
import assert from 'node:assert/strict';
import {createGoogleSubscriptionAcknowledger} from '../app/api/pocket/google-subscription-acknowledgement.mjs';

function fixture(){
 const config={packageName:'com.nashaimarkets.pocketbullseye',productId:'pocket_bullseye_monthly',environment:'sandbox',acknowledgementEnabled:true,timeoutMs:100};
 const requests=[];let oauthReads=0;
 const ports={readAccessToken:async()=>{oauthReads++;return 'synthetic-oauth';},fetch:async(url,options)=>{requests.push({url,options});return new Response(null,{status:200});}};
 const input={packageName:config.packageName,productId:config.productId,purchaseToken:'synthetic/+?%#=[]'};
 return {config,ports,input,requests,oauthReads:()=>oauthReads,make(){return createGoogleSubscriptionAcknowledger(config,ports);}};
}

test('construction is inert and requires explicit sandbox enablement and trusted ports',()=>{
 const f=fixture();f.make();assert.equal(f.requests.length,0);assert.equal(f.oauthReads(),0);
 for(const patch of [{environment:'production'},{acknowledgementEnabled:false},{acknowledgementEnabled:undefined},{timeoutMs:0},{timeoutMs:10001},{packageName:'../other'},{productId:'..'}])assert.throws(()=>createGoogleSubscriptionAcknowledger({...f.config,...patch},f.ports),/GOOGLE_ACKNOWLEDGEMENT_INVALID/);
 assert.throws(()=>createGoogleSubscriptionAcknowledger(f.config,{}));
});

test('one encoded fixed-origin POST uses trusted OAuth and cannot grant entitlement',async()=>{
 const f=fixture(),r=await f.make().acknowledge(f.input);
 assert.deepEqual(r,{status:'ACKNOWLEDGED',acknowledged:true,entitled:false,requestDispatched:true,reconciliationRequired:false});
 assert.equal(f.requests.length,1);const {url,options}=f.requests[0];
 assert.equal(url,`https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${f.config.packageName}/purchases/subscriptions/${f.config.productId}/tokens/synthetic%2F%2B%3F%25%23%3D%5B%5D:acknowledge`);
 assert.deepEqual({...options,signal:undefined},{method:'POST',redirect:'error',credentials:'omit',cache:'no-store',headers:{Authorization:'Bearer synthetic-oauth',Accept:'application/json','Content-Type':'application/json'},body:'{}',signal:undefined});
 assert.equal(options.signal.aborted,true);assert.ok(!JSON.stringify(r).includes('synthetic'));
});

test('wrong scope, invalid token/signal and pre-cancellation never obtain OAuth or dispatch',async()=>{
 for(const patch of [{packageName:'com.other.app'},{productId:'other'},{purchaseToken:''},{purchaseToken:'a'.repeat(4097)},{purchaseToken:'bad\r\nheader'},{signal:{}}]){
  const f=fixture(),r=await f.make().acknowledge({...f.input,...patch});
  assert.equal(r.status,'NOT_SENT');assert.equal(r.reconciliationRequired,false);assert.equal(f.requests.length,0);assert.equal(f.oauthReads(),0);
 }
 const f=fixture(),c=new AbortController();c.abort();assert.equal((await f.make().acknowledge({...f.input,signal:c.signal})).status,'NOT_SENT');assert.equal(f.oauthReads(),0);
});

test('invalid or failed OAuth is sanitized without dispatch',async()=>{
 for(const value of ['', 'a\nb', 'a'.repeat(8193),'non_ascii_é']){
  const f=fixture();f.ports.readAccessToken=async()=>value;
  const r=await f.make().acknowledge(f.input);assert.equal(r.status,'NOT_SENT');assert.equal(f.requests.length,0);assert.ok(!JSON.stringify(r).includes(value)||value==='');
 }
 const f=fixture();f.ports.readAccessToken=async()=>{throw Error('private-oauth-error');};assert.equal((await f.make().acknowledge(f.input)).status,'NOT_SENT');
});

test('OAuth timeout aborts its own signal and cannot dispatch after late resolution',async()=>{
 const f=fixture();f.config.timeoutMs=10;let release,signal;
 f.ports.readAccessToken=({signal:s})=>{signal=s;return new Promise(resolve=>{release=resolve;});};
 const r=await f.make().acknowledge(f.input);assert.equal(r.status,'NOT_SENT');assert.equal(signal.aborted,true);release('synthetic-oauth');
 await new Promise(resolve=>setImmediate(resolve));assert.equal(f.requests.length,0);
});

test('HTTP rejection redirects and nonempty success bodies remain uncertain and unread bodies close',async()=>{
 const cases=[()=>new Response('private-error',{status:500}),()=>new Response(null,{status:302,headers:{location:'https://evil.invalid'}}),()=>new Response('unexpected',{status:200}),()=>new Response('',{status:200,headers:{'content-length':'bad'}}),()=>new Response(null,{status:204})];
 for(const response of cases){const f=fixture();let calls=0;f.ports.fetch=async()=>{calls++;return response();};const r=await f.make().acknowledge(f.input);assert.equal(r.status,'UNCERTAIN');assert.equal(r.acknowledged,false);assert.equal(r.reconciliationRequired,true);assert.equal(calls,1);assert.ok(!JSON.stringify(r).includes('private-error'));}
 let cancelled=0;const f=fixture();f.ports.fetch=async()=>new Response(new ReadableStream({cancel(){cancelled++;}}),{status:503});await f.make().acknowledge(f.input);assert.equal(cancelled,1);
});

test('foreign response origin and redirected success are refused and closed',async()=>{
 for(const property of [{url:'https://evil.invalid/receipt'},{redirected:true}]){const f=fixture();let cancelled=0;
  f.ports.fetch=async()=>{const response=new Response(new ReadableStream({cancel(){cancelled++;}}),{status:200});for(const [key,value] of Object.entries(property))Object.defineProperty(response,key,{value});return response;};
  assert.equal((await f.make().acknowledge(f.input)).status,'UNCERTAIN');assert.equal(cancelled,1);
 }
});

test('stalled empty response stream reaches deadline and closes its reader',async()=>{
 const f=fixture();f.config.timeoutMs=10;let cancelled=0,signal;
 f.ports.fetch=async(_url,options)=>{signal=options.signal;return new Response(new ReadableStream({cancel(){cancelled++;}}),{status:200});};
 const r=await f.make().acknowledge(f.input);assert.equal(r.status,'UNCERTAIN');assert.equal(signal.aborted,true);assert.equal(cancelled,1);
});

test('dispatch timeout stays uncertain with one attempt and cancels a late body',async()=>{
 const f=fixture();f.config.timeoutMs=10;let release,signal,calls=0,cancelled=0;
 f.ports.fetch=(_url,options)=>{calls++;signal=options.signal;return new Promise(resolve=>{release=resolve;});};
 const r=await f.make().acknowledge(f.input);assert.equal(r.status,'UNCERTAIN');assert.equal(signal.aborted,true);assert.equal(calls,1);
 release(new Response(new ReadableStream({cancel(){cancelled++;}}),{status:200}));await new Promise(resolve=>setImmediate(resolve));assert.equal(cancelled,1);assert.equal(calls,1);
});

test('caller cancellation during dispatch is uncertain and no retry occurs',async()=>{
 const f=fixture(),c=new AbortController();let calls=0,signal;
 f.ports.fetch=async(_url,options)=>{calls++;signal=options.signal;c.abort();throw Error('private-http-error');};
 const r=await f.make().acknowledge({...f.input,signal:c.signal});assert.equal(r.status,'UNCERTAIN');assert.equal(signal.aborted,true);assert.equal(calls,1);assert.ok(!JSON.stringify(r).includes('private-http-error'));
});

test('configuration ports and token are frozen across awaited OAuth',async()=>{
 const f=fixture();let release;
 f.ports.readAccessToken=()=>new Promise(resolve=>{release=resolve;});
 const adapter=f.make(),pending=adapter.acknowledge(f.input);await new Promise(resolve=>setImmediate(resolve));
 f.config.packageName='com.changed.app';f.config.productId='changed';f.input.purchaseToken='changed';f.ports.fetch=()=>assert.fail('Captured fetch required');
 release('synthetic-oauth');assert.equal((await pending).status,'ACKNOWLEDGED');assert.ok(f.requests[0].url.includes('/pocket_bullseye_monthly/tokens/synthetic%2F'));
});

test('empty streamed HTTP200 receipt is accepted and transport failures stay sanitized',async()=>{
 const f=fixture();f.ports.fetch=async()=>new Response(new ReadableStream({start(controller){controller.enqueue(new Uint8Array());controller.close();}}),{status:200,headers:{'content-length':'0'}});
 assert.equal((await f.make().acknowledge(f.input)).acknowledged,true);
 f.ports.fetch=async()=>{throw Error('private-token-and-response');};const r=await f.make().acknowledge(f.input);assert.equal(r.status,'UNCERTAIN');assert.ok(!JSON.stringify(r).includes('private'));
});
