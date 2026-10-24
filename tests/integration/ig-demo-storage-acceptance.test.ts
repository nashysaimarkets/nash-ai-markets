/** Real embedded PostgreSQL SQL/role acceptance; NOT multi-backend concurrency evidence. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {createIgDemoPostgresStore} from '../../app/lib/server/ig-demo-postgres.ts';
import {createIgDemoCipher} from '../../app/lib/server/ig-demo-shared.ts';
const modulePath=process.env.MONACO_PGLITE_MODULE;
if(!modulePath)throw Error('Set MONACO_PGLITE_MODULE to existing isolated PGlite installation');
const {PGlite}=await import(pathToFileURL(modulePath).href);
const db=new PGlite();
const A='00000000-0000-4000-8000-000000000001',B='00000000-0000-4000-8000-000000000002';
const cipher=createIgDemoCipher(new Uint8Array(32).fill(7)); // synthetic fixture only
await db.exec(await readFile(new URL('../../docs/ntp/ig-offline-2026-10-24/UNINSTALLED-storage.sql',import.meta.url),'utf8'));
await db.exec('CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN;');
const pool={connect:async()=>{await db.exec('SET ROLE ig_demo_runtime');return {query:(sql:string,p?:unknown[])=>db.query(sql,p),release(){}};}};
const adapter=createIgDemoPostgresStore(pool,'app',{application:3,account:2});
async function admin(sql:string,p?:unknown[]){await db.exec('RESET ROLE');return db.query(sql,p);}
async function scoped(sql:string,p?:unknown[],id=A,app='app',role='ig_demo_runtime'){
 await db.exec('RESET ROLE; BEGIN; SET LOCAL ROLE '+role);
 try{await db.query("SELECT set_config('ig_demo.application',$1,true),set_config('ig_demo.owner_id',$2,true)",[app,id]);return await db.query(sql,p);}finally{await db.exec('ROLLBACK; RESET ROLE');}
}
await test('real SQL: ciphertext roundtrip and owner/purpose authentication',async()=>{
 const sealed=cipher.seal(A,'credential',{password:'synthetic-private-value'});
 await admin("INSERT INTO ig_demo_private.credentials VALUES('app',$1,'DEMO',true,$2)",[A,sealed]);
 assert.equal(await adapter.vaultRead(A),sealed);assert.equal(await adapter.vaultRead(B),null);
 assert.deepEqual(cipher.open(A,'credential',sealed),{password:'synthetic-private-value'});
 assert.throws(()=>cipher.open(B,'credential',sealed));assert.throws(()=>cipher.open(A,'session',sealed));
 assert.equal(sealed.includes('synthetic-private-value'),false);
});
await test('real SQL: browser roles cannot read or write any private table',async()=>{
 for(const role of ['anon','authenticated'])for(const table of ['sessions','credentials','chart_provenance','requests']){
 await assert.rejects(()=>scoped(`SELECT * FROM ig_demo_private.${table}`,[],A,'app',role),/permission denied/);
 await assert.rejects(()=>scoped(`DELETE FROM ig_demo_private.${table}`,[],A,'app',role),/permission denied/);
 }
});
await test('real SQL: RLS denies unfiltered cross-owner and cross-application reads',async()=>{
 assert.equal((await scoped('SELECT * FROM ig_demo_private.credentials',[],B)).rows.length,0);
 assert.equal((await scoped('SELECT * FROM ig_demo_private.credentials',[],A,'other')).rows.length,0);
 assert.equal((await scoped('SELECT * FROM ig_demo_private.credentials',[],'')).rows.length,0);
 assert.equal((await scoped('SELECT * FROM ig_demo_private.credentials')).rows.length,1);
});
await test('real SQL: runtime cannot mutate credential/provenance authority',async()=>{
 await assert.rejects(()=>scoped("UPDATE ig_demo_private.credentials SET enabled=false"),/permission denied/);
 await assert.rejects(()=>scoped('DELETE FROM ig_demo_private.chart_provenance'),/permission denied/);
 // Session is the test superuser; SET ROLE cannot test login membership denial.
 const members=(await admin("SELECT * FROM pg_auth_members WHERE roleid=(SELECT oid FROM pg_roles WHERE rolname='ig_demo_runtime')")).rows;assert.equal(members.length,0);
});
await test('real SQL: generation CAS/revocation fence and user isolation',async()=>{
 const first=await adapter.store.revoke(A);assert.equal(first?.epoch,'1');
 assert.equal(await adapter.store.save(A,'1',cipher.seal(A,'session',{expiresAt:1})),true);
 assert.equal(await adapter.store.read(B),null);
 assert.equal((await adapter.store.revoke(A))?.epoch,'2');
 assert.equal(await adapter.store.save(A,'1','stale'),false);
 assert.equal(await adapter.store.revoke(A,'1'),null);
 assert.deepEqual(await adapter.store.read(A),{epoch:'2',sealed:null});
 await assert.rejects(()=>scoped("INSERT INTO ig_demo_private.sessions VALUES('app',$1,1,NULL)",[B]),/row-level security/);
 assert.equal((await scoped('UPDATE ig_demo_private.sessions SET sealed=\'bad\' RETURNING *',[],B)).rows.length,0);
});
await test('real SQL: uppercase UUID uses canonical owner context',async()=>{
 const id='abcdefab-0000-4000-8000-000000000001';
 assert.equal((await adapter.store.revoke(id.toUpperCase()))?.epoch,'1');
 assert.equal((await adapter.store.read(id))?.epoch,'1');
});
await test('real SQL: rollback preserves generation and transaction context does not leak',async()=>{
 await scoped('UPDATE ig_demo_private.sessions SET epoch=999');
 assert.equal((await adapter.store.read(A))?.epoch,'2');
 await db.exec('SET ROLE ig_demo_runtime');
 assert.equal((await db.query('SELECT * FROM ig_demo_private.sessions')).rows.length,0);
});
await test('real SQL: quotas share application/account budget and expire by DB clock',async()=>{
 assert.equal(await adapter.store.reserve('ONE'),true);assert.equal(await adapter.store.reserve('ONE'),true);
 assert.equal(await adapter.store.reserve('ONE'),false);assert.equal(await adapter.store.reserve('TWO'),true);assert.equal(await adapter.store.reserve('THREE'),false);
 assert.equal((await scoped('SELECT * FROM ig_demo_private.requests',[],'','other')).rows.length,0);
 await admin("UPDATE ig_demo_private.requests SET charged_at=clock_timestamp()-interval '61 seconds'");
 assert.equal(await adapter.store.reserve('ONE'),true);
 assert.equal((await scoped('SELECT * FROM ig_demo_private.requests')).rows.length,1);
});
await test('real SQL: provenance requires owner, token hash, application and unexpired row',async()=>{
 const hash=createHash('sha256').update('chart').digest();
 await admin("INSERT INTO ig_demo_private.chart_provenance VALUES('app',$1,$2,$3,clock_timestamp()+interval '1 hour','IX.D.SPTRD.DAILY.IP','CFD')",[A,hash,'a'.repeat(40)]);
 assert.equal((await adapter.provenance(A,'chart'))?.revision,'a'.repeat(40));assert.equal(await adapter.provenance(B,'chart'),null);assert.equal(await adapter.provenance(A,'wrong'),null);
 await admin("UPDATE ig_demo_private.chart_provenance SET expires_at=clock_timestamp()-interval '1 second'");assert.equal(await adapter.provenance(A,'chart'),null);
});
await test('real SQL: disabled vault entry fails closed and all tables force RLS',async()=>{
 await admin('UPDATE ig_demo_private.credentials SET enabled=false');assert.equal(await adapter.vaultRead(A),null);
 const rows=(await admin("SELECT relrowsecurity,relforcerowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='ig_demo_private' AND c.relkind='r'")).rows;
 assert.equal(rows.length,4);assert.ok(rows.every((r:any)=>r.relrowsecurity&&r.relforcerowsecurity));
});
await db.close();
