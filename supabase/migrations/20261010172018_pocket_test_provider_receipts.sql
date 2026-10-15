-- Receipts link pending reservations to provider requests without guessing
-- settled dollar cost from usage. Only authoritative billing may settle.
alter table private.pocket_test_spend_reservations
  add column provider_response_id text,
  add column provider_model text,
  add column provider_usage jsonb,
  add column receipt_recorded_at timestamptz;

create or replace function private.record_pocket_test_spend_receipt(
  p_ledger_key text, p_request_key text, p_provider_request_id text,
  p_response_id text, p_model text, p_usage jsonb
) returns jsonb language plpgsql security definer set search_path = pg_catalog, private as $$
declare v_row private.pocket_test_spend_reservations%rowtype;
begin
  if nullif(trim(p_provider_request_id), '') is null
      or nullif(trim(p_response_id), '') is null or nullif(trim(p_model), '') is null
      or length(p_provider_request_id) > 200 or length(p_response_id) > 200 or length(p_model) > 200
      or pg_column_size(p_usage) > 16384 then raise exception 'invalid receipt'; end if;
  perform 1 from private.pocket_test_spend_ledgers where ledger_key=p_ledger_key for update;
  select * into v_row from private.pocket_test_spend_reservations
    where ledger_key=p_ledger_key and request_key=p_request_key for update;
  if not found or v_row.status <> 'submitted' then raise exception 'submitted reservation required'; end if;
  if v_row.receipt_recorded_at is not null then
    if v_row.provider_request_id is distinct from p_provider_request_id
      or v_row.provider_response_id is distinct from p_response_id
      or v_row.provider_model is distinct from p_model
      or v_row.provider_usage is distinct from p_usage then raise exception 'receipt conflict'; end if;
  else
    update private.pocket_test_spend_reservations set provider_request_id=p_provider_request_id,
      provider_response_id=p_response_id, provider_model=p_model, provider_usage=p_usage,
      receipt_recorded_at=now() where reservation_id=v_row.reservation_id;
  end if;
  return jsonb_build_object('ok',true,'status','submitted','reservation_id',v_row.reservation_id);
end;
$$;

revoke all on function private.record_pocket_test_spend_receipt(text,text,text,text,text,jsonb) from public,anon,authenticated,service_role;
grant execute on function private.record_pocket_test_spend_receipt(text,text,text,text,text,jsonb) to service_role;
create or replace function public.record_pocket_test_spend_receipt(
  p_ledger_key text, p_request_key text, p_provider_request_id text,
  p_response_id text, p_model text, p_usage jsonb
) returns jsonb language sql security invoker set search_path = pg_catalog as $$
  select private.record_pocket_test_spend_receipt(p_ledger_key,p_request_key,p_provider_request_id,p_response_id,p_model,p_usage);
$$;
revoke all on function public.record_pocket_test_spend_receipt(text,text,text,text,text,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.record_pocket_test_spend_receipt(text,text,text,text,text,jsonb) to service_role;

create or replace function private.keep_pocket_provider_receipt_identity()
returns trigger language plpgsql security invoker set search_path=pg_catalog as $$
begin
  if old.receipt_recorded_at is not null and (
    new.provider_request_id is distinct from old.provider_request_id
    or new.provider_response_id is distinct from old.provider_response_id
    or new.provider_model is distinct from old.provider_model
    or new.provider_usage is distinct from old.provider_usage
    or new.receipt_recorded_at is distinct from old.receipt_recorded_at
  ) then raise exception 'recorded provider receipt is immutable'; end if;
  return new;
end;
$$;
revoke all on function private.keep_pocket_provider_receipt_identity() from public,anon,authenticated,service_role;
create trigger keep_pocket_provider_receipt_identity before update
on private.pocket_test_spend_reservations for each row
execute function private.keep_pocket_provider_receipt_identity();
