/** Actual PostgreSQL backend concurrency. Requires dedicated disposable CI container. */
import test from 'node:test';import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';import {pathToFileURL} from 'node:url';
import {createIgDemoPostgresStore} from '../../app/lib/server/ig-demo-postgres.ts';
if(process.env.MONACO_DISPOSABLE_PG!=='YES'||process.env.PGHOST!=='127.0.0.1'||process.env.PGDATABASE!=='monaco_ig_acceptance'||process.env.PGPORT!=='5432')throw Error('DISPOSABLE_LOOPBACK_DATABASE_REQUIRED');
const {default:pg}=await import(pathToFileURL(process.env.MONACO_PG_MODULE!).href);const {Pool}=pg;
const config={host:'127.0.0.1',port:5432,database:'monaco_ig_acceptance',user:'postgres',connectionTimeoutMillis:2000,statement_timeout:5000};
const admin=new Pool({...config,max:4});let pool:any;
const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222';
const sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms));
async function blocked(count:number){const until=Date.now()+800;while(Date.now()<until){const r=await admin.query("SELECT count(*)::int n FROM pg_stat_activity WHERE datname='monaco_ig_acceptance' AND usename='ig_runtime_test' AND wait_event_type='Lock'");if(r.rows[0].n>=count)return;await sleep(10);}throw Error('independent backend contention not observed');}
try{
 assert.equal((await admin.query('SELECT current_database() d')).rows[0].d,'monaco_ig_acceptance');
 await admin.query(await readFile(new URL('../../docs/ntp/ig-offline-2026-10-24/UNINSTALLED-storage.sql',import.meta.url),'utf8'));
 await admin.query('CREATE ROLE ig_runtime_test LOGIN NOSUPERUSER NOBYPASSRLS; GRANT ig_demo_runtime TO ig_runtime_test; CREATE ROLE ig_browser_test LOGIN NOSUPERUSER NOBYPASSRLS;');
 pool=new Pool({...config,user:'ig_runtime_test',max:12,application_name:'monaco-disposable-acceptance'});
 const factory=(application:string,app=6,account=4)=>createIgDemoPostgresStore(pool,application,{application:app,account});
 await test('real independent PostgreSQL sessions and restricted runtime identity',async()=>{
 const clients=await Promise.all([pool.connect(),pool.connect()]);try{const ids=await Promise.all(clients.map((c:any)=>c.query('SELECT pg_backend_pid() pid,current_user u')));assert.notEqual(ids[0].rows[0].pid,ids[1].rows[0].pid);assert.equal(ids[0].rows[0].u,'ig_runtime_test');console.log('INDEPENDENT_BACKENDS',ids.map((r:any)=>r.rows[0].pid).join(','));}finally{clients.forEach((c:any)=>c.release());}
 });
 await test('native PostgreSQL RLS blocks cross-owner, application and browser access',async()=>{
 const one=factory('isolation'),two=factory('other');await one.store.revoke(A);assert.equal(await one.store.read(B),null);assert.equal(await two.store.read(A),null);
 const c=await pool.connect();try{await c.query('BEGIN');await c.query("SELECT set_config('ig_demo.application','isolation',true),set_config('ig_demo.owner_id',$1,true)",[B]);assert.equal((await c.query('SELECT * FROM ig_demo_private.sessions')).rows.length,0);await assert.rejects(c.query("INSERT INTO ig_demo_private.sessions VALUES('isolation',$1,1,NULL)",[A]),/row-level security/);}finally{await c.query('ROLLBACK');c.release();}
 const browser=new Pool({...config,user:'ig_browser_test'});try{await assert.rejects(browser.query('SELECT * FROM ig_demo_private.sessions'),/permission denied/);await assert.rejects(browser.query('SET ROLE ig_demo_runtime'),/permission denied/);}finally{await browser.end();}
 });
 await test('overlapping revoke fences a blocked stale save on another backend',async()=>{
 const s=factory('revoke').store;await s.revoke(A);await s.save(A,'1','synthetic-ciphertext');const lock=await admin.connect();
 try{await lock.query('BEGIN');await lock.query("UPDATE ig_demo_private.sessions SET epoch=epoch+1,sealed=NULL WHERE application='revoke' AND owner_id=$1",[A]);const pending=s.save(A,'1','stale');await blocked(1);await lock.query('COMMIT');assert.equal(await pending,false);assert.deepEqual(await s.read(A),{epoch:'2',sealed:null});}finally{await lock.query('ROLLBACK');lock.release();}
 });
 await test('overlapping shared application/account quota reservations cannot overbook',async()=>{
 const s=factory('quota').store;const lock=await admin.connect();try{await lock.query('BEGIN');await lock.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',['pocket-ig-demo-quota:quota']);const pending=Array.from({length:10},(_,i)=>s.reserve(i%2?'ONE':'TWO'));await blocked(2);await lock.query('COMMIT');const result=await Promise.all(pending);assert.equal(result.filter(Boolean).length,6);const rows=(await admin.query("SELECT account_id,count(*)::int n FROM ig_demo_private.requests WHERE application='quota' GROUP BY account_id")).rows;assert.ok(rows.every((r:any)=>r.n<=4));console.log('QUOTA_OVERLAP_PROVED',result.filter(Boolean).length);}finally{await lock.query('ROLLBACK');lock.release();}
 });
 await test('same-account concurrent cap enforced independently of application cap',async()=>{const results=await Promise.all(Array.from({length:8},()=>factory('accountcap',6,2).store.reserve('ONE')));assert.equal(results.filter(Boolean).length,2);});
 await test('concurrent revocations are monotonic and conditional cleanup preserves newer state',async()=>{
 const s=factory('epochs').store;const rows=await Promise.all(Array.from({length:8},()=>s.revoke(A)));assert.deepEqual(rows.map(r=>Number(r!.epoch)).sort((a,b)=>a-b),[1,2,3,4,5,6,7,8]);assert.equal(await s.revoke(A,'7'),null);assert.equal(await s.save(A,'8','new'),true);assert.equal((await s.read(A))?.sealed,'new');
 });
 await test('rollback releases row contention without leaking generation or connection context',async()=>{
 const s=factory('rollback').store;await s.revoke(A);const c=await admin.connect();try{await c.query('BEGIN');await c.query("UPDATE ig_demo_private.sessions SET epoch=99 WHERE application='rollback'");const pending=s.revoke(A);await blocked(1);await c.query('ROLLBACK');assert.equal((await pending)?.epoch,'2');}finally{await c.query('ROLLBACK');c.release();}assert.equal((await pool.query('SELECT * FROM ig_demo_private.sessions')).rows.length,0);
 });
 await test('lock timeout fails closed and pooled client recovers after lock release',async()=>{
 const s=factory('timeout').store;const c=await admin.connect();try{await c.query('BEGIN');await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',['pocket-ig-demo-quota:timeout']);await assert.rejects(s.reserve('ONE'),/IG_DEMO_STORE_UNAVAILABLE/);await c.query('ROLLBACK');assert.equal(await s.reserve('ONE'),true);}finally{await c.query('ROLLBACK');c.release();}
 });
 await test('quota expiration uses actual database clock and preserves current reservations',async()=>{const s=factory('expiry',1,1).store;assert.equal(await s.reserve('ONE'),true);assert.equal(await s.reserve('ONE'),false);await admin.query("UPDATE ig_demo_private.requests SET charged_at=clock_timestamp()-interval '61 seconds' WHERE application='expiry'");assert.equal(await s.reserve('ONE'),true);});
 await test('native rollback of inserted quota charge does not consume allowance',async()=>{const c=await admin.connect();try{await c.query('BEGIN');await c.query("INSERT INTO ig_demo_private.requests VALUES('charge-rollback','ONE',clock_timestamp())");await c.query('ROLLBACK');assert.equal(await factory('charge-rollback',1,1).store.reserve('ONE'),true);}finally{c.release();}});
}finally{await pool?.end();await admin.end();}
