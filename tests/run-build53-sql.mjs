// Disposable PGlite functional/ACL test, not real Apple or PostgreSQL concurrency.
import {readFile} from 'node:fs/promises';import {pathToFileURL} from 'node:url';import assert from 'node:assert/strict';
const modulePath=process.env.POCKET_QA_PGLITE_MODULE;
if(!modulePath?.startsWith('/')||!modulePath.endsWith('/@electric-sql/pglite/dist/index.js'))throw Error('Explicit local fixture module required');
const {PGlite}=await import(pathToFileURL(modulePath).href);const db=new PGlite();let checks=0;
try {
 await db.exec(`create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls; create schema auth;
 create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,is_anonymous boolean default false,banned_until timestamptz);
 create table public.pocket_founding_members(stripe_subscription_id text,status text,price_lock_active boolean,forfeited_at timestamptz,last_event_created_at bigint,updated_at timestamptz);
 create function public.sync_pocket_founding_650(text,text,text,boolean,timestamptz,bigint) returns void language sql as $$ select $$;`);
 for(const file of ['supabase/migrations/20261010173440_pocket_scan_entitlements.sql','supabase/migrations/20261011165326_pocket_apple_ownership_events.sql','supabase/migrations/20261014143000_bind_pocket_web_subscription_identity.sql','supabase/proposed/pocket-apple-owner-recovery.sql'])await db.exec(await readFile(file,'utf8'));
 const query=async(sql,expected)=>{const {rows}=await db.query(sql);assert.deepEqual(rows[0].result,expected);checks++;};
 const a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222';
 await query(`select public.has_pocket_web_subscription('${a}') as result`,false);
 await query(`select public.get_pocket_apple_owned_transactions('Production','${a}') as result`,[]);
 await db.exec('begin');
 await db.exec(`insert into private.pocket_apple_legacy_owners(environment,original_transaction_id,user_id,evidence_ref) values('Production','10001','${a}','synthetic-independent-evidence')`);
 await query(`select public.get_pocket_apple_owned_transactions('Production','${a}') as result`,['10001']);
 await query(`select public.get_pocket_apple_owned_transactions('Sandbox','${a}') as result`,[]);
 await query(`select public.get_pocket_apple_owned_transactions('Production','${b}') as result`,[]);
 await query(`select public.get_pocket_apple_owned_transactions('unknown','${a}') as result`,[]);
 await query(`select public.is_pocket_apple_legacy_owner('Production','10001','${a}') as result`,true);
 await db.exec(`update private.pocket_apple_legacy_owners set revoked=true where original_transaction_id='10001'`);
 await query(`select public.get_pocket_apple_owned_transactions('Production','${a}') as result`,[]);
 await db.exec(`insert into private.pocket_apple_legacy_owners(environment,original_transaction_id,user_id,evidence_ref) select 'Production',n::text,'${a}','synthetic-independent-evidence' from generate_series(10002,10008) n`);
 await query(`select jsonb_array_length(public.get_pocket_apple_owned_transactions('Production','${a}')) as result`,6);
 for(const role of ['anon','authenticated'])await query(`select has_function_privilege('${role}','public.get_pocket_apple_owned_transactions(text,uuid)','EXECUTE') as result`,false);
 await query(`select has_function_privilege('service_role','public.get_pocket_apple_owned_transactions(text,uuid)','EXECUTE') as result`,true);
 await query(`select has_table_privilege('service_role','private.pocket_apple_legacy_owners','INSERT') as result`,false);
 await db.exec('set local role service_role');
 await query(`select jsonb_array_length(public.get_pocket_apple_owned_transactions('Production','${a}')) as result`,6);
 await db.exec('reset role; rollback');
 await query(`select count(*)::int as result from private.pocket_apple_legacy_owners`,0);
 console.log(JSON.stringify({checks,passed:checks,failed:0,engine:'PGlite 0.3.14',hostedDatabaseCalls:0,customerWrites:0,fixtureRowsRemaining:0,concurrencyAcceptance:false}));
}finally{await db.close();}
