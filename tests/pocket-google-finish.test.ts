import test from 'node:test';import assert from 'node:assert/strict';
import {createPocketGoogleBinding} from '../app/lib/server/pocket-google-bootstrap.ts';
import {createGoogleReconciler} from '../app/api/pocket/google-reconciliation.mjs';
const id='11111111-1111-4111-8111-111111111111',hash='a'.repeat(64),origin='https://candidate.invalid',revision='b'.repeat(40);
function fixture(){let owner=id,identity={authProject:'approved-auth',storage:'isolated-store'};let queries=0;
 const config={origin,revision,identity:{...identity},google:{packageName:'com.nashaimarkets.pocketbullseye',productId:'pocket_bullseye_monthly',basePlanIds:['monthly'],environment:'sandbox' as const,timeoutMs:10}};
 const ports={authenticate:async()=>({id:owner,email:'test@example.invalid',email_confirmed_at:'yes'}),inspectIdentity:async()=>identity,readObfuscatedAccountId:async()=> 'server-derived-owner',pool:{query:async()=>{queries++;return {rows:[{result:{status:'UNBOUND'}}]};}},readAccessToken:async()=>'',fetch:async()=>Response.json({})};
 return{config,ports,setOwner:(v:string)=>owner=v,setIdentity:(v:typeof identity)=>identity=v,queries:()=>queries};}
test('bootstrap requires explicit sandbox identity without reads or activation',()=>{const f=fixture();createPocketGoogleBinding(f.config,f.ports);assert.equal(f.queries(),0);assert.throws(()=>createPocketGoogleBinding({...f.config,origin:'https://pocket.nashaimarkets.com'},f.ports));assert.throws(()=>createPocketGoogleBinding({...f.config,google:{...f.config.google,environment:'production' as 'sandbox'}},f.ports));});
test('configured auth and storage identity mismatch denies before purchase query',async()=>{const f=fixture(),b=createPocketGoogleBinding(f.config,f.ports);f.setIdentity({authProject:'wrong',storage:'isolated-store'});await assert.rejects(()=>b.authenticate(new Request(origin)));assert.equal(f.queries(),0);});
test('request-scoped runtime reauthenticates owner and does not consume scanner body',async()=>{const f=fixture(),b=createPocketGoogleBinding(f.config,f.ports),request=new Request(origin,{method:'POST',body:'original'});const runtime=b.runtime(request,id);f.setOwner('22222222-2222-4222-8222-222222222222');assert.equal((await runtime.admitScan({purchaseToken:'synthetic'})).allowed,false);assert.equal(f.queries(),0);assert.equal(await request.text(),'original');});
test('bootstrap snapshots configuration and selected ports',async()=>{const f=fixture(),b=createPocketGoogleBinding(f.config,f.ports);f.config.identity.authProject='changed';f.ports.authenticate=async()=>{throw Error();};assert.equal((await b.authenticate(new Request(origin)))?.id,id);});

function acknowledgementFixture(enabled = true) {
 const f=fixture(); let binding:Record<string,unknown>={status:'UNBOUND'};
 const calls:string[]=[];
 const now=Date.now();
 const purchase={kind:'androidpublisher#subscriptionPurchaseV2',testPurchase:{},subscriptionState:'SUBSCRIPTION_STATE_ACTIVE',startTime:new Date(now-3600000).toISOString(),acknowledgementState:'ACKNOWLEDGEMENT_STATE_PENDING',externalAccountIdentifiers:{obfuscatedExternalAccountId:'server-derived-owner'},lineItems:[{productId:f.config.google.productId,offerDetails:{basePlanId:'monthly'},expiryTime:new Date(now+86400000).toISOString()}]};
 const config={...f.config,google:{...f.config.google,timeoutMs:500,acknowledgementEnabled:enabled}};
 const ports={...f.ports,readAccessToken:async()=>'synthetic-oauth',pool:{query:async(sql:string,values:string[])=>{
  if(sql.includes('claim_token')) {binding={status:'BOUND',accountId:values[0],packageName:values[1],environment:values[2],revoked:false,replacedByTokenSha256:null};return {rows:[{result:{status:'RECORDED',entitled:false,created:true,accountId:values[0],packageName:values[1],environment:values[2],tokenSha256:values[3],supersedesTokenSha256:values[4]}}]};}
  return {rows:[{result:binding}]};
 }},fetch:async(_url:RequestInfo|URL,init?:RequestInit)=>{
  calls.push(init?.method??'GET');
  if(init?.method==='POST'){purchase.acknowledgementState='ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED';return new Response(null,{status:200});}
  return Response.json(purchase);
 }};
 return {config,ports,purchase,calls};
}
test('explicit sandbox bootstrap acknowledgement reaches real adapter and rechecks current purchase',async()=>{
 const f=acknowledgementFixture(),b=createPocketGoogleBinding(f.config,f.ports);
 const r=await b.runtime(new Request(origin),id).synchronise({purchaseToken:'synthetic-purchase',signal:new AbortController().signal});
 assert.equal(r.allowed,true,JSON.stringify({r,calls:f.calls}));assert.equal(r.entitled,false);assert.deepEqual(f.calls,['GET','POST','GET']);
});
test('bootstrap acknowledgement remains OFF when omitted or explicitly false',async()=>{
 for(const omitted of [true,false]){
  const f=acknowledgementFixture(false),{acknowledgementEnabled:_enabled,...google}=f.config.google;
  const config=omitted?{...f.config,google}:f.config;
  const r=await createPocketGoogleBinding(config,f.ports).runtime(new Request(origin),id).synchronise({purchaseToken:'synthetic-purchase',signal:new AbortController().signal});
  assert.equal(r.allowed,false);assert.equal((r as {reason?:string}).reason,'ACKNOWLEDGEMENT_REQUIRED');assert.deepEqual(f.calls,['GET']);
 }
});
test('real acknowledgement receipt cannot admit a purchase still pending at fresh Google read',async()=>{
 const f=acknowledgementFixture(),send=f.ports.fetch;
 f.ports.fetch=async(url,init)=>{if(init?.method==='POST'){f.calls.push('POST');return new Response(null,{status:200});}return send(url,init);};
 const r=await createPocketGoogleBinding(f.config,f.ports).runtime(new Request(origin),id).synchronise({purchaseToken:'synthetic-purchase',signal:new AbortController().signal});
 assert.equal(r.allowed,false);assert.equal(r.entitled,false);assert.deepEqual(f.calls,['GET','POST','GET']);
});
test('ownership revocation during acknowledgement is denied by the existing fresh recheck',async()=>{
 const f=acknowledgementFixture(),send=f.ports.fetch,query=f.ports.pool.query;let revoked=false;
 f.ports.fetch=async(url,init)=>{const response=await send(url,init);if(init?.method==='POST')revoked=true;return response;};
 f.ports.pool.query=async(sql,values)=>{const r=await query(sql,values);if(revoked&&sql.includes('lookup_token'))r.rows[0].result={...r.rows[0].result,revoked:true};return r;};
 const r=await createPocketGoogleBinding(f.config,f.ports).runtime(new Request(origin),id).synchronise({purchaseToken:'synthetic-purchase',signal:new AbortController().signal});
 assert.equal(r.allowed,false);assert.equal(r.entitled,false);assert.deepEqual(f.calls,['GET','POST']);
});
test('account change during acknowledgement cannot admit the original account',async()=>{
 const f=acknowledgementFixture(),send=f.ports.fetch,authenticate=f.ports.authenticate;let changed=false;
 f.ports.fetch=async(url,init)=>{const response=await send(url,init);if(init?.method==='POST')changed=true;return response;};
 f.ports.authenticate=async()=>({...await authenticate(),id:changed?'22222222-2222-4222-8222-222222222222':id});
 const r=await createPocketGoogleBinding(f.config,f.ports).runtime(new Request(origin),id).synchronise({purchaseToken:'synthetic-purchase',signal:new AbortController().signal});
 assert.equal(r.allowed,false);assert.equal(r.entitled,false);assert.deepEqual(f.calls,['GET','POST']);
});
test('ambiguous acknowledgement through factory stays HOLD with one POST and no retry',async()=>{
 const f=acknowledgementFixture(),send=f.ports.fetch;
 f.ports.fetch=async(url,init)=>{if(init?.method==='POST'){f.calls.push('POST');throw Error('synthetic-private-error');}return send(url,init);};
 const r=await createPocketGoogleBinding(f.config,f.ports).runtime(new Request(origin),id).synchronise({purchaseToken:'synthetic-purchase',signal:new AbortController().signal});
 assert.equal(r.allowed,false);assert.equal(r.entitled,false);assert.equal((r as {reason?:string}).reason,'ACKNOWLEDGEMENT_UNKNOWN');assert.deepEqual(f.calls,['GET','POST']);
 assert.ok(!JSON.stringify(r).includes('synthetic-private-error'));
});
function reconciliation(){let commits=0;const now=1000000;const config={packageName:'test.package',environment:'sandbox',issuer:'trusted',audience:'expected',timeoutMs:10};const event={issuer:'trusted',audience:'expected',eventId:'event-1',packageName:'test.package',environment:'sandbox',tokenSha256:hash,observedAtMs:now};const ports={clock:()=>now,verifyDelivery:async()=>event,readTokenBinding:async()=>({status:'BOUND',accountId:id,packageName:'test.package',environment:'sandbox'}),readRevocation:async()=>({tokenSha256:hash,packageName:'test.package',environment:'sandbox',state:'VOIDED',observedAtMs:now}),commitRevocation:async()=>{commits++;return {status:'REVOKED'};}};return{config,event,ports,commits:()=>commits};}
test('trusted event plus authoritative current voiding reconciles without granting entitlement',async()=>{const f=reconciliation(),r=await createGoogleReconciler(f.config,f.ports).reconcile(new Request(origin));assert.deepEqual(r,{status:'REVOKED',entitled:false,reconciliationRequired:false});assert.equal(f.commits(),1);});
test('wrong issuer/audience/scope and stale deliveries cannot write',async()=>{for(const patch of [{issuer:'evil'},{audience:'other'},{environment:'production'},{observedAtMs:0},{tokenSha256:'bad'}]){const f=reconciliation();Object.assign(f.event,patch);assert.equal((await createGoogleReconciler(f.config,f.ports).reconcile(new Request(origin))).status,'HOLD');assert.equal(f.commits(),0);}});
test('unknown token is unresolved and never reported revoked',async()=>{const f=reconciliation();f.ports.readTokenBinding=async()=>({status:'UNBOUND'} as never);assert.equal((await createGoogleReconciler(f.config,f.ports).reconcile(new Request(origin)) as {reason?:string}).reason,'UNKNOWN_TOKEN_REQUIRES_REVIEW');assert.equal(f.commits(),0);});
test('notification cannot grant or revoke from an active/expired/unconfirmed read',async()=>{for(const state of ['ACTIVE','EXPIRED','UNKNOWN']){const f=reconciliation();f.ports.readRevocation=async()=>({...f.event,state});assert.equal((await createGoogleReconciler(f.config,f.ports).reconcile(new Request(origin))).status,'HOLD');assert.equal(f.commits(),0);}});
test('verification timeout and pre-cancellation cause no commit',async()=>{const f=reconciliation();f.ports.verifyDelivery=()=>new Promise(()=>{});assert.equal((await createGoogleReconciler(f.config,f.ports).reconcile(new Request(origin))).status,'HOLD');const c=new AbortController();c.abort();assert.equal((await createGoogleReconciler(f.config,f.ports).reconcile(new Request(origin,{signal:c.signal}))).status,'HOLD');assert.equal(f.commits(),0);});
test('ambiguous post-dispatch timeout stays UNCERTAIN with no retry',async()=>{const f=reconciliation();let commits=0;f.ports.commitRevocation=()=>{commits++;return new Promise(()=>{});};const r=await createGoogleReconciler(f.config,f.ports).reconcile(new Request(origin));assert.equal(r.status,'UNCERTAIN');assert.equal(commits,1);});
