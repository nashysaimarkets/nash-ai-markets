import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,generateKeyPairSync,sign} from 'node:crypto';
import {createGoogleNotificationDeliveryVerifier} from '../app/api/pocket/google-notification-delivery.mjs';
import {createGoogleCurrentRevocationReader} from '../app/api/pocket/google-current-revocation.mjs';
import {createGoogleReconciler} from '../app/api/pocket/google-reconciliation.mjs';

const keys=generateKeyPairSync('rsa',{modulusLength:2048});
const jwk={...keys.publicKey.export({format:'jwk'}),kid:'test-key',alg:'RS256',use:'sig'};
const accountId='11111111-1111-4111-8111-111111111111',purchaseToken='synthetic-purchase/+?';
const hash=createHash('sha256').update(purchaseToken).digest('hex');
const baseNow=Date.parse('2026-10-25T08:00:00Z');
function jwt(claims,header={alg:'RS256',kid:'test-key',typ:'JWT'}){
 const message=[header,claims].map(x=>Buffer.from(JSON.stringify(x)).toString('base64url')).join('.');
 return `${message}.${sign('RSA-SHA256',Buffer.from(message),keys.privateKey).toString('base64url')}`;
}
function fixture(){
 let now=baseNow;
 const config={packageName:'com.nashaimarkets.pocketbullseye',productId:'pocket_bullseye_monthly',basePlanIds:['monthly'],environment:'sandbox',issuer:'https://accounts.google.com',audience:'https://candidate.invalid/api/pocket/google-notifications',serviceAccountEmail:'rtdn-check@synthetic-project.iam.gserviceaccount.com',subscription:'projects/synthetic-project/subscriptions/rtdn-test',timeoutMs:1000};
 const claims={iss:config.issuer,aud:config.audience,email:config.serviceAccountEmail,email_verified:true,sub:'123456789012345678901',iat:now/1000-30,exp:now/1000+1800};
 const event={version:'1.0',packageName:config.packageName,eventTimeMillis:String(now-1000),subscriptionNotification:{version:'1.0',notificationType:13,purchaseToken}};
 const binding={status:'BOUND',accountId,packageName:config.packageName,environment:'sandbox',revoked:false,replacedByTokenSha256:null};
 const purchase={kind:'androidpublisher#subscriptionPurchaseV2',testPurchase:{},subscriptionState:'SUBSCRIPTION_STATE_EXPIRED',externalAccountIdentifiers:{obfuscatedExternalAccountId:'server-owner'},lineItems:[{productId:config.productId,offerDetails:{basePlanId:'monthly'},latestSuccessfulOrderId:'GPA.synthetic..0',expiryTime:new Date(now-1000).toISOString()}]};
 const voided={voidedPurchases:[{purchaseToken,orderId:'GPA.synthetic..0',purchaseTimeMillis:String(now-86400000),voidedTimeMillis:String(now-1000)}]};
 const requests=[];let bindings=0,oauth=0;
 const ports={clock:()=>now,readTokenBinding:async()=>{bindings++;return structuredClone(binding);},readObfuscatedAccountId:async()=> 'server-owner',readAccessToken:async()=>{oauth++;return 'synthetic-oauth';},fetch:async(url,options)=>{
  requests.push({url,options});
  if(url==='https://www.googleapis.com/oauth2/v3/certs')return Response.json({keys:[jwk]});
  if(url.includes('/subscriptionsv2/'))return Response.json(purchase);
  if(url.includes('/voidedpurchases?'))return Response.json(voided);
  assert.fail('Unexpected endpoint');
 }};
 function request(overrides={}){
  const envelope={subscription:config.subscription,message:{messageId:'message-1',data:Buffer.from(JSON.stringify(event)).toString('base64')},...overrides.envelope};
  return new Request(config.audience,{method:'POST',headers:{authorization:`Bearer ${jwt(claims,overrides.header)}`,'content-type':'application/json',...overrides.headers},body:JSON.stringify(envelope),signal:overrides.signal});
 }
 const delivered=()=>({issuer:config.issuer,audience:config.audience,eventId:'message-1',packageName:config.packageName,environment:'sandbox',tokenSha256:hash,observedAtMs:now-1000,purchaseToken});
 return {config,claims,event,binding,purchase,voided,ports,requests,request,delivered,setNow:x=>now=x,bindings:()=>bindings,oauth:()=>oauth};
}

test('adapter construction is inert and rejects missing identity or production scope',()=>{
 const f=fixture();createGoogleNotificationDeliveryVerifier(f.config,f.ports);createGoogleCurrentRevocationReader(f.config,f.ports);assert.equal(f.requests.length,0);assert.equal(f.bindings(),0);
 for(const patch of [{environment:'production'},{issuer:'https://evil.invalid'},{audience:'http://candidate.invalid'},{serviceAccountEmail:'unknown@example.invalid'},{subscription:'other'}])assert.throws(()=>createGoogleNotificationDeliveryVerifier({...f.config,...patch},f.ports),/GOOGLE_DELIVERY_UNVERIFIED/);
 assert.throws(()=>createGoogleCurrentRevocationReader({...f.config,environment:'production'},f.ports));
});

test('actual RS256 signature and current ownership derive sandbox scope from fixed JWKS',async()=>{
 const f=fixture(),event=await createGoogleNotificationDeliveryVerifier(f.config,f.ports).verifyDelivery(f.request());
 assert.equal(event.environment,'sandbox');assert.equal(event.tokenSha256,hash);assert.equal(event.purchaseToken,purchaseToken);assert.equal(event.issuer,f.config.issuer);assert.equal(event.eventId,'message-1');
 assert.equal(f.bindings(),1);assert.equal(f.requests.length,1);const call=f.requests[0];assert.equal(call.url,'https://www.googleapis.com/oauth2/v3/certs');assert.equal(call.options.method,'GET');assert.equal(call.options.headers.Authorization,undefined);assert.equal(call.options.redirect,'error');assert.equal(call.options.signal.aborted,true);
});

test('tampered signature is rejected before authoritative ownership lookup',async()=>{
 const f=fixture(),req=f.request(),parts=req.headers.get('authorization').slice(7).split('.');parts[2]=(parts[2][0]==='A'?'B':'A')+parts[2].slice(1);
 const bad=new Request(f.config.audience,{method:'POST',headers:{authorization:`Bearer ${parts.join('.')}`,'content-type':'application/json'},body:await req.text()});
 await assert.rejects(()=>createGoogleNotificationDeliveryVerifier(f.config,f.ports).verifyDelivery(bad),/^Error: GOOGLE_DELIVERY_UNVERIFIED$/);assert.equal(f.bindings(),0);
});

test('issuer audience verified email lifetime and algorithm constraints reject before key fetch',async()=>{
 for(const change of [{iss:'https://evil.invalid'},{aud:'https://other.invalid'},{email:'other@synthetic-project.iam.gserviceaccount.com'},{email_verified:'true'},{sub:'not-numeric'},{exp:baseNow/1000},{iat:baseNow/1000+31},{exp:baseNow/1000+10000},{nbf:baseNow/1000+5}]){
  const f=fixture();Object.assign(f.claims,change);await assert.rejects(()=>createGoogleNotificationDeliveryVerifier(f.config,f.ports).verifyDelivery(f.request()),/GOOGLE_DELIVERY_UNVERIFIED/);assert.equal(f.requests.length,0);
 }
 for(const header of [{alg:'none',kid:'test-key'},{alg:'RS256',kid:'test-key',jku:'https://evil.invalid'},{alg:'RS256',kid:'test-key',x5u:'https://evil.invalid'},{alg:'RS256',kid:'test-key',crit:[]}]){
  const f=fixture();await assert.rejects(()=>createGoogleNotificationDeliveryVerifier(f.config,f.ports).verifyDelivery(f.request({header})));assert.equal(f.requests.length,0);
 }
});

test('duplicate missing or non-signing JWKS keys cannot verify a delivery',async()=>{
 for(const values of [[jwk,jwk],[{...jwk,kid:'other'}],[{...jwk,use:'enc'}],[{...jwk,alg:'HS256'}]]){
  const f=fixture();f.ports.fetch=async()=>Response.json({keys:values});await assert.rejects(()=>createGoogleNotificationDeliveryVerifier(f.config,f.ports).verifyDelivery(f.request()),/GOOGLE_DELIVERY_UNVERIFIED/);assert.equal(f.bindings(),0);
 }
});

test('RTDN cannot declare sandbox or override unknown production or replaced token ownership',async()=>{
 for(const patch of [{status:'UNBOUND'},{environment:'production'},{packageName:'com.other.app'},{replacedByTokenSha256:'a'.repeat(64)}]){
  const f=fixture();f.event.environment='sandbox';Object.assign(f.binding,patch);await assert.rejects(()=>createGoogleNotificationDeliveryVerifier(f.config,f.ports).verifyDelivery(f.request()),/GOOGLE_DELIVERY_UNVERIFIED/);assert.equal(f.oauth(),0);
 }
});

test('wrong subscription stale event unsupported message and mixed event kinds remain unverified',async()=>{
 const wrong=fixture();await assert.rejects(()=>createGoogleNotificationDeliveryVerifier(wrong.config,wrong.ports).verifyDelivery(wrong.request({envelope:{subscription:'projects/other/subscriptions/other'}})));assert.equal(wrong.bindings(),0);
 for(const edit of [e=>e.packageName='com.other.app',e=>e.eventTimeMillis=String(baseNow-300001),e=>e.subscriptionNotification.notificationType=2,e=>e.testNotification={},e=>e.subscriptionNotification.purchaseToken='bad\ntoken']){
  const f=fixture();edit(f.event);await assert.rejects(()=>createGoogleNotificationDeliveryVerifier(f.config,f.ports).verifyDelivery(f.request()),/GOOGLE_DELIVERY_UNVERIFIED/);assert.equal(f.bindings(),0);
 }
});

test('full subscription void delivery is accepted while partial and one-time messages are not',async()=>{
 for(const patch of [{},{refundType:2},{productType:2}]){
  const f=fixture();delete f.event.subscriptionNotification;f.event.voidedPurchaseNotification={purchaseToken,orderId:'GPA.synthetic..0',productType:1,refundType:1,...patch};
  const action=()=>createGoogleNotificationDeliveryVerifier(f.config,f.ports).verifyDelivery(f.request());
  if(Object.keys(patch).length)await assert.rejects(action);else assert.equal((await action()).orderId,'GPA.synthetic..0');
 }
});

test('oversized malformed base64 and malformed JSON delivery bodies are bounded and rejected',async()=>{
 for(const envelope of [{message:{messageId:'message-1',data:'%%%'}},{message:{messageId:'message-1',data:Buffer.from('{').toString('base64')}},{padding:'x'.repeat(66000)}]){
  const f=fixture();await assert.rejects(()=>createGoogleNotificationDeliveryVerifier(f.config,f.ports).verifyDelivery(f.request({envelope})),/GOOGLE_DELIVERY_UNVERIFIED/);assert.equal(f.bindings(),0);
 }
});

test('pre-cancel and stalled JWKS abort without late verification or ownership work',async()=>{
 const a=fixture(),controller=new AbortController();controller.abort();await assert.rejects(()=>createGoogleNotificationDeliveryVerifier(a.config,a.ports).verifyDelivery(a.request({signal:controller.signal})));assert.equal(a.requests.length,0);
 const f=fixture();f.config.timeoutMs=10;let release,cancelled=0,signal,calls=0;
 f.ports.fetch=(_url,options)=>{calls++;signal=options.signal;return new Promise(resolve=>{release=resolve;});};
 await assert.rejects(()=>createGoogleNotificationDeliveryVerifier(f.config,f.ports).verifyDelivery(f.request()),/GOOGLE_DELIVERY_UNVERIFIED/);assert.equal(signal.aborted,true);
 release(new Response(new ReadableStream({cancel(){cancelled++;}}),{status:200}));await new Promise(resolve=>setImmediate(resolve));assert.equal(cancelled,1);assert.equal(calls,1);assert.equal(f.bindings(),0);
});

test('JWT expiry during authoritative ownership read invalidates the completed delivery',async()=>{
 const f=fixture();f.claims.exp=baseNow/1000+1;const read=f.ports.readTokenBinding;
 f.ports.readTokenBinding=async input=>{const r=await read(input);f.setNow(baseNow+2000);return r;};
 await assert.rejects(()=>createGoogleNotificationDeliveryVerifier(f.config,f.ports).verifyDelivery(f.request()),/GOOGLE_DELIVERY_UNVERIFIED/);
});

test('current matching sandbox order and full void yield only read-only VOIDED proof',async()=>{
 const f=fixture(),r=await createGoogleCurrentRevocationReader(f.config,f.ports).readRevocation(f.delivered());
 assert.deepEqual(r,{tokenSha256:hash,packageName:f.config.packageName,environment:'sandbox',state:'VOIDED',observedAtMs:baseNow,entitled:false});assert.equal(f.requests.length,3);
 const [first,list,last]=f.requests;assert.equal(first.url,last.url);assert.ok(first.url.endsWith('/synthetic-purchase%2F%2B%3F'));assert.equal(new URL(list.url).searchParams.get('type'),'1');assert.equal(new URL(list.url).searchParams.get('includeQuantityBasedPartialRefund'),'false');assert.equal(new URL(list.url).searchParams.get('pageSelection.maxResults'),'1000');
 for(const request of f.requests){assert.equal(new URL(request.url).origin,'https://androidpublisher.googleapis.com');assert.equal(request.options.method,'GET');assert.equal(request.options.redirect,'error');assert.equal(request.options.headers.Authorization,'Bearer synthetic-oauth');assert.equal(request.options.signal.aborted,true);}
 assert.ok(!JSON.stringify(r).includes(purchaseToken));
});

test('EXPIRED or RTDN state alone and a historical refunded renewal cannot prove current voiding',async()=>{
 for(const edit of [f=>f.voided.voidedPurchases=[],f=>f.voided.voidedPurchases[0].orderId='GPA.older..0',f=>f.voided.voidedPurchases[0].purchaseToken='other',f=>f.voided.voidedPurchases[0].voidedQuantity=1,f=>f.voided.tokenPagination={nextPageToken:'more'},f=>f.voided.voidedPurchases.push({...f.voided.voidedPurchases[0]}),f=>f.voided.voidedPurchases[0].voidedTimeMillis=[String(baseNow-1000)],f=>f.voided.voidedPurchases[0].purchaseTimeMillis=[String(baseNow-86400000)],f=>f.voided.voidedPurchases[0].purchaseTimeMillis=baseNow-86400000]){
  const f=fixture();edit(f);await assert.rejects(()=>createGoogleCurrentRevocationReader(f.config,f.ports).readRevocation(f.delivered()),/GOOGLE_CURRENT_REVOCATION_UNCONFIRMED/);assert.equal(f.requests.length,2);
 }
});

test('authoritative testPurchase account product plan order and expired state are mandatory',async()=>{
 for(const edit of [p=>delete p.testPurchase,p=>p.testPurchase=true,p=>p.subscriptionState='SUBSCRIPTION_STATE_ACTIVE',p=>p.externalAccountIdentifiers.obfuscatedExternalAccountId='other',p=>p.lineItems[0].productId='other',p=>p.lineItems[0].offerDetails.basePlanId='other',p=>delete p.lineItems[0].latestSuccessfulOrderId,p=>p.lineItems[0].expiryTime='2026-02-30T00:00:00Z',p=>p.lineItems[0].expiryTime=new Date(baseNow+60000).toISOString(),p=>p.lineItems.push({...p.lineItems[0]})]){
  const f=fixture();edit(f.purchase);await assert.rejects(()=>createGoogleCurrentRevocationReader(f.config,f.ports).readRevocation(f.delivered()),/GOOGLE_CURRENT_REVOCATION_UNCONFIRMED/);assert.equal(f.requests.length,1);
 }
});

test('notification full-void order must match the current authoritative order',async()=>{
 const f=fixture();await assert.rejects(()=>createGoogleCurrentRevocationReader(f.config,f.ports).readRevocation({...f.delivered(),orderId:'GPA.old'}));assert.equal(f.requests.length,1);
});

test('final provider state account and order changes invalidate earlier void evidence',async()=>{
 for(const edit of [p=>p.subscriptionState='SUBSCRIPTION_STATE_ACTIVE',p=>p.lineItems[0].latestSuccessfulOrderId='GPA.renewed',p=>p.externalAccountIdentifiers.obfuscatedExternalAccountId='other',p=>delete p.testPurchase]){
  const f=fixture(),fetch=f.ports.fetch;let subscriptionReads=0;
  f.ports.fetch=async(url,options)=>{if(url.includes('/subscriptionsv2/')&&++subscriptionReads===2)edit(f.purchase);return fetch(url,options);};
  await assert.rejects(()=>createGoogleCurrentRevocationReader(f.config,f.ports).readRevocation(f.delivered()));assert.equal(f.requests.length,3);
 }
});

test('final local ownership or obfuscation change prevents revocation proof',async()=>{
 for(const changed of ['owner','obfuscation']){
  const f=fixture();let reads=0;
  if(changed==='owner'){const read=f.ports.readTokenBinding;f.ports.readTokenBinding=async input=>({...await read(input),accountId:++reads===2?'22222222-2222-4222-8222-222222222222':accountId});}
  else f.ports.readObfuscatedAccountId=async()=>++reads===2?'changed':'server-owner';
  await assert.rejects(()=>createGoogleCurrentRevocationReader(f.config,f.ports).readRevocation(f.delivered()));
 }
});

test('wrong token hash stale delivery unknown ownership and cancellation perform no Google work',async()=>{
 for(const patch of [{tokenSha256:'b'.repeat(64)},{environment:'production'},{observedAtMs:baseNow-300001}]){const f=fixture();await assert.rejects(()=>createGoogleCurrentRevocationReader(f.config,f.ports).readRevocation({...f.delivered(),...patch}));assert.equal(f.requests.length,0);}
 const f=fixture();f.binding.status='UNBOUND';await assert.rejects(()=>createGoogleCurrentRevocationReader(f.config,f.ports).readRevocation(f.delivered()));assert.equal(f.requests.length,0);
 const g=fixture(),controller=new AbortController();controller.abort();await assert.rejects(()=>createGoogleCurrentRevocationReader(g.config,g.ports).readRevocation(g.delivered(),{signal:controller.signal}));assert.equal(g.requests.length,0);
});

test('provider errors malformed bodies and redirects cannot become a revocation result',async()=>{
 for(const response of [()=>new Response('private-error',{status:500}),()=>new Response(null,{status:302,headers:{location:'https://evil.invalid'}}),()=>new Response('x'.repeat(65537),{status:200,headers:{'content-type':'application/json'}}),()=>new Response('{',{status:200,headers:{'content-type':'application/json'}})]){
  const f=fixture();let calls=0;f.ports.fetch=async()=>{calls++;return response();};await assert.rejects(()=>createGoogleCurrentRevocationReader(f.config,f.ports).readRevocation(f.delivered()),/^Error: GOOGLE_CURRENT_REVOCATION_UNCONFIRMED$/);assert.equal(calls,1);
 }
});

test('stalled provider body is canceled with one request and no inferred result',async()=>{
 const f=fixture();f.config.timeoutMs=10;let calls=0,cancelled=0,signal;
 f.ports.fetch=async(_url,options)=>{calls++;signal=options.signal;return new Response(new ReadableStream({cancel(){cancelled++;}}),{status:200,headers:{'content-type':'application/json'}});};
 await assert.rejects(()=>createGoogleCurrentRevocationReader(f.config,f.ports).readRevocation(f.delivered()),/GOOGLE_CURRENT_REVOCATION_UNCONFIRMED/);assert.equal(calls,1);assert.equal(cancelled,1);assert.equal(signal.aborted,true);
});

test('actual crypto and concrete read adapters compose with existing reconciler without granting access',async()=>{
 const f=fixture(),delivery=createGoogleNotificationDeliveryVerifier(f.config,f.ports),current=createGoogleCurrentRevocationReader(f.config,f.ports);let commits=0;
 const reconciler=createGoogleReconciler(f.config,{...f.ports,...delivery,...current,commitRevocation:async input=>{assert.equal(input.tokenSha256,hash);assert.equal(input.accountId,accountId);assert.equal(input.environment,'sandbox');assert.equal(input.purchaseToken,undefined);commits++;return {status:'REVOKED'};}});
 const result=await reconciler.reconcile(f.request());assert.deepEqual(result,{status:'REVOKED',entitled:false,reconciliationRequired:false});assert.equal(commits,1);assert.equal(f.requests.length,4);
 const denied=fixture();delete denied.purchase.testPurchase;let deniedCommits=0;
 const r=createGoogleReconciler(denied.config,{...denied.ports,...createGoogleNotificationDeliveryVerifier(denied.config,denied.ports),...createGoogleCurrentRevocationReader(denied.config,denied.ports),commitRevocation:async()=>{deniedCommits++;return {status:'REVOKED'};}});
 assert.equal((await r.reconcile(denied.request())).status,'HOLD');assert.equal(deniedCommits,0);
});
