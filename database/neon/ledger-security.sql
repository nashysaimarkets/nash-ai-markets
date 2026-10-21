-- Applied only to the new isolated ledger. Project/branch/endpoint are populated
-- from verified Neon control-plane evidence, never inferred from a Supabase ID.
create table private.monaco_neon_identity (
 singleton boolean primary key default true check(singleton),
 organization_id text not null check(organization_id ~ '^org-[a-z0-9-]{3,100}$'),
 project_id text not null check(project_id ~ '^[a-z0-9-]{3,100}$'),
 branch_id text not null check(branch_id ~ '^br-[a-z0-9-]{3,100}$'),
 endpoint_host text not null check(endpoint_host ~ '^ep-[a-z0-9-]+[.][a-z0-9.-]+[.]neon[.]tech$'),
 database_name text not null check(database_name ~ '^[a-z_][a-z0-9_]{0,62}$'),
 runner_role text not null check(runner_role='monaco_ledger_runner'),
 control_plane_evidence_sha256 text not null check(control_plane_evidence_sha256 ~ '^[a-f0-9]{64}$'),
 verified_at timestamptz not null,
 backend_ref text generated always as ('neon:'||project_id||'/'||branch_id||'/'||database_name) stored unique
);
alter table private.monaco_neon_identity enable row level security;
create trigger monaco_neon_identity_immutable before update or delete on private.monaco_neon_identity
 for each row execute function private.block_pocket_benchmark_budget_change();
create trigger monaco_neon_identity_no_reset before truncate on private.monaco_neon_identity
 for each statement execute function private.block_pocket_benchmark_budget_change();
alter table private.monaco_runner_binding add constraint monaco_neon_exact_backend
 foreign key(backend_ref) references private.monaco_neon_identity(backend_ref);

-- The legacy generic measurement and usage containers cannot be used to store
-- charts, prompts or raw outputs. The runner has no general-purpose write path.
alter table private.pocket_benchmark_pilot_cases add constraint monaco_no_measurement_payload
 check(measurement is null and measurement_sha256 is null and measurement_recorded_at is null);
alter table private.pocket_benchmark_pilot_calls add constraint monaco_usage_counts_only check (
 provider_usage is null or (jsonb_typeof(provider_usage)='object' and
 provider_usage - array['input_tokens','output_tokens','total_tokens'] = '{}'::jsonb));
alter table private.pocket_benchmark_pilot_calls add constraint monaco_provider_ids_only check (
 (provider_request_id is null or provider_request_id ~ '^[a-zA-Z0-9_-]{1,200}$') and
 (provider_response_id is null or provider_response_id ~ '^[a-zA-Z0-9_-]{1,200}$'));
alter table private.pocket_benchmark_pilot_calls add constraint monaco_fixed_void_reason check (
 void_reason is null or void_reason='Not dispatched; existing rescue/cancellation predicate');

-- One fixed SQL entry point; no REST, JWT, service role or client-selected SQL.
-- The certificate-verified endpoint and database/role are also checked by the
-- transport. Project/branch identity comes from the accepted control-plane pin.
create function public.monaco_neon_rpc(p_neon jsonb,p_identity jsonb,p_operation text,p_args jsonb) returns jsonb
language plpgsql security definer set search_path=pg_catalog,private as $$
declare n private.monaco_neon_identity%rowtype; budget jsonb; k text;
begin
 select * into n from private.monaco_neon_identity where singleton;
 if not found or session_user <> n.runner_role or current_database() <> n.database_name
  or n.verified_at>clock_timestamp()
  or p_neon is distinct from jsonb_build_object('organizationId',n.organization_id,'projectId',n.project_id,
    'branchId',n.branch_id,'endpointHost',n.endpoint_host,'databaseName',n.database_name,
    'roleName',n.runner_role,'controlPlaneEvidenceSha256',n.control_plane_evidence_sha256)
  or p_identity->>'backendRef' is distinct from n.backend_ref then
  raise exception 'Verified Neon endpoint/database/role binding required';
 end if;
 k:=case when p_operation='inspect_monaco_isolated_runner' then p_args->>'p_key' else p_args->>'p_ledger_key' end;
 budget:=private.inspect_monaco_isolated_runner(k,p_identity);
 case p_operation
 when 'inspect_monaco_isolated_runner' then return budget;
 when 'claim_pocket_benchmark_case' then
  return private.claim_pocket_benchmark_case(k,p_args->>'p_case_id',p_args->>'p_project_ref',
   p_args->>'p_owner_approval_ref',p_args->>'p_candidate_sha',p_args->'p_plan');
 when 'submit_pocket_benchmark_call' then
  return private.submit_pocket_benchmark_call(k,p_args->>'p_case_id',p_args->>'p_slot',p_args->>'p_envelope_sha256');
 when 'record_pocket_benchmark_receipt' then
  return private.record_pocket_benchmark_receipt(k,p_args->>'p_case_id',p_args->>'p_slot',p_args->>'p_provider_request_id',
   p_args->>'p_response_id',p_args->>'p_model',p_args->>'p_service_tier',p_args->'p_usage',p_args->>'p_envelope_sha256');
 when 'void_pocket_benchmark_call' then
  return private.void_pocket_benchmark_call(k,p_args->>'p_case_id',p_args->>'p_slot',p_args->>'p_reason');
 when 'account_pocket_benchmark_reserved_case' then
  return private.account_pocket_benchmark_reserved_case(k,p_args->>'p_case_id');
 else raise exception 'Operation outside isolated ledger allowlist';
 end case;
end $$;

revoke all on schema private,extensions from public,monaco_ledger_runner;
revoke create on schema public from public,monaco_ledger_runner;
revoke all on all tables in schema private from public,monaco_ledger_runner;
revoke all on all sequences in schema private from public,monaco_ledger_runner;
revoke all on all functions in schema private,public from public,monaco_ledger_runner;
grant usage on schema public to monaco_ledger_runner;
grant execute on function public.monaco_neon_rpc(jsonb,jsonb,text,jsonb) to monaco_ledger_runner;
alter default privileges in schema private,public revoke execute on functions from public;
do $$ begin
 execute format('revoke all on database %I from public,monaco_ledger_runner',current_database());
 execute format('grant connect on database %I to monaco_ledger_runner',current_database());
end $$;
-- No identity or balance fabricated, no LOGIN password, no enabled allowance.
