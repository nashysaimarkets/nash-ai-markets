/** Disposable PGlite only; synthetic Stripe SDK. No hosted URL or credentials. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { isAbsolute } from 'node:path';
import test from 'node:test';
import { createPocketCheckoutRecoveryDriver, issuePocketCheckoutBaseline, provisionPocketCustomer, recoverPocketCustomer, reconcilePocketCheckout } from '../app/lib/server/pocket-checkout-completion.ts';
const modulePath=process.env.POCKET_CHECKOUT_QA_PGLITE_MODULE;
assert.ok(modulePath && isAbsolute(modulePath) && modulePath.endsWith('/@electric-sql/pglite/dist/index.js'));
const { PGlite }=await import(pathToFileURL(modulePath).href);
const db=new PGlite();
for(const p of ['tests/sql/support/pocket-checkout-intent-bootstrap.sql','supabase/proposed/pocket-checkout-intent.sql','supabase/proposed/pocket-checkout-completion.sql']) await db.exec(await readFile(p,'utf8'));
const user='11111111-1111-4111-8111-111111111111';
const base={userId:user,priceId:'price_QA',stripeAccountId:'acct_QA',livemode:false,candidateSha:'a'.repeat(40),offer:'pocket_founding_650'};
const keys={
 register_pocket_checkout_fence:['p_scope','p_evidence'],get_pocket_checkout_fence:['p_scope'],
 enroll_pocket_customer_provision:['p_scope','p_enrollment_sha256','p_fence_sha256'],prepare_pocket_customer_provision:['p_scope'],
 claim_pocket_customer_provision:['p_id','p_scope'],record_pocket_customer_provision:['p_id','p_token','p_scope','p_customer'],
 recover_pocket_customer_provision:['p_id','p_scope','p_customer'],issue_pocket_checkout_baseline:['p_inventory_text','p_inventory_sha256','p_fence_sha256'],
 inspect_pocket_checkout_recovery:['p_scope'],reconcile_pocket_checkout_intent:['p_scope','p_session','p_parameters_sha256','p_inventory_text','p_inventory_sha256','p_fence_sha256'],
};
async function rpc(role,name,args){
 assert.ok(['service_role','pocket_checkout_verifier','anon','authenticated'].includes(role)); assert.ok(keys[name]);
 await db.exec(`savepoint rpc_call; set local role ${role};`);
 try{const values=keys[name].map(k=>typeof args[k]==='object'?JSON.stringify(args[k]):args[k]);
 const r=await db.query(`select public.${name}(${values.map((_,i)=>'$'+(i+1)).join(',')}) as result`,values);
 await db.exec('reset role; release savepoint rpc_call;');return{data:r.rows[0].result,error:null};}
 catch(e){await db.exec('rollback to savepoint rpc_call; reset role; release savepoint rpc_call;');return{data:null,error:String(e.message)};}
}
async function fixture(){
 await db.exec('begin');
 await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())',[user,'one@example.test']);
 const evidence={old_writers_drained:true,recovery_links_disabled:true,other_obligations_reviewed:true,
 approval_sha256:'b'.repeat(64),cutover_sha256:'c'.repeat(64),fenced_at:new Date(Date.now()-1000).toISOString(),valid_until:new Date(Date.now()+240000).toISOString()};
 const f=await rpc('pocket_checkout_verifier','register_pocket_checkout_fence',{p_scope:base,p_evidence:evidence});assert.equal(f.error,null);
 let authority=base, writes=0, gets=0, customer={id:'cus_QA',object:'customer',livemode:false,metadata:{}}, sessions=[],subscriptions=[],schedules=[];
 let beforeRpc=null,onCreate=null, onRpc=null,pricePatch={},account='acct_QA',sessionPatch={};
 const page=(url,data)=>({object:'list',url:'/v1/'+url,has_more:false,data});
 const sdk={accounts:{retrieve:async()=>({object:'account',id:account})},prices:{retrieve:async()=>({id:'price_QA',livemode:false,active:true,type:'recurring',currency:'gbp',unit_amount:499,recurring:{interval:'month',interval_count:1},...pricePatch})},
 customers:{retrieve:async()=>{gets++;return customer;},create:async(p,o)=>{writes++;assert.equal(o.maxNetworkRetries,0);assert.equal(o.timeout,5000);assert.match(o.idempotencyKey,/^pocket-customer:/);customer={...customer,metadata:p.metadata};if(onCreate)await onCreate();return customer;}},
 subscriptions:{list:async()=>page('subscriptions',subscriptions)},subscriptionSchedules:{list:async()=>page('subscription_schedules',schedules)},
 checkout:{sessions:{list:async()=>page('checkout/sessions',sessions),retrieve:async(id)=>({...sessions.find(s=>s.id===id),...sessionPatch})}}};
 const driver=createPocketCheckoutRecoveryDriver(sdk);
 const dependencies=(role)=>({driver,authorise:async()=>authority,rpc:async(n,a)=>{
   if(beforeRpc)a=await beforeRpc(n,a);
   const r=await rpc(role,n,a);return onRpc?await onRpc(n,a,r):r;
 }});
 const runtime=dependencies('service_role'),verifier=dependencies('pocket_checkout_verifier');
 async function enroll(){const r=await rpc('pocket_checkout_verifier','enroll_pocket_customer_provision',{p_scope:base,p_enrollment_sha256:'d'.repeat(64),p_fence_sha256:f.data.receipt_sha256});assert.equal(r.error,null);return r.data.id;}
 async function intent(){
  await db.query('insert into private.pocket_web_identities(app_user_id,stripe_customer_id) values($1,$2) on conflict do nothing',[user,'cus_QA']);
  const seed=(await db.query('select qa_checkout_seed($1,$2) as seed',[user,'cus_QA'])).rows[0].seed;
  const p=(await db.query('select private.prepare_pocket_checkout_intent($1,$2,$3,$4,$5,$6,$7,$8,$9) as p',[user,'one@example.test','cus_QA','price_QA',base.candidateSha,'acct_QA',false,base.offer,JSON.stringify(seed)])).rows[0].p;
  const scope={...base,intentId:p.intent_id,customerId:'cus_QA'};authority=scope;return scope;
 }
 async function dispatched(){const scope=await intent();const issued=await issuePocketCheckoutBaseline(scope,verifier);assert.equal(issued.kind,'ISSUED',JSON.stringify(issued));
 const row=(await db.query('select * from private.pocket_checkout_intents where intent_id=$1',[scope.intentId])).rows[0];
 const p=(await db.query('select private.claim_pocket_checkout_intent($1,$2,$3,$4,$5,$6,$7) as p',[user,scope.intentId,row.parameters_sha256,'cus_QA',base.candidateSha,'acct_QA',false])).rows[0].p;assert.equal(p.kind,'DISPATCH');
 const params=JSON.parse(row.parameters_text);
 sessions=[{id:'cs_test_QA',object:'checkout.session',created:Math.floor(Date.now()/1000),customer:'cus_QA',livemode:false,mode:'subscription',status:'open',payment_status:'unpaid',subscription:null,client_reference_id:user,metadata:params.metadata,expires_at:params.expires_at,url:'https://checkout.stripe.com/c/pay/cs_test_QA'}];
 return{...scope,sessionId:'cs_test_QA'};}
 return{runtime,verifier,enroll,intent,dispatched,get writes(){return writes;},get gets(){return gets;},get customer(){return customer;},get sessions(){return sessions;},setAuthority:v=>{authority=v;},beforeRpc:fn=>{beforeRpc=fn;},onCreate:fn=>{onCreate=fn;},onRpc:fn=>{onRpc=fn;},setCustomer:v=>{customer=v;},price:v=>{pricePatch=v;},account:v=>{account=v;},session:v=>{sessionPatch=v;},schedule:v=>{schedules=v;},subscription:v=>{subscriptions=v;},fence:f.data};
}
async function check(name,fn){await test(name,async()=>{const h=await fixture();try{await fn(h);}finally{await db.exec('rollback');}});}
try{
await check('new customer requires independent enrollment; zero writes',async h=>{assert.equal((await provisionPocketCustomer(base,h.runtime)).kind,'HOLD');assert.equal(h.writes,0);});
await check('approved provisioning binds UUID; repeated claims create once',async h=>{await h.enroll();const a=await provisionPocketCustomer(base,h.runtime);assert.equal(a.kind,'BOUND');assert.equal((await provisionPocketCustomer(base,h.runtime)).id,'cus_QA');assert.equal(h.writes,1);assert.equal((await db.query('select count(*)::int as n from private.pocket_web_identities')).rows[0].n,1);});
await check('lost dispatch response never creates again; known customer recovery binds',async h=>{const provisionId=await h.enroll();h.onCreate(()=>{throw Error('synthetic private response');});assert.equal((await provisionPocketCustomer(base,h.runtime)).kind,'HOLD');assert.equal((await provisionPocketCustomer(base,h.runtime)).kind,'HOLD');assert.equal(h.writes,1);assert.equal((await recoverPocketCustomer({...base,provisionId,customerId:'cus_QA'},h.verifier)).kind,'BOUND');});
await check('lost claim acknowledgement leaves unresolved with zero provider writes',async h=>{await h.enroll();h.onRpc((n,a,r)=>n==='claim_pocket_customer_provision'?{data:null,error:'lost'}:r);assert.equal((await provisionPocketCustomer(base,h.runtime)).kind,'HOLD');assert.equal(h.writes,0);h.onRpc(null);assert.equal((await provisionPocketCustomer(base,h.runtime)).kind,'HOLD');});
await check('lost persistence acknowledgement reuses durable binding',async h=>{await h.enroll();h.onRpc((n,a,r)=>n==='record_pocket_customer_provision'?{data:null,error:'lost'}:r);assert.equal((await provisionPocketCustomer(base,h.runtime)).kind,'HOLD');h.onRpc(null);assert.equal((await provisionPocketCustomer(base,h.runtime)).kind,'BOUND');assert.equal(h.writes,1);});
await check('cancellation after provider outcome still saves binding',async h=>{await h.enroll();const a=new AbortController();h.onCreate(()=>a.abort());assert.equal((await provisionPocketCustomer(base,h.runtime,a.signal)).kind,'HOLD');assert.equal((await provisionPocketCustomer(base,h.runtime)).kind,'BOUND');assert.equal(h.writes,1);});
await check('cancellation before dispatch makes zero provider writes',async h=>{await h.enroll();const a=new AbortController();a.abort();assert.equal((await provisionPocketCustomer(base,h.runtime,a.signal)).kind,'HOLD');assert.equal(h.writes,0);});
await check('changed authenticated UUID rejects customer dispatch',async h=>{await h.enroll();h.setAuthority({...base,userId:'22222222-2222-4222-8222-222222222222'});assert.equal((await provisionPocketCustomer(base,h.runtime)).kind,'HOLD');assert.equal(h.writes,0);});
await check('wrong account rejects customer dispatch',async h=>{await h.enroll();h.account('acct_WRONG');assert.equal((await provisionPocketCustomer(base,h.runtime)).kind,'HOLD');assert.equal(h.writes,0);});
await check('changed price amount/mode rejects customer dispatch',async h=>{await h.enroll();h.price({unit_amount:599,livemode:true});assert.equal((await provisionPocketCustomer(base,h.runtime)).kind,'HOLD');assert.equal(h.writes,0);});
await check('forged SDK driver rejected before RPC',async h=>{await h.enroll();assert.equal((await provisionPocketCustomer(base,{...h.runtime,driver:{...h.runtime.driver}})).kind,'HOLD');assert.equal(h.writes,0);});
await check('expired enrollment never dispatches',async h=>{await h.enroll();await db.exec("update private.pocket_customer_provisions set approved_until=now()-interval '1 second'");assert.equal((await provisionPocketCustomer(base,h.runtime)).kind,'HOLD');assert.equal(h.writes,0);});
await check('known customer with wrong metadata cannot recover',async h=>{const provisionId=await h.enroll();h.onCreate(()=>{throw Error('lost');});await provisionPocketCustomer(base,h.runtime);h.setCustomer({...h.customer,metadata:{}});assert.equal((await recoverPocketCustomer({...base,provisionId,customerId:'cus_QA'},h.verifier)).kind,'HOLD');});
await check('runtime role cannot recover, enroll or register fences',async h=>{for(const [name,args]of[['recover_pocket_customer_provision',{p_id:user,p_scope:base,p_customer:{}}],['enroll_pocket_customer_provision',{p_scope:base,p_enrollment_sha256:'d'.repeat(64),p_fence_sha256:h.fence.receipt_sha256}],['register_pocket_checkout_fence',{p_scope:base,p_evidence:{}}]])assert.ok((await rpc('service_role',name,args)).error);});
await check('anon/authenticated cannot claim provisioning',async()=>{for(const role of ['anon','authenticated'])assert.ok((await rpc(role,'prepare_pocket_customer_provision',{p_scope:base})).error);});
await check('baseline issuer collects and attests actual synthetic inventory',async h=>{const s=await h.intent();assert.equal((await issuePocketCheckoutBaseline(s,h.verifier)).kind,'ISSUED');assert.equal(h.writes,0);});
await check('runtime cannot issue baseline',async h=>{const s=await h.intent();assert.equal((await issuePocketCheckoutBaseline(s,h.runtime)).kind,'HOLD');});
await check('future subscription schedule blocks baseline',async h=>{const s=await h.intent();h.schedule([{object:'subscription_schedule',id:'sub_sched_QA',customer:'cus_QA',livemode:false,metadata:{},created:1,status:'not_started',subscription:null,released_subscription:null}]);assert.equal((await issuePocketCheckoutBaseline(s,h.verifier)).kind,'HOLD');});
await check('fence changes during inventory fail closed',async h=>{const s=await h.intent();let n=0;h.onRpc((name,a,r)=>{if(name==='get_pocket_checkout_fence'&&++n===2)return{...r,data:{...r.data,receipt_sha256:'e'.repeat(64)}};return r;});assert.equal((await issuePocketCheckoutBaseline(s,h.verifier)).kind,'HOLD');});
await check('lost checkout result recovers known open session with zero provider POST',async h=>{const s=await h.dispatched();assert.equal((await reconcilePocketCheckout(s,h.verifier)).kind,'RECOVERED');assert.equal(h.writes,0);assert.equal((await db.query('select state from private.pocket_checkout_intents')).rows[0].state,'READY');});
await check('unknown or mismatched session cannot release dispatch',async h=>{const s=await h.dispatched();assert.equal((await reconcilePocketCheckout({...s,sessionId:'cs_test_OTHER'},h.verifier)).kind,'HOLD');assert.equal((await db.query('select state from private.pocket_checkout_intents')).rows[0].state,'DISPATCHED');});
await check('wrong candidate metadata cannot recover',async h=>{const s=await h.dispatched();h.session({metadata:{...h.sessions[0].metadata,pocket_candidate_sha:'f'.repeat(40)}});assert.equal((await reconcilePocketCheckout(s,h.verifier)).kind,'HOLD');});
await check('foreign checkout URL cannot recover',async h=>{const s=await h.dispatched();h.session({url:'https://evil.example/c/pay/x'});assert.equal((await reconcilePocketCheckout(s,h.verifier)).kind,'HOLD');});
await check('terminal session retained; new intent requires fresh baseline',async h=>{const s=await h.dispatched();h.sessions[0].status='expired';h.sessions[0].url=null;assert.equal((await reconcilePocketCheckout(s,h.verifier)).kind,'RECONCILED');const next=await h.intent();assert.notEqual(next.intentId,s.intentId);const rows=(await db.query('select state from private.pocket_checkout_intents order by created_at')).rows;assert.deepEqual(rows.map(r=>r.state),['RECONCILED','BASELINE_REQUIRED']);assert.equal((await db.query('select count(*)::int as n from private.pocket_checkout_reconciliations')).rows[0].n,1);});
await check('completed session with active subscription remains HOLD',async h=>{const s=await h.dispatched();h.sessions[0].status='complete';h.sessions[0].subscription='sub_QA';h.sessions[0].payment_status='paid';h.subscription([{object:'subscription',id:'sub_QA',customer:'cus_QA',livemode:false,metadata:{},created:1,status:'active'}]);assert.equal((await reconcilePocketCheckout(s,h.verifier)).kind,'HOLD');});
await check('complete/canceled subscription can reconcile after fresh inventory',async h=>{const s=await h.dispatched();h.sessions[0].status='complete';h.sessions[0].subscription='sub_QA';h.sessions[0].payment_status='paid';h.subscription([{object:'subscription',id:'sub_QA',customer:'cus_QA',livemode:false,metadata:{},created:1,status:'canceled'}]);assert.equal((await reconcilePocketCheckout(s,h.verifier)).kind,'RECONCILED');});
await check('old count-only issuer is revoked',async()=>{await db.exec('savepoint denied; set local role pocket_checkout_verifier;');await assert.rejects(db.exec("select public.attest_pocket_checkout_baseline(null,null,null,null,null,null,null,null,null,null,null,null,null,null)"),/permission denied/);await db.exec('rollback to savepoint denied; reset role;');});
await check('private tables denied to runtime despite BYPASSRLS',async()=>{await db.exec('savepoint denied; set local role service_role;');await assert.rejects(db.exec('delete from private.pocket_customer_provisions'),/permission denied/);await db.exec('rollback to savepoint denied; reset role;');});

await check('baseline SQL rejects tampered inventory hash',async h=>{const s=await h.intent();h.beforeRpc((n,a)=>n==='issue_pocket_checkout_baseline'?{...a,p_inventory_sha256:'f'.repeat(64)}:a);assert.equal((await issuePocketCheckoutBaseline(s,h.verifier)).kind,'HOLD');});
for(const [name,mutate] of [
 ['hidden active subscription',e=>{e.subscriptions.push({id:'sub_HIDDEN',status:'active'});}],
 ['hidden future schedule',e=>{e.subscriptionSchedules.push({id:'sub_sched_HIDDEN',status:'not_started'});}],
 ['unresolved completed checkout',e=>{e.checkoutSessions.push({id:'cs_test_HIDDEN',status:'complete',mode:'subscription',subscription:'sub_UNKNOWN'});}],
 ['released schedule without subscription evidence',e=>{e.subscriptionSchedules.push({id:'sub_sched_HIDDEN',status:'released',releasedSubscription:null});}],
 ['wrong price scope',e=>{e.scope.priceId='price_OTHER';}],
 ['stale inventory',e=>{e.inventoryStartedAt='2000-01-01T00:00:00Z';}],
 ['missing all-pages marker',e=>{e.allPagesVerified=false;}],
])await check('SQL independently rejects '+name+' despite zero blocker summary',async h=>{const s=await h.intent();h.beforeRpc((n,a)=>{if(n!=='issue_pocket_checkout_baseline')return a;const e=JSON.parse(a.p_inventory_text);mutate(e);const text=JSON.stringify(e);return{...a,p_inventory_text:text,p_inventory_sha256:createHash('sha256').update(text).digest('hex')};});assert.equal((await issuePocketCheckoutBaseline(s,h.verifier)).kind,'HOLD');assert.equal((await db.query('select state from private.pocket_checkout_intents')).rows[0].state,'BASELINE_REQUIRED');});
await check('issued baseline retains complete receipt and historical cutover evidence',async h=>{const s=await h.intent();assert.equal((await issuePocketCheckoutBaseline(s,h.verifier)).kind,'ISSUED');assert.ok((await db.query('select inventory_text from private.pocket_checkout_baselines')).rows[0].inventory_text);assert.equal((await db.query('select count(*)::int as n from private.pocket_checkout_fence_history')).rows[0].n,1);});
await check('open recovery then terminal reconciliation retains both observations',async h=>{const s=await h.dispatched();assert.equal((await reconcilePocketCheckout(s,h.verifier)).kind,'RECOVERED');h.sessions[0].status='expired';h.sessions[0].url=null;assert.equal((await reconcilePocketCheckout(s,h.verifier)).kind,'RECONCILED');assert.equal((await db.query('select count(*)::int as n from private.pocket_checkout_reconciliations')).rows[0].n,2);});
await check('banned user cannot dispatch or bind provisioning',async h=>{await h.enroll();await db.exec("update auth.users set banned_until=now()+interval '1 hour'");assert.equal((await provisionPocketCustomer(base,h.runtime)).kind,'HOLD');assert.equal(h.writes,0);});
await check('invalid provisioning token cannot bind outcome',async h=>{await h.enroll();h.onCreate(()=>{throw Error('lost');});await provisionPocketCustomer(base,h.runtime);const row=(await db.query('select * from private.pocket_customer_provisions')).rows[0];const r=await rpc('service_role','record_pocket_customer_provision',{p_id:row.id,p_token:user,p_scope:base,p_customer:h.customer});assert.ok(r.error);assert.equal((await db.query('select count(*)::int as n from private.pocket_web_identities')).rows[0].n,0);});
console.log('No provider traffic. PGlite functional/ACL evidence only; no multi-session concurrency claim.');
}finally{await db.close();}
