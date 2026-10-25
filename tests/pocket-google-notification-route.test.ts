import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,generateKeyPairSync,sign} from 'node:crypto';
import {createPocketGoogleNotificationBinding,bindPocketGoogleNotifications,handleGoogleNotificationRequest} from '../app/lib/server/pocket-google-notifications.ts';
import {POST} from '../app/api/pocket/google-notifications/route.ts';

const key=generateKeyPairSync('rsa',{modulusLength:2048});
const jwk={...key.publicKey.export({format:'jwk'}),kid:'route-key',alg:'RS256',use:'sig'};
const owner='11111111-1111-4111-8111-111111111111',purchaseToken='synthetic-only-token',hash=createHash('sha256').update(purchaseToken).digest('hex');
const origin='https://candidate.invalid',revision='a'.repeat(40);
function fixture(){
 const now=Date.now(),identity={authProject:'isolated-auth',storage:'isolated-storage'};
 const config={origin,revision,identity:{...identity},google:{packageName:'com.nashaimarkets.pocketbullseye',productId:'pocket_bullseye_monthly',basePlanIds:['monthly'],environment:'sandbox' as const,timeoutMs:1000},delivery:{issuer:'https://accounts.google.com',audience:`${origin}/api/pocket/google-notifications`,serviceAccountEmail:'rtdn@synthetic-project.iam.gserviceaccount.com',subscription:'projects/synthetic-project/subscriptions/rtdn'}};
 const requests:string[]=[],queries:{sql:string;values:string[]}[]=[];let revoked=false;
 const purchase={kind:'androidpublisher#subscriptionPurchaseV2',testPurchase:{},subscriptionState:'SUBSCRIPTION_STATE_EXPIRED',externalAccountIdentifiers:{obfuscatedExternalAccountId:'server-derived-owner'},lineItems:[{productId:config.google.productId,offerDetails:{basePlanId:'monthly'},latestSuccessfulOrderId:'GPA.synthetic',expiryTime:new Date(now-1000).toISOString()}]};
 const ports={clock:()=>now,inspectIdentity:async()=>identity,readObfuscatedAccountId:async()=> 'server-derived-owner',readAccessToken:async()=> 'synthetic-oauth',pool:{query:async(sql:string,values:string[])=>{
  queries.push({sql,values});
  if(sql.startsWith('select pocket_google_ownership.lookup_token('))return {rows:[{result:{status:'BOUND',accountId:owner,packageName:config.google.packageName,environment:'sandbox',revoked,replacedByTokenSha256:null}}]};
  assert.equal(sql,'select pocket_google_ownership.revoke_known_token($1::uuid,$2::text,$3::text,$4::text) as result');assert.deepEqual(values,[owner,config.google.packageName,'sandbox',hash]);revoked=true;return {rows:[{result:{status:'REVOKED'}}]};
 }},fetch:async(input:RequestInfo|URL)=>{
  const url=String(input);requests.push(url);
  if(url==='https://www.googleapis.com/oauth2/v3/certs')return Response.json({keys:[jwk]});
  if(url.includes('/subscriptionsv2/'))return Response.json(purchase);
  if(url.includes('/voidedpurchases?'))return Response.json({voidedPurchases:[{purchaseToken,orderId:'GPA.synthetic',purchaseTimeMillis:String(now-86400000),voidedTimeMillis:String(now-1000)}]});
  assert.fail('Unexpected provider request');
 }};
 function request(){
  const header=Buffer.from(JSON.stringify({alg:'RS256',kid:'route-key',typ:'JWT'})).toString('base64url');
  const claims=Buffer.from(JSON.stringify({iss:config.delivery.issuer,aud:config.delivery.audience,email:config.delivery.serviceAccountEmail,email_verified:true,sub:'123456789012345678901',iat:Math.floor(now/1000)-5,exp:Math.floor(now/1000)+300})).toString('base64url');
  const signed=`${header}.${claims}`,token=`${signed}.${sign('RSA-SHA256',Buffer.from(signed),key.privateKey).toString('base64url')}`;
  const event={version:'1.0',packageName:config.google.packageName,eventTimeMillis:String(now-1000),subscriptionNotification:{version:'1.0',notificationType:13,purchaseToken}};
  return new Request(config.delivery.audience,{method:'POST',headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},body:JSON.stringify({subscription:config.delivery.subscription,message:{messageId:'event-1',data:Buffer.from(JSON.stringify(event)).toString('base64')}})});
 }
 return {config,ports,purchase,requests,queries,request};
}
async function withSource(action:()=>Promise<void>,source=revision,environment='preview'){
 const previous=process.env.VERCEL_GIT_COMMIT_SHA,oldEnvironment=process.env.VERCEL_ENV;
 process.env.VERCEL_GIT_COMMIT_SHA=source;process.env.VERCEL_ENV=environment;
 try{await action();}finally{if(previous===undefined)delete process.env.VERCEL_GIT_COMMIT_SHA;else process.env.VERCEL_GIT_COMMIT_SHA=previous;if(oldEnvironment===undefined)delete process.env.VERCEL_ENV;else process.env.VERCEL_ENV=oldEnvironment;}
}

test('mounted route defaults to503 without reading credentials or binding services',async()=>{
 const r=await POST(new Request(`${origin}/api/pocket/google-notifications`,{method:'POST'}));
 assert.equal(r.status,503);assert.deepEqual(await r.json(),{received:false,entitled:false,status:'HOLD',code:'GOOGLE_NOTIFICATIONS_UNCONFIGURED'});
});
test('trusted factory is inert and rejects live origin mismatched audience and production scope',()=>{
 const f=fixture();createPocketGoogleNotificationBinding(f.config,f.ports);assert.equal(f.requests.length,0);assert.equal(f.queries.length,0);
 assert.throws(()=>createPocketGoogleNotificationBinding({...f.config,origin:'https://pocket.nashaimarkets.com'},f.ports));
 assert.throws(()=>createPocketGoogleNotificationBinding({...f.config,delivery:{...f.config.delivery,audience:'https://other.invalid/api/pocket/google-notifications'}},f.ports));
 assert.throws(()=>createPocketGoogleNotificationBinding({...f.config,google:{...f.config.google,environment:'production' as 'sandbox'}},f.ports));
});
test('configured factory composes real signature and provider adapters with fixed SQL revocation',async()=>withSource(async()=>{
 const f=fixture(),binding=createPocketGoogleNotificationBinding(f.config,f.ports);
 const response=await handleGoogleNotificationRequest(f.request(),binding);
 assert.equal(response.status,200);assert.deepEqual(await response.json(),{received:true,status:'REVOKED',entitled:false});assert.equal(f.requests.length,4);
 assert.equal(f.queries.filter(q=>q.sql.includes('revoke_known_token')).length,1);assert.ok(f.queries.every(q=>!JSON.stringify(q.values).includes(purchaseToken)));
 const repeated=await handleGoogleNotificationRequest(f.request(),binding);assert.equal(repeated.status,200);assert.equal(f.queries.filter(q=>q.sql.includes('revoke_known_token')).length,2);
}));
test('wrong source production deployment and route origin cannot reach Google or SQL',async()=>{
 for(const [source,environment] of [['b'.repeat(40),'preview'],[revision,'production']])await withSource(async()=>{const f=fixture();const r=await handleGoogleNotificationRequest(f.request(),createPocketGoogleNotificationBinding(f.config,f.ports));assert.equal(r.status,503);assert.equal(f.requests.length,0);assert.equal(f.queries.length,0);},source,environment);
 await withSource(async()=>{const f=fixture(),binding=createPocketGoogleNotificationBinding(f.config,f.ports);const r=await handleGoogleNotificationRequest(new Request('https://other.invalid/api/pocket/google-notifications',{method:'POST'}),binding);assert.equal(r.status,503);assert.equal(f.requests.length,0);assert.equal(f.queries.length,0);});
});
test('auth or storage identity mismatch prevents provider and ownership reads',async()=>withSource(async()=>{
 for(const key of ['authProject','storage'] as const){const f=fixture();f.ports.inspectIdentity=async()=>({...f.config.identity,[key]:'wrong'});const r=await handleGoogleNotificationRequest(f.request(),createPocketGoogleNotificationBinding(f.config,f.ports));assert.equal(r.status,503);assert.equal(f.requests.length,0);assert.equal(f.queries.length,0);}
}));
test('invalid signature and missing authoritative sandbox proof return503 without acknowledging delivery',async()=>withSource(async()=>{
 const f=fixture(),bad=f.request();bad.headers.set('authorization','Bearer invalid');const r=await handleGoogleNotificationRequest(bad,createPocketGoogleNotificationBinding(f.config,f.ports));assert.equal(r.status,503);assert.equal(f.queries.length,0);
 const g=fixture();delete (g.purchase as {testPurchase?:object}).testPurchase;const rejected=await handleGoogleNotificationRequest(g.request(),createPocketGoogleNotificationBinding(g.config,g.ports));assert.equal(rejected.status,503);assert.equal((await rejected.json()).received,false);assert.equal(g.queries.filter(q=>q.sql.includes('revoke_known_token')).length,0);
}));
test('ambiguous revocation write staysUNCERTAIN503 with one attempt and no sensitive response',async()=>withSource(async()=>{
 const f=fixture(),query=f.ports.pool.query;let writes=0;
 f.ports.pool.query=async(sql,values)=>{if(sql.includes('revoke_known_token')){writes++;throw Error('private-token-or-database-error');}return query(sql,values);};
 const r=await handleGoogleNotificationRequest(f.request(),createPocketGoogleNotificationBinding(f.config,f.ports));assert.equal(r.status,503);const body=await r.text();assert.equal(JSON.parse(body).status,'UNCERTAIN');assert.equal(writes,1);assert.ok(!body.includes('private')&&!body.includes(purchaseToken));
}));
test('identity timeout aborts without provider reads or writes',async()=>withSource(async()=>{
 const f=fixture();f.config.google.timeoutMs=10;let signal:AbortSignal|undefined;
 f.ports.inspectIdentity=async(s?:AbortSignal)=>{signal=s;return new Promise(()=>{});};
 const r=await handleGoogleNotificationRequest(f.request(),createPocketGoogleNotificationBinding(f.config,f.ports));assert.equal(r.status,503);assert.equal(signal?.aborted,true);assert.equal(f.requests.length,0);assert.equal(f.queries.length,0);
}));
test('factory snapshots trusted identity and service choices',async()=>withSource(async()=>{
 const f=fixture(),binding=createPocketGoogleNotificationBinding(f.config,f.ports);f.config.identity.storage='changed';f.ports.inspectIdentity=async()=>{throw Error('changed');};
 const r=await handleGoogleNotificationRequest(f.request(),binding);assert.equal(r.status,200);
}));
test('one-time binding accepts only prepared server factory and activates mounted dispatch',async()=>withSource(async()=>{
 assert.throws(()=>bindPocketGoogleNotifications({origin,revision,reconcile:async()=>({status:'REVOKED',entitled:false,reconciliationRequired:false})}));
 const f=fixture(),binding=createPocketGoogleNotificationBinding(f.config,f.ports);bindPocketGoogleNotifications(binding);assert.throws(()=>bindPocketGoogleNotifications(binding));
 const r=await POST(f.request());assert.equal(r.status,200);assert.equal((await r.json()).entitled,false);
}));
