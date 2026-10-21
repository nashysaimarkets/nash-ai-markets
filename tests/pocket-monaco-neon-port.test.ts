import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {prepareNeonLedgerSql} from '../scripts/prepare-monaco-neon-ledger.mjs';
import {createNeonSqlPort,neonConnectionOptions,validateNeonIdentity,type NeonIdentity} from '../scripts/pocket-monaco-neon-port.ts';
import {createIsolatedLedgerBridge,FROZEN_PLAN_SHA256} from '../scripts/pocket-monaco-runner-bridge.ts';
const n:NeonIdentity={organizationId:'org-synthetic-qa',projectId:'synthetic-qa-project',branchId:'br-synthetic-qa',
 endpointHost:'ep-synthetic-qa.eu-west-2.aws.neon.tech',databaseName:'monaco_ledger',roleName:'monaco_ledger_runner',controlPlaneEvidenceSha256:'1'.repeat(64)};
const identity={environment:'monaco-first-six-inference',sourceSha:'a'.repeat(40),backendRef:validateNeonIdentity(n),
 projectRef:'proj_LTmAIE2Ve7gUAFJ9M74ZxIBI',keyTrackingId:'key_aD5pc20EZBLGECNC',keyFingerprintSha256:'b'.repeat(64),planSha256:FROZEN_PLAN_SHA256};
test('Neon canonical identity is independent of Supabase 20-letter identifiers',()=>{
 assert.equal(identity.backendRef,'neon:synthetic-qa-project/br-synthetic-qa/monaco_ledger');
 assert.throws(()=>validateNeonIdentity({...n,endpointHost:'pxlqvaddvghjjhenqmdh.supabase.co'}));
 assert.throws(()=>validateNeonIdentity({...n,roleName:'neondb_owner'}));
 assert.throws(()=>validateNeonIdentity({...n,databaseName:'x;drop table private.x'}));
 assert.throws(()=>validateNeonIdentity({...n,secret:'FORBIDDEN'} as NeonIdentity));
});
test('connection pins certificate hostname, database and least-privilege role without URI overrides',()=>{
 const o=neonConnectionOptions(n,'SYNTHETIC-ONLY-NOT-A-REAL-PASSWORD');
 assert.equal(o.host,n.endpointHost);assert.equal(o.ssl.rejectUnauthorized,true);assert.equal(o.ssl.servername,n.endpointHost);
 assert.equal(o.database,n.databaseName);assert.equal(o.user,'monaco_ledger_runner');assert.equal('connectionString' in o,false);
 assert.throws(()=>neonConnectionOptions(n,''));
});
test('fixed parameterized dispatcher rejects arbitrary SQL before query; single attempt on failure',async()=>{
 const calls:any[]=[];const client={query:async(text:string,values?:unknown[])=>{calls.push({text,values});throw Error('SENSITIVE-ERROR-MUST-NOT-LEAK');}};
 const port=createNeonSqlPort(client,n,identity);
 assert.ok((await port.rpc('drop table private.x',{})).error);assert.equal(calls.length,0);
 const result=await port.rpc('inspect_monaco_isolated_runner',{p_key:"x');select secret;--"});
 assert.equal(calls.length,1);assert.equal(calls[0].text,'select public.monaco_neon_rpc($1::jsonb,$2::jsonb,$3::text,$4::jsonb) as result');
 assert.equal(JSON.stringify(result).includes('SENSITIVE-ERROR'),false);
});
test('transport freezes verified identity and cannot enable dispatch',()=>{
 const nn={...n};let values:unknown[]|undefined;
 const port=createNeonSqlPort({query:async(_t,v)=>{values=v;return{rows:[{result:{}}]};}},nn,identity);
 nn.branchId='br-changed';
 assert.throws(()=>createNeonSqlPort({query:async()=>({rows:[]})},n,{...identity,backendRef:'neon:other/br-other/db'}));
 const b=createIsolatedLedgerBridge(port,'ledger',identity);assert.throws(()=>b.dispatch(),/DISABLED/);
 return port.rpc('inspect_monaco_isolated_runner',{}).then(()=>assert.equal(JSON.parse(values![0] as string).branchId,n.branchId));
});
test('schema adapter reuses pinned sources and installs no compatibility roles or budget seed',()=>{
 const sql=prepareNeonLedgerSql();
 assert.ok(sql.includes('monaco_neon_exact_backend'));assert.ok(sql.includes('session_user <> n.runner_role'));
 assert.ok(sql.includes('nologin nosuperuser nocreatedb nocreaterole noinherit noreplication nobypassrls'));
 assert.equal(/to service_role|from public,anon|create role anon|create role authenticated/.test(sql),false);
 assert.equal(sql.includes('insert into private.monaco_prior_budget'),false);
 assert.equal(sql.includes('create function public.monaco_neon_rpc'),true);
 assert.equal(readFileSync(new URL('../database/neon/ledger-security.sql',import.meta.url),'utf8').includes('measurement is null'),true);
});
