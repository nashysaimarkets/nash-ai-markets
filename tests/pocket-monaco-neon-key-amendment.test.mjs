import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {prepareNeonLedgerSql} from '../scripts/prepare-monaco-neon-ledger.mjs';
assert.equal(process.env.MONACO_QA_DISPOSABLE_POSTGRES,'true');
const {Client}=(await import(pathToFileURL(process.env.MONACO_QA_PG_MODULE))).default;
const base={host:'127.0.0.1',port:5432,user:'postgres',database:'postgres',connectionTimeoutMillis:5000};
const control=new Client(base);await control.connect();
const sql=readFileSync(new URL('../database/neon/20261021-authorized-inference-key.sql',import.meta.url),'utf8');
const oldKey='key_EjND5GXtuqF2K0hp',newKey='key_aD5pc20EZBLGECNC';
await control.query('create role monaco_ledger_owner login nosuperuser createrole noinherit nobypassrls');
async function fixture(body){
 await control.query('create database monaco_ledger owner monaco_ledger_owner');
 const c=new Client({...base,user:'monaco_ledger_owner',database:'monaco_ledger'});await c.connect();
 try{
  const fresh=prepareNeonLedgerSql();assert.equal(fresh.split(newKey).length,2);
  await c.query(fresh.replace(newKey,oldKey));
  await control.query('alter role monaco_ledger_runner nologin');
  await c.query(`insert into private.monaco_neon_identity values(true,
   'org-icy-butterfly-11039021','bitter-grass-28096464','br-aged-mode-zaa9u7lr',
   'ep-silent-fire-za1s230f.c-2.eu-west-2.aws.neon.tech','monaco_ledger','monaco_ledger_runner',
   '32c788992c1909a8c704e35744f94ebb6df82fd121cff4878653a1d1da03dfc1',now())`);
  await body(c);
 }finally{await c.end();await control.query('drop database monaco_ledger');}
}
const constraint=async c=>(await c.query("select pg_get_constraintdef(oid) as definition from pg_constraint where conrelid='private.monaco_runner_binding'::regclass and conname='monaco_runner_binding_existing_key_tracking_id_check'")).rows[0].definition;
await test('owner key amendment preserves empty history and restricted privileges; rejects repeat application',async()=>fixture(async c=>{
 const before=(await c.query('select * from private.monaco_prior_budget')).rows;
 await c.query(sql);assert.ok((await constraint(c)).includes(newKey));assert.ok(!(await constraint(c)).includes(oldKey));
 assert.deepEqual((await c.query('select * from private.monaco_prior_budget')).rows,before);
 const role=(await c.query("select rolcanlogin,rolsuper,rolcreatedb,rolcreaterole,rolinherit,rolreplication,rolbypassrls from pg_roles where rolname='monaco_ledger_runner'")).rows[0];
 assert.ok(Object.values(role).every(x=>x===false));
 await assert.rejects(()=>c.query(sql));await c.query('rollback');assert.ok((await constraint(c)).includes(newKey));
}));
await test('active runner refuses the key amendment atomically',async()=>fixture(async c=>{
 await control.query('alter role monaco_ledger_runner login');
 try{await assert.rejects(()=>c.query(sql));await c.query('rollback');assert.ok((await constraint(c)).includes(oldKey));}
 finally{await control.query('alter role monaco_ledger_runner nologin');}
}));
await test('existing immutable binding is never rebound or erased',async()=>fixture(async c=>{
 await c.query(`insert into private.monaco_runner_binding(ledger_key,backend_ref,environment_name,runner_source_sha,project_ref,existing_key_tracking_id,key_fingerprint_sha256,paid_scope_ref,plan_sha256,setup_approval_sha256,processor_acceptance_sha256,binding_evidence_sha256)
 values('synthetic-existing-binding','neon:bitter-grass-28096464/br-aged-mode-zaa9u7lr/monaco_ledger','monaco-first-six-inference',repeat('a',40),'proj_LTmAIE2Ve7gUAFJ9M74ZxIBI','key_EjND5GXtuqF2K0hp',repeat('b',64),'issue126-6309459418','9490af55e554f84d63d7afc1fe2442298afd6cdbe8f356d6d8d0517504420ff0',repeat('d',64),repeat('e',64),repeat('f',64))`);
 await c.query("insert into private.monaco_prior_budget values(true,1000000,250000,125000,true,true,true,'synthetic-retained-evidence',repeat('a',64),now())");
 const history=(await c.query('select * from private.monaco_prior_budget')).rows;
 const before=(await c.query('select * from private.monaco_runner_binding')).rows;
 await assert.rejects(()=>c.query(sql));await c.query('rollback');
 assert.ok((await constraint(c)).includes(oldKey));assert.deepEqual((await c.query('select * from private.monaco_runner_binding')).rows,before);assert.deepEqual((await c.query('select * from private.monaco_prior_budget')).rows,history);
}));
await control.query('drop role monaco_ledger_owner');await control.end();
