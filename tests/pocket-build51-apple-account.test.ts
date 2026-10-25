import test from 'node:test';
import assert from 'node:assert/strict';
import {pocketAppleAccountResponse} from '../app/lib/server/pocket-apple-account-state.ts';
const id='00000000-0000-4000-8000-000000000001';
const user={id,email:'fixture@example.invalid',email_confirmed_at:'2026-01-01'};
const deps={authenticate:async()=>user,webSubscription:async()=>false,appleSubscription:async()=>false};
test('existing web subscriber restores access without Apple config, sync, linking or repurchase',async()=>{
 let appleCalls=0; const response=await pocketAppleAccountResponse('',{...deps,webSubscription:async uid=>{assert.equal(uid,id);return true;},appleSubscription:async()=>{appleCalls++;throw Error('config missing');}});
 assert.deepEqual(await response.json(),{appAccountToken:id,entitled:true,accessSource:'web'});assert.equal(appleCalls,0);assert.equal(response.headers.get('Cache-Control'),'private, no-store');
});
test('linked Apple subscriber succeeds even if web ledger is unavailable',async()=>{
 const response=await pocketAppleAccountResponse('proof',{...deps,webSubscription:async()=>{throw Error('offline');},appleSubscription:async(uid,proof)=>{assert.equal(uid,id);assert.equal(proof,'proof');return true;}});
 assert.equal(response.status,200);assert.equal((await response.json()).accessSource,'apple');
});
for(const identity of [null,{...user,id:'bad'},{...user,is_anonymous:true},{...user,email_confirmed_at:''}])test('invalid or missing session cannot access subscriptions '+JSON.stringify(identity),async()=>{
 let calls=0;const r=await pocketAppleAccountResponse('',{...deps,authenticate:async()=>identity,webSubscription:async()=>{calls++;return true;}});assert.equal(r.status,401);assert.equal(calls,0);
});
test('no proof still checks verifier readiness before purchase is offered',async()=>{
 const r=await pocketAppleAccountResponse('',{...deps,appleSubscription:async()=>{throw Object.assign(Error('PRIVATE KEY'),{code:'POCKET_APPLE_CONFIGURATION'});}});
 assert.equal(r.status,503);assert.deepEqual(await r.json(),{code:'POCKET_APPLE_CONFIGURATION'});
});
test('unlinked/expired entitlement does not grant access',async()=>{const r=await pocketAppleAccountResponse('proof',deps);assert.equal((await r.json()).entitled,false);});
test('web outage with no independent proof is unavailable, never unpaid purchase offer',async()=>{const r=await pocketAppleAccountResponse('',{...deps,webSubscription:async()=>{throw Error('private');}});assert.equal(r.status,503);});
test('provider errors are sanitized',async()=>{const r=await pocketAppleAccountResponse('proof',{...deps,appleSubscription:async()=>{throw Error('signed JWS secret');}});assert.deepEqual(await r.json(),{code:'POCKET_ACCESS_UNAVAILABLE'});});
test('oversized or header-injected proof is rejected before any lookup',async()=>{for(const proof of ['x'.repeat(16001),'bad\r\nproof']) {let calls=0;const r=await pocketAppleAccountResponse(proof,{...deps,webSubscription:async()=>{calls++;return true;}});assert.equal(r.status,400);assert.equal(calls,0);}});
