/** Reuse the reviewed SQL, with fail-closed, hash-pinned transport adaptations.
 * No provisioner, credentials, network or initial budget/approval seeding. */
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const root=new URL('../',import.meta.url);
const hash=s=>createHash('sha256').update(s).digest('hex');
function pinned(path,expected){const s=readFileSync(new URL(path,root),'utf8');if(hash(s)!==expected)throw Error('Reviewed SQL source changed: '+path);return s;}
export function prepareNeonLedgerSql(){
 let base=pinned('supabase/migrations/20261014113000_pocket_benchmark_pilot.sql','2c0586c0cc785ac896374e3d0d6989a2e2e4c924c7ebd176c67c0565ca49f2b3');
 let extension=pinned('supabase/proposed/monaco-isolated-runner.sql','1af63b6badcafa7c0fd23f6a398098626c3457f6f5f85657bcde2296476750ed');
 const oldBackend="backend_ref text not null check(backend_ref ~ '^[a-z]{20}$'\n   and backend_ref not in ('pxlqvaddvghjjhenqmdh','opmgzchnmcgnsfwpmysc'))";
 const oldStaging="check(staging_ref ~ '^[a-z]{20}$' and staging_ref not in ('pxlqvaddvghjjhenqmdh','opmgzchnmcgnsfwpmysc'))";
 if(!extension.includes(oldBackend)||!extension.includes(oldStaging))throw Error('Exact backend adapter anchors missing');
 const shape="'^neon:[a-z0-9-]{3,100}/br-[a-z0-9-]{3,100}/[a-z_][a-z0-9_]{0,62}$'";
 extension=extension.replace(oldBackend,()=>`backend_ref text not null check(backend_ref ~ ${shape})`)
  .replace(oldStaging,()=>`check(staging_ref ~ ${shape})`);
 const roles=s=>s.replace(/,\s*anon\b/g,'').replace(/,\s*authenticated\b/g,'').replace(/\bservice_role\b/g,'monaco_ledger_runner');
 return ['begin;',"set local lock_timeout='5s'; set local statement_timeout='30s';",
  `do $$ begin
   if exists(select 1 from pg_namespace where nspname='private') then raise exception 'New empty ledger database required'; end if;
   if not exists(select 1 from pg_roles where rolname='monaco_ledger_runner') then
    create role monaco_ledger_runner nologin nosuperuser nocreatedb nocreaterole noinherit noreplication nobypassrls;
   end if;
   if exists(select 1 from pg_roles r where r.rolname='monaco_ledger_runner' and
    (r.rolsuper or r.rolcreatedb or r.rolcreaterole or r.rolinherit or r.rolreplication or r.rolbypassrls))
    or exists(select 1 from pg_auth_members m join pg_roles r on r.oid=m.member where r.rolname='monaco_ledger_runner')
    then raise exception 'Runner must have no privileged role memberships'; end if;
  end $$;`,
  'create schema private; create schema extensions; create extension pgcrypto with schema extensions;',
  roles(base),roles(extension),readFileSync(new URL('database/neon/ledger-security.sql',root),'utf8'),'commit;'].join('\n');
}
if(process.argv[1]&&import.meta.url===new URL('file://'+process.argv[1]).href)process.stdout.write(prepareNeonLedgerSql());
