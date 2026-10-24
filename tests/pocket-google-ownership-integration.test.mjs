import test from 'node:test';
import assert from 'node:assert/strict';
import {createVerifiedGoogleOwnershipRecorder,OWNERSHIP_SQL} from '../app/api/pocket/google-subscription-ownership.mjs';
const A='11111111-1111-4111-8111-111111111111';
function fixture(){
 const now=Date.parse('2026-10-22T06:00:00Z'), events=[];
 const config={packageName:'com.nashaimarkets.pocketbullseye',productId:'pocket_bullseye_monthly',basePlanIds:['monthly'],environment:'production'};
 const purchase={kind:'androidpublisher#subscriptionPurchaseV2',subscriptionState:'SUBSCRIPTION_STATE_ACTIVE',
  startTime:'2026-10-21T00:00:00Z',acknowledgementState:'ACKNOWLEDGEMENT_STATE_PENDING',
  externalAccountIdentifiers:{obfuscatedExternalAccountId:'synthetic-obfuscated-account'},
  lineItems:[{productId:config.productId,offerDetails:{basePlanId:'monthly'},expiryTime:'2026-11-21T00:00:00Z'}]};
 const ports={clock:()=>now,readAccount:async()=>({accountId:A,obfuscatedAccountId:'synthetic-obfuscated-account'}),
  readTokenBinding:async()=>({status:'UNBOUND'}),readAccessToken:async()=>'synthetic-oauth-token',
  fetch:async(url,options)=>{events.push({kind:'google',url,options});return new Response(JSON.stringify(purchase),{status:200,headers:{'content-type':'application/json'}});},
  commitStatement:async(sql,v)=>{events.push({kind:'sql',sql,v});return {rows:[{result:{status:'RECORDED',entitled:false,
   accountId:v[0],packageName:v[1],environment:v[2],tokenSha256:v[3],supersedesTokenSha256:v[4],created:true}}]};}};
 return {config,ports,purchase,events};
}
test('unchanged real verifier composes with the new ownership write path',async()=>{
 const f=fixture(),r=await(await createVerifiedGoogleOwnershipRecorder(f.config,f.ports)).record({purchaseToken:'synthetic-purchase'});
 assert.equal(r.status,'OWNERSHIP_RECORDED');assert.equal(r.entitled,false);assert.equal(f.events.length,2);
 assert.equal(f.events[0].kind,'google');assert.equal(f.events[1].sql,OWNERSHIP_SQL);
 assert.ok(f.events[0].url.includes('/applications/'+f.events[1].v[1]+'/'));
});
test('wrong product, expired purchase or wrong account stops before SQL',async()=>{
 for(const edit of [p=>p.lineItems[0].productId='wrong',p=>p.lineItems[0].expiryTime='2026-10-21T01:00:00Z',
  p=>p.externalAccountIdentifiers.obfuscatedExternalAccountId='someone-else']){
  const f=fixture();edit(f.purchase);const r=await(await createVerifiedGoogleOwnershipRecorder(f.config,f.ports)).record({purchaseToken:'synthetic'});
  assert.equal(r.status,'HOLD');assert.equal(f.events.filter(e=>e.kind==='sql').length,0);
 }
});
test('caller cannot substitute config or verifier while composition imports',async()=>{
 const f=fixture();f.ports.verify=async()=>{assert.fail('Caller verifier must be ignored');};
 const prepared=createVerifiedGoogleOwnershipRecorder(f.config,f.ports);
 f.config.packageName='com.other.app';f.ports.fetch=async()=>{assert.fail('Captured port must be retained');};
 const r=await(await prepared).record({purchaseToken:'synthetic'});
 assert.equal(r.status,'OWNERSHIP_RECORDED');assert.equal(f.events[1].v[1],'com.nashaimarkets.pocketbullseye');
});
test('authoritative commit conflict cannot be overruled by a passing Google response',async()=>{
 const f=fixture();f.ports.commitStatement=async()=>({rows:[{result:{status:'DENIED',reason:'ACCOUNT_OWNERSHIP_CONFLICT'}}]});
 const r=await(await createVerifiedGoogleOwnershipRecorder(f.config,f.ports)).record({purchaseToken:'synthetic'});
 assert.equal(r.status,'DENIED');assert.equal(r.entitled,false);assert.equal(r.ownershipRecorded,false);
});
