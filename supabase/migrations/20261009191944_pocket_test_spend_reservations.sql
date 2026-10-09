-- Durable, project-bound accounting for the owner's cumulative Pocket
-- Bullseye scanner-test allowance. This migration deliberately creates no
-- ledger row: an operator must first reconcile historical spend, bind the
-- OpenAI project and record a separate owner approval. Until then every RPC
-- fails closed and the application-level spending hold remains in place.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table private.pocket_test_spend_ledgers (
  ledger_key text primary key,
  project_ref text not null,
  cap_microusd bigint not null check (cap_microusd > 0 and cap_microusd <= 2000000),
  historical_spend_microusd bigint check (historical_spend_microusd >= 0),
  historical_attribution_complete boolean not null default false,
  owner_approval_ref text,
  owner_approved_at timestamptz,
  enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (not enabled or (
    historical_attribution_complete
    and historical_spend_microusd is not null
    and owner_approval_ref is not null
    and owner_approved_at is not null
  ))
);

create table private.pocket_test_spend_reservations (
  reservation_id uuid primary key default gen_random_uuid(),
  ledger_key text not null references private.pocket_test_spend_ledgers(ledger_key),
  request_key text not null,
  project_ref text not null,
  owner_approval_ref text not null,
  estimated_microusd bigint not null check (estimated_microusd > 0 and estimated_microusd <= 2000000),
  actual_microusd bigint check (actual_microusd >= 0),
  status text not null check (status in ('reserved', 'submitted', 'settled', 'voided')),
  provider_request_id text,
  void_reason text,
  created_at timestamptz not null default now(),
  submitted_at timestamptz,
  settled_at timestamptz,
  voided_at timestamptz,
  unique (ledger_key, request_key),
  check ((status = 'settled') = (actual_microusd is not null)),
  check ((status = 'voided') = (voided_at is not null)),
  check (status <> 'submitted' or submitted_at is not null)
);

alter table private.pocket_test_spend_ledgers enable row level security;
alter table private.pocket_test_spend_reservations enable row level security;
revoke all on table private.pocket_test_spend_ledgers from public, anon, authenticated, service_role;
revoke all on table private.pocket_test_spend_reservations from public, anon, authenticated, service_role;

create or replace function public.reserve_pocket_test_spend(
  p_ledger_key text,
  p_request_key text,
  p_project_ref text,
  p_owner_approval_ref text,
  p_estimated_microusd bigint
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, private
as $$
declare
  v_ledger private.pocket_test_spend_ledgers%rowtype;
  v_existing private.pocket_test_spend_reservations%rowtype;
  v_committed bigint;
  v_id uuid;
begin
  if p_estimated_microusd is null or p_estimated_microusd <= 0 or p_estimated_microusd > 2000000 then
    raise exception 'invalid estimated spend';
  end if;

  select * into v_ledger
    from private.pocket_test_spend_ledgers
    where ledger_key = p_ledger_key
    for update;

  if not found then
    return jsonb_build_object('allowed', false, 'reason', 'ledger_not_configured');
  end if;
  if not v_ledger.enabled or not v_ledger.historical_attribution_complete
      or v_ledger.historical_spend_microusd is null
      or v_ledger.owner_approved_at is null or v_ledger.owner_approval_ref is null then
    return jsonb_build_object('allowed', false, 'reason', 'ledger_not_approved');
  end if;
  if v_ledger.project_ref <> p_project_ref or v_ledger.owner_approval_ref <> p_owner_approval_ref then
    return jsonb_build_object('allowed', false, 'reason', 'scope_mismatch');
  end if;

  select * into v_existing
    from private.pocket_test_spend_reservations
    where ledger_key = p_ledger_key and request_key = p_request_key;
  if found then
    if v_existing.project_ref <> p_project_ref
        or v_existing.owner_approval_ref <> p_owner_approval_ref
        or v_existing.estimated_microusd <> p_estimated_microusd
        or v_existing.status = 'voided' then
      raise exception 'reservation key conflict';
    end if;
    select v_ledger.historical_spend_microusd + coalesce(sum(
      case when status = 'settled' then actual_microusd else estimated_microusd end
    ), 0) into v_committed
      from private.pocket_test_spend_reservations
      where ledger_key = p_ledger_key and status in ('reserved', 'submitted', 'settled');
    return jsonb_build_object(
      'allowed', true, 'reservation_id', v_existing.reservation_id,
      'status', v_existing.status, 'committed_microusd', v_committed,
      'remaining_microusd', greatest(0, v_ledger.cap_microusd - v_committed),
      'idempotent', true
    );
  end if;

  select v_ledger.historical_spend_microusd + coalesce(sum(
    case when status = 'settled' then actual_microusd else estimated_microusd end
  ), 0) into v_committed
    from private.pocket_test_spend_reservations
    where ledger_key = p_ledger_key and status in ('reserved', 'submitted', 'settled');

  if v_committed + p_estimated_microusd > v_ledger.cap_microusd then
    return jsonb_build_object(
      'allowed', false, 'reason', 'cumulative_cap_exceeded',
      'committed_microusd', v_committed,
      'remaining_microusd', greatest(0, v_ledger.cap_microusd - v_committed)
    );
  end if;

  insert into private.pocket_test_spend_reservations (
    ledger_key, request_key, project_ref, owner_approval_ref, estimated_microusd, status
  ) values (
    p_ledger_key, p_request_key, p_project_ref, p_owner_approval_ref, p_estimated_microusd, 'reserved'
  ) returning reservation_id into v_id;
  v_committed := v_committed + p_estimated_microusd;
  return jsonb_build_object(
    'allowed', true, 'reservation_id', v_id, 'status', 'reserved',
    'committed_microusd', v_committed,
    'remaining_microusd', greatest(0, v_ledger.cap_microusd - v_committed),
    'idempotent', false
  );
end;
$$;

create or replace function public.submit_pocket_test_spend(p_ledger_key text, p_request_key text)
returns jsonb language plpgsql security definer set search_path = pg_catalog, private as $$
declare
  v_row private.pocket_test_spend_reservations%rowtype;
  v_claimed boolean := false;
begin
  perform 1 from private.pocket_test_spend_ledgers where ledger_key = p_ledger_key for update;
  select * into v_row from private.pocket_test_spend_reservations
    where ledger_key = p_ledger_key and request_key = p_request_key for update;
  if not found then raise exception 'reservation not found'; end if;
  if v_row.status = 'reserved' then
    update private.pocket_test_spend_reservations set status = 'submitted', submitted_at = now()
      where reservation_id = v_row.reservation_id returning * into v_row;
    v_claimed := true;
  elsif v_row.status <> 'submitted' then
    raise exception 'only a reserved request may be submitted';
  end if;
  return jsonb_build_object(
    'ok', true, 'reservation_id', v_row.reservation_id,
    'status', v_row.status, 'claimed', v_claimed
  );
end;
$$;

create or replace function public.settle_pocket_test_spend(
  p_ledger_key text,
  p_request_key text,
  p_actual_microusd bigint,
  p_provider_request_id text
) returns jsonb language plpgsql security definer set search_path = pg_catalog, private as $$
declare
  v_row private.pocket_test_spend_reservations%rowtype;
  v_ledger private.pocket_test_spend_ledgers%rowtype;
  v_committed bigint;
begin
  if p_actual_microusd is null or p_actual_microusd < 0 or p_actual_microusd > 2000000
      or nullif(trim(p_provider_request_id), '') is null then raise exception 'invalid settlement'; end if;
  select * into v_ledger from private.pocket_test_spend_ledgers
    where ledger_key = p_ledger_key for update;
  if not found then raise exception 'ledger not found'; end if;
  select * into v_row from private.pocket_test_spend_reservations
    where ledger_key = p_ledger_key and request_key = p_request_key for update;
  if not found then raise exception 'reservation not found'; end if;
  if v_row.status = 'settled' then
    if v_row.actual_microusd <> p_actual_microusd or v_row.provider_request_id <> p_provider_request_id then
      raise exception 'settlement conflict';
    end if;
  elsif v_row.status = 'submitted' then
    update private.pocket_test_spend_reservations
      set status = 'settled', actual_microusd = p_actual_microusd,
          provider_request_id = p_provider_request_id, settled_at = now()
      where reservation_id = v_row.reservation_id returning * into v_row;
  else
    raise exception 'only submitted spend may be settled';
  end if;
  select v_ledger.historical_spend_microusd + coalesce(sum(
    case when status = 'settled' then actual_microusd else estimated_microusd end
  ), 0) into v_committed from private.pocket_test_spend_reservations
    where ledger_key = p_ledger_key and status in ('reserved', 'submitted', 'settled');
  return jsonb_build_object(
    'ok', true, 'reservation_id', v_row.reservation_id, 'status', v_row.status,
    'actual_microusd', v_row.actual_microusd, 'committed_microusd', v_committed,
    'cap_exceeded', v_committed > v_ledger.cap_microusd
  );
end;
$$;

create or replace function public.void_pocket_test_spend(
  p_ledger_key text,
  p_request_key text,
  p_reason text
) returns jsonb language plpgsql security definer set search_path = pg_catalog, private as $$
declare v_row private.pocket_test_spend_reservations%rowtype;
begin
  perform 1 from private.pocket_test_spend_ledgers where ledger_key = p_ledger_key for update;
  select * into v_row from private.pocket_test_spend_reservations
    where ledger_key = p_ledger_key and request_key = p_request_key for update;
  if not found then raise exception 'reservation not found'; end if;
  if v_row.status = 'reserved' then
    update private.pocket_test_spend_reservations
      set status = 'voided', void_reason = left(nullif(trim(p_reason), ''), 500), voided_at = now()
      where reservation_id = v_row.reservation_id returning * into v_row;
  elsif v_row.status <> 'voided' then
    raise exception 'submitted or settled spend cannot be voided';
  end if;
  return jsonb_build_object('ok', true, 'reservation_id', v_row.reservation_id, 'status', v_row.status);
end;
$$;

revoke all on function public.reserve_pocket_test_spend(text, text, text, text, bigint) from public, anon, authenticated, service_role;
grant execute on function public.reserve_pocket_test_spend(text, text, text, text, bigint) to service_role;
revoke all on function public.submit_pocket_test_spend(text, text) from public, anon, authenticated, service_role;
grant execute on function public.submit_pocket_test_spend(text, text) to service_role;
revoke all on function public.settle_pocket_test_spend(text, text, bigint, text) from public, anon, authenticated, service_role;
grant execute on function public.settle_pocket_test_spend(text, text, bigint, text) to service_role;
revoke all on function public.void_pocket_test_spend(text, text, text) from public, anon, authenticated, service_role;
grant execute on function public.void_pocket_test_spend(text, text, text) to service_role;
