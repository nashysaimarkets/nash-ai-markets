import {PGlite} from '/workspace/scratch/29e2bd9f5a5a/qa-tools/node_modules/@electric-sql/pglite/dist/index.js';
import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const ev=JSON.parse(await readFile('../staging-native-evidence/BACKEND-READONLY.json','utf8'));
const flags=JSON.parse(await readFile('../staging-native-evidence/POLICY-FLAGS.json','utf8'));
const proposed=await readFile('supabase/proposed/20261024_membership_uuid_read_policy.sql','utf8');
const A='00000000-0000-4000-8000-000000000001',B='00000000-0000-4000-8000-000000000002';const results=[];
for(const [project,catalog] of Object.entries(ev.catalogs)){
 const db=new PGlite();let checks=0;
 try{
 await db.exec(`create role authenticated nologin;create role anon nologin;create role service_role nologin bypassrls;create schema auth;grant usage on schema auth to authenticated;create function auth.jwt() returns jsonb language sql stable as $$select current_setting('request.jwt.claims',true)::jsonb$$;create function auth.uid() returns uuid language sql stable as $$select (auth.jwt()->>'sub')::uuid$$;create table public.memberships(user_id uuid,email text,plan text);alter table public.memberships enable row level security;grant select on public.memberships to authenticated,service_role;insert into public.memberships values('${A}','member@example.invalid','fixture');`);
 for(const policy of flags[project].policies){assert.equal(policy.command,'SELECT');await db.exec(`create policy ${'"'+policy.name.replaceAll('"','""')+'"'} on public.memberships as ${policy.permissive} for select to ${policy.roles.join(',')} using (${policy.using});`);}
 async function count(id,email,role='authenticated') {await db.exec('begin');try{await db.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify({sub:id,email})]);await db.exec('set local role '+role);return Number((await db.query('select count(*) as n from public.memberships')).rows[0].n);}finally{await db.exec('rollback');}}
 assert.equal(await count(A,'member@example.invalid'),1);checks++;
 assert.equal(await count(B,'other@example.invalid'),0);checks++;
 const inherited=await count(B,'member@example.invalid');assert.equal(inherited,1);checks++;
 await assert.rejects(()=>count(B,'member@example.invalid','anon'),/permission denied/);checks++;
 let error;try{await db.exec(proposed);}catch(e){error=e.message;await db.exec('rollback');}assert.match(error,/review_required/);checks++;
 await db.exec("select set_config('monaco.membership_uuid_reviewed','true',false);insert into public.memberships values(null,'legacy@example.invalid','fixture');");
 try{await db.exec(proposed);}catch(e){error=e.message;await db.exec('rollback');}assert.match(error,/unbound_legacy_rows_hold/);checks++;
 assert.equal(await count(B,'legacy@example.invalid'),1);checks++; // failed migration preserves legacy visibility, no silent suppression
 await db.exec('delete from public.memberships where user_id is null;');
 await db.exec("create policy combined_review_fixture on public.memberships for all to service_role using (true) with check (true);");
 try{await db.exec(proposed);}catch(e){error=e.message;await db.exec('rollback');}assert.match(error,/combined_policy_review_required/);checks++;
 await db.exec('drop policy combined_review_fixture on public.memberships;create policy retained_write_fixture on public.memberships for update to authenticated using(false) with check(false);');
 for(const clause of ['as restrictive for select to authenticated using (true)','for select to service_role using (true)']){
 await db.exec('create policy unexpected_select_fixture on public.memberships '+clause);
 try{await db.exec(proposed);}catch(e){error=e.message;await db.exec('rollback');}assert.match(error,/select_policy_drift_review_required/);checks++;
 await db.exec('drop policy unexpected_select_fixture on public.memberships');
 }
 const fingerprint=(await db.query("select md5(string_agg(policyname||'|'||permissive||'|'||array_to_string(roles,',')||'|'||cmd||'|'||coalesce(qual,'')||'|'||coalesce(with_check,''), E'\\n' order by policyname)) fingerprint from pg_policies where schemaname='public' and tablename='memberships' and cmd='SELECT'")).rows[0].fingerprint;
 assert.equal(fingerprint,flags[project].selectFingerprint);checks++;
 await db.exec(proposed);
 assert.equal((await db.query("select count(*)::int n from pg_policies where tablename='memberships' and policyname='retained_write_fixture'")).rows[0].n,1);checks++;
 assert.equal(await count(A,'member@example.invalid'),1);checks++;
 assert.equal(await count(A,'changed@example.invalid'),1);checks++;
 assert.equal(await count(B,'member@example.invalid'),0);checks++;
 assert.equal(await count(B,'other@example.invalid'),0);checks++;
 assert.equal(await count(B,'other@example.invalid','service_role'),1);checks++;
 assert.equal((await db.query("select count(*)::int n from pg_policies where tablename='memberships' and cmd='SELECT'")).rows[0].n,1);checks++;
 await db.exec('alter table public.memberships rename to memberships_preserved;create table public.memberships(email text);');
 try{await db.exec(proposed);}catch(e){error=e.message;await db.exec('rollback');}assert.match(error,/membership_uuid_schema_required/);checks++;
 results.push({project,checksPassed:checks,baselineSameEmailDifferentUuidVisible:true,baselineUuidOnlyIsolation:'FAIL',privatePocketEntitlementBypass:'NOT_DEMONSTRATED',proposal:'PASS_ISOLATED_ONLY',liveApplied:false});
 }finally{await db.close();}
}
await writeFile('../staging-native-evidence/RLS.json',JSON.stringify({results,totalPassed:results.reduce((n,r)=>n+r.checksPassed,0),scope:'Actual read-only observed policy expressions run in disposable PGlite with synthetic rows/roles. No hosted rows read or changed; this is not hosted session/RLS acceptance.'},null,2)+'\n');console.log(results);
