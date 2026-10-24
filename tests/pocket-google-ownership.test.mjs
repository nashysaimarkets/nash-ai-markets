import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createGoogleOwnershipRecorder,OWNERSHIP_SQL} from '../app/api/pocket/google-subscription-ownership.mjs';
const hash=x=>createHash('sha256').update(x).digest('hex');
const A='11111111-1111-4111-8111-111111111111', B='22222222-2222-4222-8222-222222222222';
const token='synthetic-google-token-not-a-credential';
function fixture(){
 const calls={verify:0,account:0,sql:[]};
 const config={packageName:'com.nashaimarkets.pocketbullseye',environment:'production'};
 const candidate={status:'VERIFIED_FOR_PERSISTENCE',entitled:false,entitlementCandidate:true,writesPerformed:0,
  atomicOwnershipRecheckRequired:true,revocationReconciliationRequired:true,environment:'production',
  ownershipState:'UNBOUND',accountId:A,tokenSha256:hash(token),supersedesTokenSha256:null,observedAtMs:1000,expiresAtMs:90000};
 const ports={verify:async()=>{calls.verify++;return candidate;},readAccount:async()=>{calls.account++;return {accountId:A};},
  clock:()=>2000,commitStatement:async(sql,values)=>{calls.sql.push({sql,values});return {rows:[{result:{status:'RECORDED',
   accountId:values[0],packageName:values[1],environment:values[2],tokenSha256:values[3],supersedesTokenSha256:values[4],created:true,entitled:false}}]};}};
 return {calls,config,candidate,ports,make(){return createGoogleOwnershipRecorder(config,ports);}};
}
test('one fixed parameterized autocommit statement records ownership but never entitlement',async()=>{
 const f=fixture(),r=await f.make().record({purchaseToken:token,entitled:true,accountId:B});
 assert.equal(r.status,'OWNERSHIP_RECORDED');assert.equal(r.entitled,false);assert.equal(r.ownershipRecorded,true);
 assert.equal(r.acknowledgementAndAdmissionRequired,true);assert.equal(f.calls.verify,1);assert.equal(f.calls.sql.length,1);
 assert.equal(f.calls.sql[0].sql,OWNERSHIP_SQL);assert.deepEqual(f.calls.sql[0].values,[A,f.config.packageName,'production',hash(token),null]);
 assert.ok(!JSON.stringify(f.calls.sql).includes(token));assert.ok(!JSON.stringify(r).includes(token));
});
test('known duplicate receipt is recorded without claiming a new ownership row',async()=>{
 const f=fixture(),commit=f.ports.commitStatement;f.ports.commitStatement=async(...args)=>{const r=await commit(...args);r.rows[0].result.created=false;return r;};
 assert.equal((await f.make().record({purchaseToken:token})).created,false);
});
test('linked replacement hash is carried in the same statement',async()=>{
 const f=fixture();f.candidate.supersedesTokenSha256=hash('synthetic-old-token');
 assert.equal((await f.make().record({purchaseToken:token})).status,'OWNERSHIP_RECORDED');
 assert.equal(f.calls.sql[0].values[4],f.candidate.supersedesTokenSha256);
});
test('client cannot supply a forged verification result or account',async()=>{
 const f=fixture();f.ports.verify=async()=>({status:'DENIED',reason:'test'});
 assert.equal((await f.make().record({purchaseToken:token,...f.candidate})).status,'HOLD');assert.equal(f.calls.sql.length,0);
});
test('malformed or mismatched candidates never reach SQL',async()=>{
 for(const delta of [{status:'PASS'},{entitled:true},{writesPerformed:1},{environment:'sandbox'},
  {tokenSha256:hash('different')},{accountId:'not-a-uuid'},{supersedesTokenSha256:hash(token)},
  {supersedesTokenSha256:'invalid'},{observedAtMs:NaN},{atomicOwnershipRecheckRequired:false},
  {revocationReconciliationRequired:false},{entitlementCandidate:false},{ownershipState:'OTHER'}]){
  const f=fixture();Object.assign(f.candidate,delta);const r=await f.make().record({purchaseToken:token});
  assert.equal(r.status,'HOLD');assert.equal(f.calls.sql.length,0);
 }
});
test('account switches before commit never bind the purchase to the new account',async()=>{
 const f=fixture();f.ports.readAccount=async()=>({accountId:B});
 assert.equal((await f.make().record({purchaseToken:token})).stage,'ACCOUNT_RECHECK');assert.equal(f.calls.sql.length,0);
});
test('stale, future or expired verification refuses without a write',async()=>{
 for(const now of [999,31001,90000,NaN]){
  const f=fixture();f.ports.clock=()=>now;assert.equal((await f.make().record({purchaseToken:token})).status,'HOLD');assert.equal(f.calls.sql.length,0);
 }
});
test('candidate and configuration are snapshotted across asynchronous work',async()=>{
 const f=fixture();const recorder=f.make();f.config.packageName='com.wrong.app';f.config.environment='sandbox';
 f.ports.readAccount=async()=>({accountId:B}); // Captured port must not change.
 const r=await recorder.record({purchaseToken:token});assert.equal(r.status,'OWNERSHIP_RECORDED');
 assert.equal(f.calls.sql[0].values[1],'com.nashaimarkets.pocketbullseye');
 const g=fixture();g.ports.readAccount=async()=>{g.candidate.accountId=B;g.candidate.tokenSha256=hash('evil');return {accountId:A};};
 assert.equal((await g.make().record({purchaseToken:token})).accountId,A);
});
test('cancel before or during verification cannot dispatch a database write',async()=>{
 for(const before of [true,false]){
  const f=fixture(),c=new AbortController();if(before)c.abort();else f.ports.verify=async()=>{c.abort();return f.candidate;};
  const r=await f.make().record({purchaseToken:token,signal:c.signal});assert.equal(r.status,'HOLD');assert.equal(f.calls.sql.length,0);
 }
});
test('cancellation after a confirmed commit is not misreported as rollback',async()=>{
 const f=fixture(),c=new AbortController(),commit=f.ports.commitStatement;
 f.ports.commitStatement=async(...args)=>{const r=await commit(...args);c.abort();return r;};
 const r=await f.make().record({purchaseToken:token,signal:c.signal});
 assert.equal(r.status,'RECORDED_AFTER_CANCELLATION');assert.equal(r.ownershipRecorded,true);assert.equal(r.entitled,false);
});
test('lost commit acknowledgement preserves uncertainty, never retries or exposes driver errors',async()=>{
 const f=fixture();let writes=0;f.ports.commitStatement=async()=>{writes++;throw Error(token);};
 const r=await f.make().record({purchaseToken:token});assert.equal(writes,1);assert.equal(r.status,'UNCERTAIN');
 assert.equal(r.reconciliationRequired,true);assert.equal(r.writeAttempted,true);assert.ok(!JSON.stringify(r).includes(token));
});
test('missing, extra or forged commit receipts remain uncertain',async()=>{
 for(const value of [null,{rows:[]},{rows:[{},{}]},{rows:[{result:{status:'RECORDED'}}]},
  {rows:[{result:{status:'HOLD',reason:token}}]}]){
  const f=fixture();f.ports.commitStatement=async()=>value;
  const r=await f.make().record({purchaseToken:token});assert.equal(r.status,'UNCERTAIN');assert.ok(!JSON.stringify(r).includes(token));
 }
});
test('only fixed database denial codes are returned',async()=>{
 for(const [status,reason] of [['DENIED','TOKEN_REPLACED'],['DENIED','ACCOUNT_OWNERSHIP_CONFLICT'],['HOLD','LINKED_OWNERSHIP_REVIEW_REQUIRED']]){
  const f=fixture();f.ports.commitStatement=async()=>({rows:[{result:{status,reason,secret:token}}]});
  const r=await f.make().record({purchaseToken:token});assert.equal(r.status,status);assert.equal(r.reason,reason);
  assert.equal(r.ownershipRecorded,false);assert.ok(!JSON.stringify(r).includes(token));
 }
});
test('an acknowledgement for another owner/token/scope is never accepted',async()=>{
 for(const delta of [{accountId:B},{tokenSha256:hash('other')},{packageName:'other.app'},
  {environment:'sandbox'},{supersedesTokenSha256:hash('other')},{entitled:true},{created:'true'}]){
  const f=fixture(),commit=f.ports.commitStatement;f.ports.commitStatement=async(...args)=>{const r=await commit(...args);Object.assign(r.rows[0].result,delta);return r;};
  assert.equal((await f.make().record({purchaseToken:token})).status,'UNCERTAIN');
 }
});
test('invalid input/configuration is rejected before verification',async()=>{
 for(const purchaseToken of [null,'','a b','a\n',123,'a'.repeat(4097)]){
  const f=fixture();assert.equal((await f.make().record({purchaseToken})).status,'HOLD');assert.equal(f.calls.verify,0);
 }
 const f=fixture();assert.throws(()=>createGoogleOwnershipRecorder({...f.config,maxVerificationAgeMs:30001},f.ports));
 assert.throws(()=>createGoogleOwnershipRecorder({...f.config,packageName:'bad;select'},f.ports));
});
test('stalled account recheck honours cancellation without dispatching SQL',async()=>{
 const f=fixture();f.config.timeoutMs=25;f.ports.readAccount=()=>new Promise(()=>{});const a=new AbortController();
 const pending=f.make().record({purchaseToken:token,signal:a.signal});await new Promise(r=>setImmediate(r));a.abort();const out=await pending;assert.equal(out.status,'HOLD');assert.equal(f.calls.sql.length,0);
});
test('stalled commit becomes UNCERTAIN without retry or false rollback',async()=>{
 const f=fixture();f.config.timeoutMs=10;let calls=0;f.ports.commitStatement=()=>{calls++;return new Promise(()=>{});};
 const out=await f.make().record({purchaseToken:token});assert.equal(out.status,'UNCERTAIN');assert.equal(out.reconciliationRequired,true);assert.equal(calls,1);
});
test('late commit acknowledgement does not mutate the returned uncertain result',async()=>{
 const f=fixture();f.config.timeoutMs=10;let release;f.ports.commitStatement=()=>new Promise(r=>release=r);
 const out=await f.make().record({purchaseToken:token});release({rows:[]});await new Promise(r=>setImmediate(r));assert.equal(out.status,'UNCERTAIN');assert.equal(out.entitled,false);
});
test('cancellation in queued pre-dispatch gap cannot write or claim uncertain commit',async()=>{
 const f=fixture(),a=new AbortController();f.ports.clock=()=>{queueMicrotask(()=>a.abort());return 2000;};const out=await f.make().record({purchaseToken:token,signal:a.signal});assert.equal(f.calls.sql.length,0);assert.equal(out.writeAttempted,false);assert.equal(out.status,'HOLD');
});
