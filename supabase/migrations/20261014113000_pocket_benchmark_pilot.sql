-- Separate owner-approved USD $5 benchmark pilot. This intentionally does not
-- alter or infer headroom in the unresolved historical $2 test-spend ledger.
create table private.pocket_benchmark_pilot_ledgers (
  ledger_key text primary key check (length(ledger_key) between 1 and 200),
  cap_microusd bigint not null check (cap_microusd between 1 and 5000000),
  project_ref text not null check (length(project_ref) between 1 and 200),
  -- One immutable, canonical ledger per owner approval. Reject rather than silently
  -- normalise aliases, so a different ledger_key cannot reset the same $5 cap.
  owner_approval_ref text not null unique,
  candidate_sha text not null check (candidate_sha ~ '^[0-9a-f]{40}$'),
  rate_tier text not null check (rate_tier = 'default'),
  pricing_evidence_ref text not null check (length(pricing_evidence_ref) between 1 and 500),
  allowed_case_ids text[] not null check (cardinality(allowed_case_ids) between 1 and 6),
  config_verified_at timestamptz,
  enabled boolean not null default false,
  created_at timestamptz not null default now(),
  -- Scope check is a table constraint because it binds several columns.
  constraint pocket_benchmark_owner_approval_scope check (
    owner_approval_ref = 'comment-6165012632'
    or (
      owner_approval_ref ~ '^qa-[a-z0-9][a-z0-9-]{2,119}$'
      and project_ref = 'proj_qa'
      and ledger_key like 'qa-%'
    )
  )
);

-- This pilot's approval record is append-only: toggling enabled never creates
-- fresh spending allowance. Initial config verification (NULL -> timestamp)
-- and deliberate enable/disable are the ONLY allowed ledger updates.
create or replace function private.guard_pocket_benchmark_pilot_approval()
returns trigger language plpgsql security invoker set search_path=pg_catalog as $$
begin
  if TG_OP='DELETE' then
    raise exception 'benchmark approval cannot be deleted or reset';
  end if;
  if row(NEW.ledger_key,NEW.cap_microusd,NEW.project_ref,NEW.owner_approval_ref,
         NEW.candidate_sha,NEW.rate_tier,NEW.pricing_evidence_ref,NEW.allowed_case_ids,NEW.created_at)
     is distinct from
     row(OLD.ledger_key,OLD.cap_microusd,OLD.project_ref,OLD.owner_approval_ref,
         OLD.candidate_sha,OLD.rate_tier,OLD.pricing_evidence_ref,OLD.allowed_case_ids,OLD.created_at)
     or (OLD.config_verified_at is not null
         and NEW.config_verified_at is distinct from OLD.config_verified_at) then
    raise exception 'benchmark approval scope and cap are immutable';
  end if;
  return NEW;
end; $$;

create trigger guard_pocket_benchmark_pilot_approval
before update or delete on private.pocket_benchmark_pilot_ledgers
for each row execute function private.guard_pocket_benchmark_pilot_approval();

-- PostgreSQL TRUNCATE does not invoke row DELETE triggers. Deny the
-- separate statement-level reset path as defence in depth.
create or replace function private.block_pocket_benchmark_approval_truncate()
returns trigger language plpgsql security invoker set search_path=pg_catalog as $$
begin
  raise exception 'benchmark approval ledger cannot be truncated';
end; $$;

create trigger block_pocket_benchmark_approval_truncate
before truncate on private.pocket_benchmark_pilot_ledgers
for each statement execute function private.block_pocket_benchmark_approval_truncate();

revoke truncate on private.pocket_benchmark_pilot_ledgers from public,anon,authenticated,service_role;

create table private.pocket_benchmark_pilot_cases (
  ledger_key text not null references private.pocket_benchmark_pilot_ledgers(ledger_key),
  case_id text not null check (case_id ~ '^[a-z0-9][a-z0-9-]{1,79}$'),
  candidate_sha text not null check (candidate_sha ~ '^[0-9a-f]{40}$'),
  status text not null default 'reserved' check (status in ('reserved','submitted','settled','blocked')),
  measurement jsonb,
  measurement_sha256 text check (measurement_sha256 ~ '^[0-9a-f]{64}$'),
  measurement_recorded_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (ledger_key, case_id)
);

create table private.pocket_benchmark_pilot_calls (
  ledger_key text not null,
  case_id text not null,
  project_ref text not null check (length(project_ref) between 1 and 200),
  slot text not null check (slot in ('main','primary_precision','rescue_precision')),
  model text not null check (length(model) between 1 and 200),
  service_tier text not null check (service_tier = 'default'),
  max_output_tokens integer not null check (max_output_tokens > 0),
  max_input_text_chars integer not null check (max_input_text_chars > 0),
  max_schema_bytes integer not null check (max_schema_bytes > 0),
  max_images integer not null check (max_images between 1 and 2),
  max_image_bytes integer not null check (max_image_bytes > 0),
  max_image_width integer not null check (max_image_width > 0),
  max_image_height integer not null check (max_image_height > 0),
  max_image_pixels bigint not null check (max_image_pixels > 0),
  cost_bound_evidence_ref text not null check (length(cost_bound_evidence_ref) between 1 and 500),
  estimated_microusd bigint not null check (estimated_microusd between 1 and 5000000),
  status text not null default 'reserved' check (status in ('reserved','submitted','settled','voided')),
  envelope_sha256 text check (envelope_sha256 ~ '^[0-9a-f]{64}$'),
  provider_request_id text,
  provider_response_id text,
  provider_model text,
  provider_service_tier text,
  provider_usage jsonb,
  actual_microusd bigint check (actual_microusd >= 0),
  submitted_at timestamptz,
  receipt_recorded_at timestamptz,
  settled_at timestamptz,
  voided_at timestamptz,
  void_reason text,
  primary key (ledger_key, case_id, slot),
  unique (project_ref,provider_request_id),
  unique (project_ref,provider_response_id),
  foreign key (ledger_key, case_id) references private.pocket_benchmark_pilot_cases(ledger_key, case_id)
);

-- Manual, independently checked cost evidence. Normal service_role dispatch cannot
-- insert these rows; an authorised database administrator must check actual
-- external billing records before attesting any charge (including a $0 charge).
-- An evidence hash is an audit reference, not automatically a provider signature.
create table private.pocket_benchmark_pilot_cost_attestations (
  ledger_key text not null,
  case_id text not null,
  slot text not null,
  project_ref text not null check (length(project_ref) between 1 and 200),
  provider_request_id text not null check (length(provider_request_id) between 1 and 200),
  provider_response_id text not null check (length(provider_response_id) between 1 and 200),
  model text not null check (length(model) between 1 and 200),
  service_tier text not null check (service_tier='default'),
  actual_microusd bigint not null check (actual_microusd >= 0),
  external_billing_evidence_ref text not null check (length(external_billing_evidence_ref) between 12 and 500),
  external_billing_evidence_sha256 text not null check (external_billing_evidence_sha256 ~ '^[0-9a-f]{64}$'),
  reviewer_ref text not null check (length(reviewer_ref) between 6 and 200),
  verified_at timestamptz not null default now(),
  primary key (ledger_key,case_id,slot),
  unique (project_ref,provider_request_id),
  foreign key (ledger_key,case_id,slot) references private.pocket_benchmark_pilot_calls(ledger_key,case_id,slot)
);

-- Attested evidence is append-only, even for privileged service callers.
create or replace function private.block_pocket_benchmark_cost_attestation_change()
returns trigger language plpgsql security invoker set search_path=pg_catalog as $$
begin
  raise exception 'benchmark billing attestation is immutable';
end; $$;

create trigger block_pocket_benchmark_cost_attestation_change
before update or delete on private.pocket_benchmark_pilot_cost_attestations
for each row execute function private.block_pocket_benchmark_cost_attestation_change();

create trigger block_pocket_benchmark_cost_attestation_truncate
before truncate on private.pocket_benchmark_pilot_cost_attestations
for each statement execute function private.block_pocket_benchmark_cost_attestation_change();

alter table private.pocket_benchmark_pilot_ledgers enable row level security;
alter table private.pocket_benchmark_pilot_cases enable row level security;
alter table private.pocket_benchmark_pilot_calls enable row level security;
alter table private.pocket_benchmark_pilot_cost_attestations enable row level security;

revoke all on private.pocket_benchmark_pilot_ledgers, private.pocket_benchmark_pilot_cases, private.pocket_benchmark_pilot_calls, private.pocket_benchmark_pilot_cost_attestations from public, anon, authenticated, service_role;

create or replace function private.claim_pocket_benchmark_case(
  p_ledger_key text, p_case_id text, p_project_ref text, p_owner_approval_ref text,
  p_candidate_sha text, p_plan jsonb
) returns jsonb language plpgsql security definer set search_path=pg_catalog,private as $$
declare
  v_ledger private.pocket_benchmark_pilot_ledgers%rowtype;
  v_call jsonb;
  v_total bigint;
  v_committed bigint;
begin
  if p_case_id !~ '^[a-z0-9][a-z0-9-]{1,79}$' or p_candidate_sha !~ '^[0-9a-f]{40}$'
     or jsonb_typeof(p_plan) <> 'array' or jsonb_array_length(p_plan) <> 3 then raise exception 'invalid benchmark case claim'; end if;
  select * into v_ledger from private.pocket_benchmark_pilot_ledgers where ledger_key=p_ledger_key for update;
  if not found or not v_ledger.enabled or v_ledger.config_verified_at is null then raise exception 'benchmark ledger disabled'; end if;
  if v_ledger.project_ref <> p_project_ref or v_ledger.owner_approval_ref <> p_owner_approval_ref
     or v_ledger.candidate_sha <> p_candidate_sha or v_ledger.rate_tier <> 'default' then raise exception 'benchmark scope mismatch'; end if;
  if not (p_case_id = any(v_ledger.allowed_case_ids)) then return jsonb_build_object('allowed',false,'reason','case_not_approved'); end if;
  if exists(select 1 from private.pocket_benchmark_pilot_cases where ledger_key=p_ledger_key and case_id=p_case_id) then
    return jsonb_build_object('allowed',false,'reason','case_already_claimed','idempotent',true);
  end if;
  if (select count(*) from private.pocket_benchmark_pilot_cases where ledger_key=p_ledger_key) >= 6 then
    return jsonb_build_object('allowed',false,'reason','six_case_limit');
  end if;
  if exists(select 1 from private.pocket_benchmark_pilot_calls where ledger_key=p_ledger_key and status in ('reserved','submitted')) then
    return jsonb_build_object('allowed',false,'reason','previous_case_unresolved');
  end if;
  if (select count(distinct value->>'slot') from jsonb_array_elements(p_plan)) <> 3
     or exists(select 1 from jsonb_array_elements(p_plan) x(value) where value->>'slot' not in ('main','primary_precision','rescue_precision')
       or nullif(value->>'model','') is null or value->>'serviceTier' <> 'default'
       or nullif(value->>'costBoundEvidenceRef','') is null
       or (value->>'maxOutputTokens') !~ '^[0-9]+$' or (value->>'maxInputTextChars') !~ '^[0-9]+$'
       or (value->>'maxSchemaBytes') !~ '^[0-9]+$' or (value->>'maxImages') !~ '^[0-9]+$'
       or (value->>'maxImageBytes') !~ '^[0-9]+$' or (value->>'maxImageWidth') !~ '^[0-9]+$'
       or (value->>'maxImageHeight') !~ '^[0-9]+$' or (value->>'maxImagePixels') !~ '^[0-9]+$'
       or (value->>'maxCostMicroUsd') !~ '^[0-9]+$'
       or (value->>'maxImages')::int not between 1 and 2
       or (value->>'maxImageWidth')::int < 1 or (value->>'maxImageHeight')::int < 1
       or (value->>'maxImagePixels')::bigint < 1
       or (value->>'maxCostMicroUsd')::bigint not between 1 and 5000000) then raise exception 'invalid complete call plan'; end if;
  select sum((value->>'maxCostMicroUsd')::bigint) into v_total from jsonb_array_elements(p_plan);
  select coalesce(sum(case when status='settled' then coalesce(actual_microusd,estimated_microusd) else estimated_microusd end),0) into v_committed
    from private.pocket_benchmark_pilot_calls where ledger_key=p_ledger_key and status in ('reserved','submitted','settled');
  if v_committed + v_total > v_ledger.cap_microusd then
    return jsonb_build_object('allowed',false,'reason','pilot_cap_exceeded','committed_microusd',v_committed,'remaining_microusd',greatest(0,v_ledger.cap_microusd-v_committed));
  end if;
  insert into private.pocket_benchmark_pilot_cases(ledger_key,case_id,candidate_sha) values(p_ledger_key,p_case_id,p_candidate_sha);
  for v_call in select value from jsonb_array_elements(p_plan) loop
    insert into private.pocket_benchmark_pilot_calls(ledger_key,case_id,project_ref,slot,model,service_tier,
      max_output_tokens,max_input_text_chars,max_schema_bytes,max_images,max_image_bytes,max_image_width,max_image_height,max_image_pixels,cost_bound_evidence_ref,estimated_microusd)
      values(p_ledger_key,p_case_id,v_ledger.project_ref,v_call->>'slot',v_call->>'model','default',
        (v_call->>'maxOutputTokens')::int,(v_call->>'maxInputTextChars')::int,(v_call->>'maxSchemaBytes')::int,
        (v_call->>'maxImages')::int,(v_call->>'maxImageBytes')::int,(v_call->>'maxImageWidth')::int,
        (v_call->>'maxImageHeight')::int,(v_call->>'maxImagePixels')::bigint,v_call->>'costBoundEvidenceRef',(v_call->>'maxCostMicroUsd')::bigint);
  end loop;
  return jsonb_build_object('allowed',true,'status','reserved','idempotent',false,'committed_microusd',v_committed+v_total,'remaining_microusd',v_ledger.cap_microusd-v_committed-v_total);
end; $$;

create or replace function private.record_pocket_benchmark_measurement(p_ledger_key text,p_case_id text,p_measurement jsonb)
returns jsonb language plpgsql security definer set search_path=pg_catalog,private as $$
declare v_sha text; v_existing text; v_receipts int; v_reserved int;
begin
  if p_measurement is null or jsonb_typeof(p_measurement)<>'object' or pg_column_size(p_measurement)>262144 then raise exception 'invalid benchmark measurement'; end if;
  perform 1 from private.pocket_benchmark_pilot_ledgers where ledger_key=p_ledger_key for update;
  select count(*) filter(where status='reserved'),count(*) filter(where slot in ('main','primary_precision') and receipt_recorded_at is not null)
    into v_reserved,v_receipts from private.pocket_benchmark_pilot_calls where ledger_key=p_ledger_key and case_id=p_case_id;
  if v_reserved<>0 or v_receipts<>2 then raise exception 'complete receipted primary path required'; end if;
  v_sha:=encode(extensions.digest(convert_to(p_measurement::text,'utf8'),'sha256'),'hex');
  select measurement_sha256 into v_existing from private.pocket_benchmark_pilot_cases where ledger_key=p_ledger_key and case_id=p_case_id for update;
  if not found then raise exception 'benchmark case missing'; end if;
  if v_existing is not null and v_existing<>v_sha then raise exception 'benchmark measurement conflict'; end if;
  update private.pocket_benchmark_pilot_cases set measurement=coalesce(measurement,p_measurement),measurement_sha256=coalesce(measurement_sha256,v_sha),
    measurement_recorded_at=coalesce(measurement_recorded_at,now()) where ledger_key=p_ledger_key and case_id=p_case_id;
  return jsonb_build_object('ok',true,'measurement_sha256',v_sha,'released',false);
end; $$;

create or replace function private.release_pocket_benchmark_measurement(p_ledger_key text,p_case_id text)
returns jsonb language plpgsql security definer set search_path=pg_catalog,private as $$
declare v_check jsonb; v_measurement jsonb; v_sha text;
begin
  perform 1 from private.pocket_benchmark_pilot_ledgers
    where ledger_key=p_ledger_key and enabled and config_verified_at is not null for update;
  if not found then
    return jsonb_build_object('released',false,'reason','benchmark_ledger_disabled');
  end if;
  v_check:=private.assert_pocket_benchmark_case_reconciled(p_ledger_key,p_case_id);
  if coalesce((v_check->>'reconciled')::boolean,false) is not true then
    return jsonb_build_object('released',false,'reason','authoritative_settlement_incomplete','reconciliation',v_check);
  end if;
  select measurement,measurement_sha256 into v_measurement,v_sha from private.pocket_benchmark_pilot_cases
    where ledger_key=p_ledger_key and case_id=p_case_id for update;
  if v_measurement is null or v_sha is null then return jsonb_build_object('released',false,'reason','measurement_missing'); end if;
  return jsonb_build_object('released',true,'measurement',v_measurement,'measurement_sha256',v_sha,'reconciliation',v_check);
end; $$;

create or replace function private.submit_pocket_benchmark_call(p_ledger_key text,p_case_id text,p_slot text,p_envelope_sha256 text)
returns jsonb language plpgsql security definer set search_path=pg_catalog,private as $$
declare v_call private.pocket_benchmark_pilot_calls%rowtype;
begin
  if p_envelope_sha256 !~ '^[0-9a-f]{64}$' then raise exception 'invalid envelope fingerprint'; end if;
  perform 1 from private.pocket_benchmark_pilot_ledgers where ledger_key=p_ledger_key and enabled and config_verified_at is not null for update;
  if not found then raise exception 'benchmark ledger disabled'; end if;
  select * into v_call from private.pocket_benchmark_pilot_calls where ledger_key=p_ledger_key and case_id=p_case_id and slot=p_slot for update;
  if not found then raise exception 'benchmark call missing'; end if;
  if v_call.status <> 'reserved' then return jsonb_build_object('ok',true,'status',v_call.status,'claimed',false); end if;
  update private.pocket_benchmark_pilot_calls set status='submitted',envelope_sha256=p_envelope_sha256,submitted_at=now()
    where ledger_key=p_ledger_key and case_id=p_case_id and slot=p_slot;
  update private.pocket_benchmark_pilot_cases set status='submitted' where ledger_key=p_ledger_key and case_id=p_case_id;
  return jsonb_build_object('ok',true,'status','submitted','claimed',true);
end; $$;

create or replace function private.record_pocket_benchmark_receipt(
  p_ledger_key text,p_case_id text,p_slot text,p_provider_request_id text,p_response_id text,
  p_model text,p_service_tier text,p_usage jsonb,p_envelope_sha256 text
) returns jsonb language plpgsql security definer set search_path=pg_catalog,private as $$
declare v_call private.pocket_benchmark_pilot_calls%rowtype;
begin
  if nullif(trim(p_provider_request_id),'') is null or nullif(trim(p_response_id),'') is null
    or nullif(trim(p_model),'') is null or p_service_tier is distinct from 'default'
    or p_envelope_sha256 is null or p_envelope_sha256 !~ '^[0-9a-f]{64}$'
    or p_usage is null or jsonb_typeof(p_usage)<>'object' or pg_column_size(p_usage)>16384
    or coalesce(jsonb_typeof(p_usage->'input_tokens'),'')<>'number'
    or coalesce(jsonb_typeof(p_usage->'output_tokens'),'')<>'number'
    or coalesce(jsonb_typeof(p_usage->'total_tokens'),'')<>'number'
    or coalesce(p_usage->>'input_tokens','') !~ '^[0-9]+$'
    or coalesce(p_usage->>'output_tokens','') !~ '^[0-9]+$'
    or coalesce(p_usage->>'total_tokens','') !~ '^[0-9]+$'
    or (p_usage->>'total_tokens')::bigint <> (p_usage->>'input_tokens')::bigint + (p_usage->>'output_tokens')::bigint
    then raise exception 'invalid provider receipt'; end if;
  perform 1 from private.pocket_benchmark_pilot_ledgers where ledger_key=p_ledger_key for update;
  select * into v_call from private.pocket_benchmark_pilot_calls where ledger_key=p_ledger_key and case_id=p_case_id and slot=p_slot for update;
  if not found or v_call.status <> 'submitted' or v_call.model is distinct from p_model or v_call.service_tier is distinct from p_service_tier
    or v_call.envelope_sha256 is distinct from p_envelope_sha256 then raise exception 'provider receipt scope mismatch'; end if;
  if exists(select 1 from private.pocket_benchmark_pilot_calls c where c.project_ref=v_call.project_ref
    and (c.provider_request_id=p_provider_request_id or c.provider_response_id=p_response_id)
    and (c.ledger_key,c.case_id,c.slot)<>(v_call.ledger_key,v_call.case_id,v_call.slot)) then raise exception 'provider receipt already attributed'; end if;
  if v_call.receipt_recorded_at is not null then
    if v_call.provider_request_id is distinct from p_provider_request_id or v_call.provider_response_id is distinct from p_response_id
      or v_call.provider_model is distinct from p_model or v_call.provider_service_tier is distinct from p_service_tier
      or v_call.provider_usage is distinct from p_usage or v_call.envelope_sha256 is distinct from p_envelope_sha256
      then raise exception 'provider receipt conflict'; end if;
  else
    update private.pocket_benchmark_pilot_calls set provider_request_id=p_provider_request_id,provider_response_id=p_response_id,
      provider_model=p_model,provider_service_tier=p_service_tier,provider_usage=p_usage,receipt_recorded_at=now()
      where ledger_key=p_ledger_key and case_id=p_case_id and slot=p_slot;
  end if;
  return jsonb_build_object('ok',true,'status','submitted');
end; $$;

create or replace function private.void_pocket_benchmark_call(p_ledger_key text,p_case_id text,p_slot text,p_reason text)
returns jsonb language plpgsql security definer set search_path=pg_catalog,private as $$
declare v_call private.pocket_benchmark_pilot_calls%rowtype;
begin
  perform 1 from private.pocket_benchmark_pilot_ledgers where ledger_key=p_ledger_key for update;
  select * into v_call from private.pocket_benchmark_pilot_calls where ledger_key=p_ledger_key and case_id=p_case_id and slot=p_slot for update;
  if not found then raise exception 'benchmark call missing'; end if;
  if v_call.status='reserved' then update private.pocket_benchmark_pilot_calls set status='voided',void_reason=left(p_reason,500),voided_at=now()
    where ledger_key=p_ledger_key and case_id=p_case_id and slot=p_slot;
  elsif v_call.status<>'voided' then raise exception 'possibly charged call cannot be voided'; end if;
  return jsonb_build_object('ok',true,'status','voided');
end; $$;

create or replace function private.settle_pocket_benchmark_call(p_ledger_key text,p_case_id text,p_slot text,p_actual_microusd bigint,p_provider_request_id text)
returns jsonb language plpgsql security definer set search_path=pg_catalog,private as $$
declare v_call private.pocket_benchmark_pilot_calls%rowtype; v_attest private.pocket_benchmark_pilot_cost_attestations%rowtype; v_cap bigint; v_total bigint;
begin
  if p_actual_microusd is null or p_actual_microusd<0 or nullif(trim(p_provider_request_id),'') is null then raise exception 'invalid authoritative settlement'; end if;
  select cap_microusd into v_cap from private.pocket_benchmark_pilot_ledgers where ledger_key=p_ledger_key for update;
  select * into v_call from private.pocket_benchmark_pilot_calls where ledger_key=p_ledger_key and case_id=p_case_id and slot=p_slot for update;
  if not found or v_call.status<>'submitted' or v_call.receipt_recorded_at is null or v_call.provider_request_id<>p_provider_request_id then raise exception 'submitted receipted call required'; end if;
  -- A caller-controlled cost (including zero) is not independent evidence.
  -- Only the separately permissioned administrator can insert append-only
  -- attestations after verifying actual externally attributable billing.
  select * into v_attest from private.pocket_benchmark_pilot_cost_attestations
    where ledger_key=p_ledger_key and case_id=p_case_id and slot=p_slot for update;
  if not found
    or v_attest.project_ref is distinct from v_call.project_ref
    or v_attest.provider_request_id is distinct from v_call.provider_request_id
    or v_attest.provider_response_id is distinct from v_call.provider_response_id
    or v_attest.model is distinct from v_call.provider_model
    or v_attest.service_tier is distinct from v_call.provider_service_tier
    or v_attest.actual_microusd is distinct from p_actual_microusd
    or nullif(trim(v_attest.external_billing_evidence_ref),'') is null
    or nullif(trim(v_attest.reviewer_ref),'') is null
  then raise exception 'independent billing attestation required'; end if;
  update private.pocket_benchmark_pilot_calls set status='settled',actual_microusd=p_actual_microusd,settled_at=now()
    where ledger_key=p_ledger_key and case_id=p_case_id and slot=p_slot;
  select coalesce(sum(case when status='settled' then coalesce(actual_microusd,estimated_microusd) else estimated_microusd end),0) into v_total
    from private.pocket_benchmark_pilot_calls where ledger_key=p_ledger_key and status in ('reserved','submitted','settled');
  return jsonb_build_object('ok',true,'status','settled','actual_microusd',p_actual_microusd,'committed_microusd',v_total,'cap_exceeded',v_total>v_cap);
end; $$;

create or replace function private.assert_pocket_benchmark_case_reconciled(p_ledger_key text,p_case_id text)
returns jsonb language plpgsql security definer set search_path=pg_catalog,private as $$
declare v_cap bigint; v_enabled boolean; v_config_verified_at timestamptz; v_total bigint; v_open int; v_required int; v_unknown int;
begin
  select cap_microusd,enabled,config_verified_at into v_cap,v_enabled,v_config_verified_at
    from private.pocket_benchmark_pilot_ledgers where ledger_key=p_ledger_key for update;
  if not found or v_enabled is not true or v_config_verified_at is null then
    return jsonb_build_object('reconciled',false,'reason','benchmark_ledger_disabled');
  end if;
  select count(*) filter(where status in ('reserved','submitted')),
    count(*) filter(where slot in ('main','primary_precision') and status='settled' and actual_microusd is not null
      and provider_usage is not null and receipt_recorded_at is not null
      and exists (
        select 1 from private.pocket_benchmark_pilot_cost_attestations a
        where a.ledger_key=p_ledger_key and a.case_id=p_case_id and a.slot=private.pocket_benchmark_pilot_calls.slot
          and a.actual_microusd=private.pocket_benchmark_pilot_calls.actual_microusd
          and a.provider_request_id=private.pocket_benchmark_pilot_calls.provider_request_id
          and a.provider_response_id=private.pocket_benchmark_pilot_calls.provider_response_id
          and a.project_ref=private.pocket_benchmark_pilot_calls.project_ref
      )),
    count(*) filter(where status='settled' and actual_microusd is null) into v_open,v_required,v_unknown
    from private.pocket_benchmark_pilot_calls where ledger_key=p_ledger_key and case_id=p_case_id;
  select coalesce(sum(case when status='settled' then coalesce(actual_microusd,estimated_microusd) else estimated_microusd end),0) into v_total
    from private.pocket_benchmark_pilot_calls where ledger_key=p_ledger_key and status in ('reserved','submitted','settled');
  if v_open=0 and v_required=2 and v_unknown=0 and v_total<=v_cap then update private.pocket_benchmark_pilot_cases set status='settled' where ledger_key=p_ledger_key and case_id=p_case_id; end if;
  return jsonb_build_object('reconciled',v_open=0 and v_required=2 and v_unknown=0 and v_total<=v_cap,
    'unknown_settlements',v_unknown,'cap_exceeded',v_total>v_cap,'committed_microusd',v_total);
end; $$;

grant usage on schema private to service_role;
revoke all on function private.claim_pocket_benchmark_case(text,text,text,text,text,jsonb), private.submit_pocket_benchmark_call(text,text,text,text), private.record_pocket_benchmark_receipt(text,text,text,text,text,text,text,jsonb,text), private.void_pocket_benchmark_call(text,text,text,text), private.settle_pocket_benchmark_call(text,text,text,bigint,text), private.assert_pocket_benchmark_case_reconciled(text,text), private.record_pocket_benchmark_measurement(text,text,jsonb), private.release_pocket_benchmark_measurement(text,text) from public,anon,authenticated,service_role;
grant execute on function private.claim_pocket_benchmark_case(text,text,text,text,text,jsonb), private.submit_pocket_benchmark_call(text,text,text,text), private.record_pocket_benchmark_receipt(text,text,text,text,text,text,text,jsonb,text), private.void_pocket_benchmark_call(text,text,text,text), private.settle_pocket_benchmark_call(text,text,text,bigint,text), private.assert_pocket_benchmark_case_reconciled(text,text), private.record_pocket_benchmark_measurement(text,text,jsonb), private.release_pocket_benchmark_measurement(text,text) to service_role;

create or replace function public.claim_pocket_benchmark_case(p_ledger_key text,p_case_id text,p_project_ref text,p_owner_approval_ref text,p_candidate_sha text,p_plan jsonb) returns jsonb language sql security invoker set search_path=pg_catalog as $$ select private.claim_pocket_benchmark_case(p_ledger_key,p_case_id,p_project_ref,p_owner_approval_ref,p_candidate_sha,p_plan) $$;
create or replace function public.submit_pocket_benchmark_call(p_ledger_key text,p_case_id text,p_slot text,p_envelope_sha256 text) returns jsonb language sql security invoker set search_path=pg_catalog as $$ select private.submit_pocket_benchmark_call(p_ledger_key,p_case_id,p_slot,p_envelope_sha256) $$;
create or replace function public.record_pocket_benchmark_receipt(p_ledger_key text,p_case_id text,p_slot text,p_provider_request_id text,p_response_id text,p_model text,p_service_tier text,p_usage jsonb,p_envelope_sha256 text) returns jsonb language sql security invoker set search_path=pg_catalog as $$ select private.record_pocket_benchmark_receipt(p_ledger_key,p_case_id,p_slot,p_provider_request_id,p_response_id,p_model,p_service_tier,p_usage,p_envelope_sha256) $$;
create or replace function public.void_pocket_benchmark_call(p_ledger_key text,p_case_id text,p_slot text,p_reason text) returns jsonb language sql security invoker set search_path=pg_catalog as $$ select private.void_pocket_benchmark_call(p_ledger_key,p_case_id,p_slot,p_reason) $$;
create or replace function public.settle_pocket_benchmark_call(p_ledger_key text,p_case_id text,p_slot text,p_actual_microusd bigint,p_provider_request_id text) returns jsonb language sql security invoker set search_path=pg_catalog as $$ select private.settle_pocket_benchmark_call(p_ledger_key,p_case_id,p_slot,p_actual_microusd,p_provider_request_id) $$;
create or replace function public.assert_pocket_benchmark_case_reconciled(p_ledger_key text,p_case_id text) returns jsonb language sql security invoker set search_path=pg_catalog as $$ select private.assert_pocket_benchmark_case_reconciled(p_ledger_key,p_case_id) $$;
create or replace function public.record_pocket_benchmark_measurement(p_ledger_key text,p_case_id text,p_measurement jsonb) returns jsonb language sql security invoker set search_path=pg_catalog as $$ select private.record_pocket_benchmark_measurement(p_ledger_key,p_case_id,p_measurement) $$;
create or replace function public.release_pocket_benchmark_measurement(p_ledger_key text,p_case_id text) returns jsonb language sql security invoker set search_path=pg_catalog as $$ select private.release_pocket_benchmark_measurement(p_ledger_key,p_case_id) $$;

grant execute on function public.claim_pocket_benchmark_case(text,text,text,text,text,jsonb), public.submit_pocket_benchmark_call(text,text,text,text), public.record_pocket_benchmark_receipt(text,text,text,text,text,text,text,jsonb,text), public.void_pocket_benchmark_call(text,text,text,text), public.settle_pocket_benchmark_call(text,text,text,bigint,text), public.assert_pocket_benchmark_case_reconciled(text,text) to service_role;
grant execute on function public.record_pocket_benchmark_measurement(text,text,jsonb), public.release_pocket_benchmark_measurement(text,text) to service_role;
revoke all on function public.claim_pocket_benchmark_case(text,text,text,text,text,jsonb), public.submit_pocket_benchmark_call(text,text,text,text), public.record_pocket_benchmark_receipt(text,text,text,text,text,text,text,jsonb,text), public.void_pocket_benchmark_call(text,text,text,text), public.settle_pocket_benchmark_call(text,text,text,bigint,text), public.assert_pocket_benchmark_case_reconciled(text,text) from public,anon,authenticated;
revoke all on function public.record_pocket_benchmark_measurement(text,text,jsonb), public.release_pocket_benchmark_measurement(text,text) from public,anon,authenticated;
