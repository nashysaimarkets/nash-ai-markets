-- Owner amendment issue126-6325858863; observed key issue126-6325893364.
-- Existing empty binding only. No password, role, allowance or history change.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
lock table private.monaco_runner_binding in access exclusive mode;
do $$
begin
 if current_database() <> 'monaco_ledger'
   or current_user <> 'monaco_ledger_owner' then
   raise exception 'Dedicated ledger owner required';
 end if;
 if not exists(select 1 from private.monaco_neon_identity
   where singleton and organization_id='org-icy-butterfly-11039021'
   and project_id='bitter-grass-28096464' and branch_id='br-aged-mode-zaa9u7lr'
   and endpoint_host='ep-silent-fire-za1s230f.c-2.eu-west-2.aws.neon.tech'
   and database_name=current_database() and runner_role='monaco_ledger_runner'
   and control_plane_evidence_sha256='32c788992c1909a8c704e35744f94ebb6df82fd121cff4878653a1d1da03dfc1') then
   raise exception 'Verified physical identity required';
 end if;
 if exists(select 1 from pg_roles where rolname='monaco_ledger_runner' and rolcanlogin)
   or exists(select 1 from private.monaco_runner_binding)
   or exists(select 1 from private.pocket_benchmark_budget_configs)
   or exists(select 1 from private.pocket_benchmark_pilot_cases)
   or exists(select 1 from private.pocket_benchmark_pilot_calls) then
   raise exception 'Unbound inactive ledger required; preserve existing history';
 end if;
 if not exists(select 1 from pg_constraint
   where conrelid='private.monaco_runner_binding'::regclass
   and conname='monaco_runner_binding_existing_key_tracking_id_check'
   and contype='c' and convalidated
   and pg_get_constraintdef(oid) = 'CHECK ((existing_key_tracking_id = ''key_EjND5GXtuqF2K0hp''::text))') then
   raise exception 'Expected original exact-key constraint required';
 end if;
 alter table private.monaco_runner_binding
   drop constraint monaco_runner_binding_existing_key_tracking_id_check;
 alter table private.monaco_runner_binding
   add constraint monaco_runner_binding_existing_key_tracking_id_check
   check(existing_key_tracking_id='key_aD5pc20EZBLGECNC');
end $$;
commit;
