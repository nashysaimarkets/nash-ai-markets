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
  select coalesce(sum(greatest(estimated_microusd,coalesce(actual_microusd,estimated_microusd))),0) into v_committed
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
  select coalesce(sum(greatest(estimated_microusd,coalesce(actual_microusd,estimated_microusd))),0) into v_total
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
  select coalesce(sum(greatest(estimated_microusd,coalesce(actual_microusd,estimated_microusd))),0) into v_total
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


-- Reserved-cost accounting v2. Appended to the reviewed, not-installed PR119 migration.
-- No owner approval, runtime binding, enabled ledger or cost attestation is seeded.
create table private.pocket_benchmark_budget_configs (
  ledger_key text not null references private.pocket_benchmark_pilot_ledgers(ledger_key),
  project_ref text not null,
  candidate_sha text not null check(candidate_sha ~ '^[0-9a-f]{40}$'),
  staging_ref text not null check(staging_ref='pxlqvaddvghjjhenqmdh'),
  key_tracking_id text not null check(length(key_tracking_id) between 8 and 200),
  key_fingerprint_sha256 text not null check(key_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  model text not null check(model='gpt-5-mini-2025-08-07'),
  service_tier text not null check(service_tier='default'),
  pricing_evidence_ref text not null check(length(pricing_evidence_ref) between 12 and 500),
  runtime_evidence_sha256 text not null check(runtime_evidence_sha256 ~ '^[0-9a-f]{64}$'),
  reviewer_ref text not null check(length(reviewer_ref) between 6 and 200),
  primary key(ledger_key,runtime_evidence_sha256),
  verified_at timestamptz not null default now(),
  valid_until timestamptz not null,
  check(valid_until>verified_at and valid_until<=verified_at+interval '24 hours')
);
create table private.pocket_benchmark_budget_accounts (
  ledger_key text not null,
  case_id text not null,
  reserved_microusd bigint not null check(reserved_microusd between 1 and 5000000),
  receipt_sha256 text not null check(receipt_sha256 ~ '^[0-9a-f]{64}$'),
  accounted_at timestamptz not null default now(),
  primary key(ledger_key,case_id),
  foreign key(ledger_key,case_id) references private.pocket_benchmark_pilot_cases(ledger_key,case_id)
);
alter table private.pocket_benchmark_budget_configs enable row level security;
alter table private.pocket_benchmark_budget_accounts enable row level security;
revoke all on private.pocket_benchmark_budget_configs,private.pocket_benchmark_budget_accounts from public,anon,authenticated,service_role;

create function private.block_pocket_benchmark_budget_change() returns trigger
language plpgsql security invoker set search_path=pg_catalog as $$
begin raise exception 'benchmark budget evidence is immutable'; end; $$;
create trigger pocket_budget_config_immutable before update or delete on private.pocket_benchmark_budget_configs
for each row execute function private.block_pocket_benchmark_budget_change();
create trigger pocket_budget_config_no_truncate before truncate on private.pocket_benchmark_budget_configs
for each statement execute function private.block_pocket_benchmark_budget_change();
create trigger pocket_budget_account_immutable before update or delete on private.pocket_benchmark_budget_accounts
for each row execute function private.block_pocket_benchmark_budget_change();
create trigger pocket_budget_account_no_truncate before truncate on private.pocket_benchmark_budget_accounts
for each statement execute function private.block_pocket_benchmark_budget_change();

-- Pure upper bound, NOT an actual charge. Includes the full 400k input context
-- (images/text/schema) at $0.25/M, plus each slot's complete output at $2/M.
create function private.pocket_benchmark_reserved_bound(p_slot text) returns bigint
language sql immutable security invoker set search_path=pg_catalog as $$
select case p_slot when 'main' then 114000::bigint
 when 'primary_precision' then 102800::bigint when 'rescue_precision' then 102800::bigint end $$;

create function private.assert_pocket_benchmark_budget_config(p_key text) returns void
language plpgsql security definer set search_path=pg_catalog,private as $$
declare c private.pocket_benchmark_budget_configs%rowtype; l private.pocket_benchmark_pilot_ledgers%rowtype;
begin
 select * into l from private.pocket_benchmark_pilot_ledgers where ledger_key=p_key for update;
 if not found or not l.enabled or l.config_verified_at is null then raise exception 'benchmark ledger disabled'; end if;
 select * into c from private.pocket_benchmark_budget_configs where ledger_key=p_key order by verified_at desc,runtime_evidence_sha256 desc limit 1;
 if not found or c.project_ref is distinct from l.project_ref or c.candidate_sha is distinct from l.candidate_sha
  or c.pricing_evidence_ref is distinct from l.pricing_evidence_ref or c.service_tier is distinct from l.rate_tier
  or c.verified_at>clock_timestamp() or c.valid_until<=clock_timestamp()
  then raise exception 'verified runtime and current pricing configuration required'; end if;
end; $$;

-- Immutable reservation fields prevent an administrator accidentally resetting
-- commitments. Normal app roles already have no direct table privileges.
create function private.guard_pocket_benchmark_call_reservation() returns trigger
language plpgsql security invoker set search_path=pg_catalog as $$
begin
 if TG_OP in ('DELETE','TRUNCATE') then raise exception 'benchmark call history cannot be reset'; end if;
 if row(NEW.ledger_key,NEW.case_id,NEW.slot,NEW.project_ref,NEW.model,NEW.service_tier,NEW.estimated_microusd,
        NEW.max_output_tokens,NEW.max_input_text_chars,NEW.max_schema_bytes,NEW.max_images,NEW.max_image_bytes,
        NEW.max_image_width,NEW.max_image_height,NEW.max_image_pixels,NEW.cost_bound_evidence_ref)
  is distinct from row(OLD.ledger_key,OLD.case_id,OLD.slot,OLD.project_ref,OLD.model,OLD.service_tier,OLD.estimated_microusd,
        OLD.max_output_tokens,OLD.max_input_text_chars,OLD.max_schema_bytes,OLD.max_images,OLD.max_image_bytes,
        OLD.max_image_width,OLD.max_image_height,OLD.max_image_pixels,OLD.cost_bound_evidence_ref)
  or (OLD.status<>'reserved' and NEW.status='reserved')
  or (OLD.status='voided' and NEW.status<>'voided') or (OLD.status='settled' and NEW.status<>'settled')
  or (OLD.submitted_at is not null and (NEW.status='voided' or NEW.submitted_at is distinct from OLD.submitted_at))
  or (OLD.actual_microusd is not null and NEW.actual_microusd is distinct from OLD.actual_microusd)
  or (OLD.receipt_recorded_at is not null and row(NEW.provider_request_id,NEW.provider_response_id,NEW.provider_model,
       NEW.provider_service_tier,NEW.provider_usage,NEW.receipt_recorded_at,NEW.envelope_sha256)
    is distinct from row(OLD.provider_request_id,OLD.provider_response_id,OLD.provider_model,
       OLD.provider_service_tier,OLD.provider_usage,OLD.receipt_recorded_at,OLD.envelope_sha256))
  then raise exception 'benchmark reservation and receipt history are immutable'; end if;
 return NEW;
end; $$;
create trigger pocket_call_reservation_immutable before update or delete on private.pocket_benchmark_pilot_calls
for each row execute function private.guard_pocket_benchmark_call_reservation();
create trigger pocket_call_no_truncate before truncate on private.pocket_benchmark_pilot_calls
for each statement execute function private.guard_pocket_benchmark_call_reservation();

create function private.pocket_benchmark_receipt_digest(p_key text,p_case text) returns text
language sql stable security invoker set search_path=pg_catalog as $$
select encode(extensions.digest(convert_to(coalesce(jsonb_agg(jsonb_build_object(
 'slot',slot,'request',provider_request_id,'response',provider_response_id,'model',provider_model,
 'tier',provider_service_tier,'usage',provider_usage,'envelope',envelope_sha256,
 'submitted',submitted_at,'voided',voided_at) order by slot)::text,''),'utf8'),'sha256'),'hex')
from private.pocket_benchmark_pilot_calls where ledger_key=p_key and case_id=p_case $$;

create function private.account_pocket_benchmark_reserved_case(p_ledger_key text,p_case_id text) returns jsonb
language plpgsql security definer set search_path=pg_catalog,private as $$
declare v_count integer; v_primary integer; v_bad integer; v_reserved bigint; v_total bigint; v_cap bigint; v_digest text;
begin
 perform private.assert_pocket_benchmark_budget_config(p_ledger_key);
 select cap_microusd into v_cap from private.pocket_benchmark_pilot_ledgers where ledger_key=p_ledger_key for update;
 select count(*),count(*) filter(where slot in ('main','primary_precision') and receipt_recorded_at is not null),
  count(*) filter(where status='reserved' or (status<>'voided' and (status not in ('submitted','settled')
   or receipt_recorded_at is null or provider_request_id is null or provider_response_id is null
   or provider_model is distinct from model or provider_service_tier is distinct from service_tier
   or provider_usage is null or (provider_usage->>'input_tokens')::numeric>400000
   or (provider_usage->>'output_tokens')::numeric>max_output_tokens
   or (provider_usage->>'total_tokens')::numeric>400000))),
  coalesce(sum(estimated_microusd) filter(where status<>'voided'),0)
 into v_count,v_primary,v_bad,v_reserved from private.pocket_benchmark_pilot_calls where ledger_key=p_ledger_key and case_id=p_case_id;
 if v_count<>3 or v_primary<>2 or v_bad<>0 then raise exception 'complete bounded receipts required; unknown charges retain reserves'; end if;
 select coalesce(sum(greatest(estimated_microusd,coalesce(actual_microusd,estimated_microusd))),0)
 into v_total from private.pocket_benchmark_pilot_calls where ledger_key=p_ledger_key and status in ('reserved','submitted','settled');
 if v_total>v_cap then raise exception 'aggregate reserved cap exceeded'; end if;
 v_digest:=private.pocket_benchmark_receipt_digest(p_ledger_key,p_case_id);
 insert into private.pocket_benchmark_budget_accounts(ledger_key,case_id,reserved_microusd,receipt_sha256)
 values(p_ledger_key,p_case_id,v_reserved,v_digest) on conflict do nothing;
 if not exists(select 1 from private.pocket_benchmark_budget_accounts where ledger_key=p_ledger_key and case_id=p_case_id
  and reserved_microusd=v_reserved and receipt_sha256=v_digest) then raise exception 'budget accounting conflict'; end if;
 return jsonb_build_object('accounted',true,'accounting_status','FULL_RESERVATION_HELD','financially_settled',false,
  'actual_microusd',null,'reserved_microusd',v_reserved,'committed_microusd',v_total);
end; $$;

create function private.read_pocket_benchmark_reserved_measurement(p_ledger_key text,p_case_id text) returns jsonb
language plpgsql security definer set search_path=pg_catalog,private as $$
declare m jsonb; h text; a private.pocket_benchmark_budget_accounts%rowtype; v_total bigint; v_cap bigint;
begin
 perform private.assert_pocket_benchmark_budget_config(p_ledger_key);
 select * into a from private.pocket_benchmark_budget_accounts where ledger_key=p_ledger_key and case_id=p_case_id;
 if not found or a.receipt_sha256 is distinct from private.pocket_benchmark_receipt_digest(p_ledger_key,p_case_id)
  then raise exception 'reserved accounting and unchanged receipts required'; end if;
 select cap_microusd into v_cap from private.pocket_benchmark_pilot_ledgers where ledger_key=p_ledger_key;
 select coalesce(sum(greatest(estimated_microusd,coalesce(actual_microusd,estimated_microusd))),0)
 into v_total from private.pocket_benchmark_pilot_calls where ledger_key=p_ledger_key and status in ('reserved','submitted','settled');
 if v_total>v_cap then raise exception 'aggregate reserved cap exceeded'; end if;
 select measurement,measurement_sha256 into m,h from private.pocket_benchmark_pilot_cases where ledger_key=p_ledger_key and case_id=p_case_id;
 return jsonb_build_object('available',m is not null and h is not null,'measurement',m,'measurement_sha256',h,
  'accounting_status','FULL_RESERVATION_HELD','financially_settled',false,'actual_microusd',null,
  'reserved_microusd',a.reserved_microusd,'committed_microusd',v_total);
end; $$;

create function private.assert_pocket_benchmark_runtime_binding(p_ledger_key text,p_evidence jsonb) returns jsonb
language plpgsql security definer set search_path=pg_catalog,private as $$
declare c private.pocket_benchmark_budget_configs%rowtype;
begin
 perform private.assert_pocket_benchmark_budget_config(p_ledger_key);
 select * into c from private.pocket_benchmark_budget_configs where ledger_key=p_ledger_key order by verified_at desc,runtime_evidence_sha256 desc limit 1;
 if p_evidence is null or jsonb_typeof(p_evidence)<>'object'
  or nullif(p_evidence->>'verifiedAt','') is null
  or p_evidence->>'organisationId' is distinct from 'org-5vLRRzXwcigUx96TVE0rI3RW'
  or p_evidence->>'projectId' is distinct from c.project_ref
  or p_evidence->>'candidateSha' is distinct from c.candidate_sha
  or p_evidence->>'keyTrackingId' is distinct from c.key_tracking_id
  or p_evidence->>'keyFingerprintSha256' is distinct from c.key_fingerprint_sha256
  or p_evidence->>'backendProjectRef' is distinct from c.staging_ref
  or p_evidence->>'model' is distinct from c.model
  or p_evidence->>'keyTrackingVerification' is distinct from 'UNIQUE_REDACTED_METADATA_AND_PROJECT_AUTHORIZATION'
  or (p_evidence->>'verifiedAt')::timestamptz<clock_timestamp()-interval '5 minutes'
  or (p_evidence->>'verifiedAt')::timestamptz>clock_timestamp()
  then raise exception 'runtime binding does not match independently reviewed configuration'; end if;
 return jsonb_build_object('binding_matches',true,'financially_settled',false);
end; $$;

create function public.account_pocket_benchmark_reserved_case(p_ledger_key text,p_case_id text) returns jsonb
language sql security invoker set search_path=pg_catalog as $$select private.account_pocket_benchmark_reserved_case(p_ledger_key,p_case_id)$$;
create function public.read_pocket_benchmark_reserved_measurement(p_ledger_key text,p_case_id text) returns jsonb
language sql security invoker set search_path=pg_catalog as $$select private.read_pocket_benchmark_reserved_measurement(p_ledger_key,p_case_id)$$;
create function public.assert_pocket_benchmark_runtime_binding(p_ledger_key text,p_evidence jsonb) returns jsonb
language sql security invoker set search_path=pg_catalog as $$select private.assert_pocket_benchmark_runtime_binding(p_ledger_key,p_evidence)$$;
revoke all on function private.block_pocket_benchmark_budget_change(),private.guard_pocket_benchmark_call_reservation(),
 private.pocket_benchmark_reserved_bound(text),private.pocket_benchmark_receipt_digest(text,text),private.assert_pocket_benchmark_budget_config(text),
 private.account_pocket_benchmark_reserved_case(text,text),private.read_pocket_benchmark_reserved_measurement(text,text),
 private.assert_pocket_benchmark_runtime_binding(text,jsonb),public.account_pocket_benchmark_reserved_case(text,text),
 public.read_pocket_benchmark_reserved_measurement(text,text),public.assert_pocket_benchmark_runtime_binding(text,jsonb)
 from public,anon,authenticated,service_role;
grant execute on function private.account_pocket_benchmark_reserved_case(text,text),private.read_pocket_benchmark_reserved_measurement(text,text),
 private.assert_pocket_benchmark_runtime_binding(text,jsonb),public.account_pocket_benchmark_reserved_case(text,text),
 public.read_pocket_benchmark_reserved_measurement(text,text),public.assert_pocket_benchmark_runtime_binding(text,jsonb) to service_role;

create or replace function private.submit_pocket_benchmark_call(p_ledger_key text,p_case_id text,p_slot text,p_envelope_sha256 text)
returns jsonb language plpgsql security definer set search_path=pg_catalog,private as $$
declare v_call private.pocket_benchmark_pilot_calls%rowtype;
begin
  perform private.assert_pocket_benchmark_budget_config(p_ledger_key);
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

create or replace function private.claim_pocket_benchmark_case(
  p_ledger_key text, p_case_id text, p_project_ref text, p_owner_approval_ref text,
  p_candidate_sha text, p_plan jsonb
) returns jsonb language plpgsql security definer set search_path=pg_catalog,private as $$
declare
  v_ledger private.pocket_benchmark_pilot_ledgers%rowtype;
  v_call jsonb;
  v_model text;
  v_total bigint;
  v_committed bigint;
begin
  perform private.assert_pocket_benchmark_budget_config(p_ledger_key);
  select model into v_model from private.pocket_benchmark_budget_configs where ledger_key=p_ledger_key order by verified_at desc,runtime_evidence_sha256 desc limit 1;
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
  if exists(select 1 from private.pocket_benchmark_pilot_calls where ledger_key=p_ledger_key and status in ('reserved','submitted')
    and not exists(select 1 from private.pocket_benchmark_budget_accounts a where a.ledger_key=p_ledger_key
      and a.case_id=private.pocket_benchmark_pilot_calls.case_id
      and a.receipt_sha256=private.pocket_benchmark_receipt_digest(p_ledger_key,a.case_id))) then
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
  if exists(select 1 from jsonb_array_elements(p_plan) x(value) where
    (value->>'model') is distinct from v_model or (value->>'serviceTier') is distinct from 'default'
    or (value->>'maxOutputTokens')::int is distinct from case when value->>'slot'='main' then 7000 else 1400 end
    or (value->>'maxCostMicroUsd')::bigint < private.pocket_benchmark_reserved_bound(value->>'slot'))
    then raise exception 'pinned model and complete worst-case reservation required'; end if;
  select sum((value->>'maxCostMicroUsd')::bigint) into v_total from jsonb_array_elements(p_plan);
  select coalesce(sum(greatest(estimated_microusd,coalesce(actual_microusd,estimated_microusd))),0) into v_committed
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
