-- UNINSTALLED PROPOSAL. Not in migrations/. No hosted execution is authorised.
-- Requires existing identity/subscription schema and an independently governed
-- NOLOGIN pocket_checkout_verifier role. This file creates no login/membership.
begin;
set local lock_timeout='2s';
set local statement_timeout='30s';
do $$ begin
  if not exists(select 1 from pg_roles where rolname='pocket_checkout_verifier' and not rolcanlogin)
    then raise exception 'checkout_verifier_authority_unavailable'; end if;
  if pg_has_role('service_role','pocket_checkout_verifier','MEMBER')
    or pg_has_role('authenticated','pocket_checkout_verifier','MEMBER')
    or pg_has_role('anon','pocket_checkout_verifier','MEMBER')
    then raise exception 'checkout_verifier_authority_not_isolated'; end if;
  if exists(select 1 from pg_auth_members m join pg_roles r on r.oid=m.roleid where r.rolname='pocket_checkout_verifier')
    then raise exception 'checkout_verifier_authority_already_assigned'; end if;
end $$;

create table private.pocket_checkout_intents (
  intent_id uuid primary key default gen_random_uuid(),
  app_user_id uuid not null unique,
  stripe_customer_id text not null check(stripe_customer_id ~ '^cus_[A-Za-z0-9]+$'),
  stripe_account_id text not null check(stripe_account_id ~ '^acct_[A-Za-z0-9]+$'),
  livemode boolean not null,
  verified_email text not null check(length(verified_email) between 3 and 254),
  offer text not null check(offer='pocket_founding_650'),
  price_id text not null check(price_id ~ '^price_[A-Za-z0-9]+$'),
  candidate_sha text not null check(candidate_sha ~ '^[a-f0-9]{40}$'),
  seed jsonb not null check(jsonb_typeof(seed)='object' and octet_length(seed::text)<=12000),
  state text not null default 'BASELINE_REQUIRED' check(state in('BASELINE_REQUIRED','PREPARED','DISPATCHED','READY')),
  parameters_text text,
  parameters_sha256 text,
  expires_at bigint,
  dispatch_token uuid,
  dispatched_at timestamptz,
  dispatch_count integer not null default 0 check(dispatch_count in(0,1)),
  stripe_session_id text unique,
  session_projection jsonb,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  foreign key(app_user_id,stripe_customer_id) references private.pocket_web_identities(app_user_id,stripe_customer_id),
  check((parameters_text is null)=(parameters_sha256 is null)),
  check(parameters_sha256 is null or parameters_sha256=encode(sha256(convert_to(parameters_text,'UTF8')),'hex')),
  check((dispatch_token is null)=(dispatched_at is null)),
  check((dispatch_count=0)=(dispatch_token is null)),
  check((stripe_session_id is null)=(session_projection is null))
);
create table private.pocket_checkout_baselines (
  intent_id uuid primary key references private.pocket_checkout_intents(intent_id),
  receipt_sha256 text not null unique check(receipt_sha256 ~ '^[a-f0-9]{64}$'),
  fence_receipt_sha256 text not null check(fence_receipt_sha256 ~ '^[a-f0-9]{64}$'),
  fenced_at timestamptz not null,
  inventory_started_at timestamptz not null,
  inventory_completed_at timestamptz not null,
  attested_at timestamptz not null default clock_timestamp(),
  check(fenced_at<=inventory_started_at and inventory_started_at<=inventory_completed_at)
);
alter table private.pocket_checkout_intents enable row level security;
alter table private.pocket_checkout_baselines enable row level security;
revoke all on private.pocket_checkout_intents,private.pocket_checkout_baselines from public,anon,authenticated,service_role,pocket_checkout_verifier;

create function private.pocket_checkout_identity_ok(p_user_id uuid,p_email text,p_customer_id text)
returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from auth.users u join private.pocket_web_identities i on i.app_user_id=u.id
    where u.id=p_user_id and i.stripe_customer_id=p_customer_id and u.email_confirmed_at is not null
      and not coalesce(u.is_anonymous,false) and (u.banned_until is null or u.banned_until<=now())
      and lower(trim(u.email))=p_email)
$$;
create function private.pocket_checkout_packet(p_row private.pocket_checkout_intents,p_kind text)
returns jsonb language sql immutable set search_path='' as $$
  select jsonb_build_object('kind',p_kind,'intent_id',p_row.intent_id,'user_id',p_row.app_user_id,
    'customer_id',p_row.stripe_customer_id,'stripe_account_id',p_row.stripe_account_id,'livemode',p_row.livemode,
    'offer',p_row.offer,'price_id',p_row.price_id,'candidate_sha',p_row.candidate_sha,
    'idempotency_key','pocket-checkout:'||p_row.intent_id::text,
    'parameters_text',p_row.parameters_text,'parameters_sha256',p_row.parameters_sha256,
    'session',p_row.session_projection)
$$;
revoke all on function private.pocket_checkout_identity_ok(uuid,text,text),private.pocket_checkout_packet(private.pocket_checkout_intents,text) from public,anon,authenticated,service_role,pocket_checkout_verifier;

create function private.prepare_pocket_checkout_intent(
  p_user_id uuid,p_email text,p_customer_id text,p_price_id text,p_candidate_sha text,
  p_stripe_account_id text,p_livemode boolean,p_offer text,p_seed jsonb
) returns jsonb language plpgsql security definer set search_path='' as $$
declare r private.pocket_checkout_intents%rowtype;
begin
  if p_user_id is null or p_email is null or p_email<>lower(trim(p_email)) or p_customer_id !~ '^cus_[A-Za-z0-9]+$'
    or p_price_id !~ '^price_[A-Za-z0-9]+$' or p_candidate_sha !~ '^[a-f0-9]{40}$'
    or p_stripe_account_id !~ '^acct_[A-Za-z0-9]+$' or p_livemode is null or p_offer is distinct from 'pocket_founding_650'
    or not private.pocket_checkout_identity_ok(p_user_id,p_email,p_customer_id) then
    return jsonb_build_object('kind','HOLD','reason','VERIFIED_BOUND_IDENTITY_REQUIRED'); end if;
  if p_seed is null or jsonb_typeof(p_seed)<>'object' or octet_length(p_seed::text)>12000
    or p_seed->>'mode' is distinct from 'subscription' or p_seed->>'customer' is distinct from p_customer_id
    or p_seed->>'client_reference_id' is distinct from p_user_id::text
    or p_seed->'line_items' is distinct from jsonb_build_array(jsonb_build_object('price',p_price_id,'quantity',1))
    or p_seed->'metadata'->>'supabase_user_id' is distinct from p_user_id::text
    or p_seed->'metadata'->>'offering' is distinct from p_offer
    or p_seed->'subscription_data'->'metadata' is distinct from p_seed->'metadata'
    or p_seed ? 'expires_at' or p_seed ? 'customer_email'
    or p_seed->'metadata' ?| array['pocket_checkout_intent_id','pocket_candidate_sha']
    then raise exception 'checkout_seed_contract_invalid'; end if;
  perform pg_advisory_xact_lock(hashtextextended('pocket-checkout:'||p_user_id::text,0));
  if private.has_pocket_web_subscription(p_user_id) then return jsonb_build_object('kind','HOLD','reason','ACTIVE_SUBSCRIPTION'); end if;
  insert into private.pocket_checkout_intents(app_user_id,verified_email,stripe_customer_id,stripe_account_id,livemode,offer,price_id,candidate_sha,seed)
  values(p_user_id,p_email,p_customer_id,p_stripe_account_id,p_livemode,p_offer,p_price_id,p_candidate_sha,p_seed)
  on conflict(app_user_id) do nothing;
  select * into strict r from private.pocket_checkout_intents where app_user_id=p_user_id for update;
  if r.verified_email<>p_email or r.stripe_customer_id<>p_customer_id or r.stripe_account_id<>p_stripe_account_id
    or r.livemode<>p_livemode or r.offer<>p_offer or r.price_id<>p_price_id or r.candidate_sha<>p_candidate_sha or r.seed<>p_seed
    then return jsonb_build_object('kind','HOLD','reason','IMMUTABLE_SCOPE_CONFLICT'); end if;
  if r.state='BASELINE_REQUIRED' then return jsonb_build_object('kind','HOLD','reason','BASELINE_REQUIRED','intent_id',r.intent_id); end if;
  if r.state='DISPATCHED' then return jsonb_build_object('kind','HOLD','reason','DISPATCH_UNRESOLVED','intent_id',r.intent_id); end if;
  if r.state='READY' then
    if r.expires_at<=extract(epoch from clock_timestamp()) then return jsonb_build_object('kind','HOLD','reason','SESSION_RECONCILIATION_REQUIRED','intent_id',r.intent_id); end if;
    return private.pocket_checkout_packet(r,'READY');
  end if;
  return private.pocket_checkout_packet(r,'PREPARED');
end $$;

-- This authority is distinct from the runtime service role. It attests evidence
-- produced elsewhere; there is deliberately no provider-issuer implementation.
create function private.attest_pocket_checkout_baseline(
  p_intent_id uuid,p_user_id uuid,p_customer_id text,p_stripe_account_id text,p_livemode boolean,p_candidate_sha text,
  p_receipt_sha256 text,p_fence_receipt_sha256 text,p_fenced_at timestamptz,
  p_inventory_started_at timestamptz,p_inventory_completed_at timestamptz,
  p_all_pages_verified boolean,p_open_checkout_count integer,p_active_or_pending_subscription_count integer
) returns void language plpgsql security definer set search_path='' as $$
declare r private.pocket_checkout_intents%rowtype; params jsonb; expiry bigint;
begin
  if p_user_id is null then raise exception 'checkout_baseline_scope_invalid'; end if;
  perform pg_advisory_xact_lock(hashtextextended('pocket-checkout:'||p_user_id::text,0));
  select * into strict r from private.pocket_checkout_intents where intent_id=p_intent_id and app_user_id=p_user_id for update;
  if r.state<>'BASELINE_REQUIRED' or r.stripe_customer_id is distinct from p_customer_id
    or r.stripe_account_id is distinct from p_stripe_account_id or r.livemode is distinct from p_livemode
    or r.candidate_sha is distinct from p_candidate_sha or not private.pocket_checkout_identity_ok(p_user_id,r.verified_email,p_customer_id)
    or private.has_pocket_web_subscription(p_user_id) then raise exception 'checkout_baseline_scope_invalid'; end if;
  if coalesce(p_receipt_sha256,'') !~ '^[a-f0-9]{64}$' or coalesce(p_fence_receipt_sha256,'') !~ '^[a-f0-9]{64}$'
    or p_all_pages_verified is distinct from true or p_open_checkout_count is distinct from 0
    or p_active_or_pending_subscription_count is distinct from 0 or p_fenced_at is null
    or p_inventory_started_at is null or p_inventory_completed_at is null
    or p_fenced_at>p_inventory_started_at or p_inventory_started_at>p_inventory_completed_at
    or p_inventory_completed_at>clock_timestamp() or p_inventory_started_at<clock_timestamp()-interval '60 seconds'
    then raise exception 'checkout_baseline_proof_invalid'; end if;
  insert into private.pocket_checkout_baselines(intent_id,receipt_sha256,fence_receipt_sha256,fenced_at,inventory_started_at,inventory_completed_at)
    values(p_intent_id,p_receipt_sha256,p_fence_receipt_sha256,p_fenced_at,p_inventory_started_at,p_inventory_completed_at);
  expiry:=floor(extract(epoch from clock_timestamp()+interval '45 minutes'));
  params:=r.seed||jsonb_build_object('expires_at',expiry,'metadata',r.seed->'metadata'||jsonb_build_object('pocket_checkout_intent_id',r.intent_id,'pocket_candidate_sha',r.candidate_sha),
    'subscription_data',jsonb_build_object('metadata',r.seed->'subscription_data'->'metadata'||jsonb_build_object('pocket_checkout_intent_id',r.intent_id,'pocket_candidate_sha',r.candidate_sha)));
  update private.pocket_checkout_intents set state='PREPARED',parameters_text=params::text,
    parameters_sha256=encode(sha256(convert_to(params::text,'UTF8')),'hex'),expires_at=expiry,updated_at=clock_timestamp() where intent_id=r.intent_id;
end $$;

create function private.claim_pocket_checkout_intent(p_user_id uuid,p_intent_id uuid,p_parameters_sha256 text,p_customer_id text,p_candidate_sha text,p_stripe_account_id text,p_livemode boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r private.pocket_checkout_intents%rowtype;
begin
  if p_user_id is null then return jsonb_build_object('kind','HOLD','reason','SCOPE_REQUIRED'); end if;
  perform pg_advisory_xact_lock(hashtextextended('pocket-checkout:'||p_user_id::text,0));
  select * into r from private.pocket_checkout_intents where app_user_id=p_user_id and intent_id=p_intent_id for update;
  if not found or r.stripe_customer_id is distinct from p_customer_id or r.candidate_sha is distinct from p_candidate_sha
    or r.stripe_account_id is distinct from p_stripe_account_id or r.livemode is distinct from p_livemode
    or r.parameters_sha256 is distinct from p_parameters_sha256 or not private.pocket_checkout_identity_ok(p_user_id,r.verified_email,p_customer_id)
    then return jsonb_build_object('kind','HOLD','reason','SCOPE_OR_IDENTITY_MISMATCH'); end if;
  if r.state<>'PREPARED' or r.dispatch_count<>0 then return jsonb_build_object('kind','HOLD','reason','DISPATCH_UNRESOLVED'); end if;
  if private.has_pocket_web_subscription(p_user_id) then return jsonb_build_object('kind','HOLD','reason','ACTIVE_SUBSCRIPTION'); end if;
  if r.expires_at<extract(epoch from clock_timestamp()+interval '30 minutes') or not exists(
    select 1 from private.pocket_checkout_baselines b where b.intent_id=r.intent_id and b.inventory_started_at>=clock_timestamp()-interval '60 seconds'
  ) then return jsonb_build_object('kind','HOLD','reason','BASELINE_OR_PARAMETERS_STALE'); end if;
  update private.pocket_checkout_intents set state='DISPATCHED',dispatch_token=gen_random_uuid(),dispatched_at=clock_timestamp(),dispatch_count=1,updated_at=clock_timestamp()
    where intent_id=r.intent_id returning * into r;
  return private.pocket_checkout_packet(r,'DISPATCH')||jsonb_build_object('dispatch_token',r.dispatch_token,'dispatch_count',r.dispatch_count);
end $$;

create function private.record_pocket_checkout_session(p_user_id uuid,p_intent_id uuid,p_dispatch_token uuid,p_parameters_sha256 text,p_session jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r private.pocket_checkout_intents%rowtype; params jsonb;
begin
  if p_user_id is null then raise exception 'checkout_result_scope_invalid'; end if;
  perform pg_advisory_xact_lock(hashtextextended('pocket-checkout:'||p_user_id::text,0));
  select * into strict r from private.pocket_checkout_intents where intent_id=p_intent_id and app_user_id=p_user_id for update;
  if r.dispatch_count<>1 or r.dispatch_token is distinct from p_dispatch_token or r.parameters_sha256 is distinct from p_parameters_sha256
    or r.state not in('DISPATCHED','READY') then raise exception 'checkout_result_scope_invalid'; end if;
  params:=r.parameters_text::jsonb;
  if p_session is null or coalesce(p_session->>'id','') !~ '^cs_(test_|live_)?[A-Za-z0-9]+$'
    or p_session->>'customer' is distinct from r.stripe_customer_id or p_session->>'mode' is distinct from 'subscription'
    or p_session->>'status' is distinct from 'open' or p_session->'livemode' is distinct from to_jsonb(r.livemode)
    or p_session->>'client_reference_id' is distinct from p_user_id::text or p_session->'expires_at' is distinct from to_jsonb(r.expires_at)
    or p_session->'metadata' is distinct from params->'metadata'
    or coalesce(p_session->>'url','') !~ '^https://checkout[.]stripe[.]com/c/pay/[^[:space:]]+$'
    or octet_length(p_session::text)>12000 then raise exception 'checkout_result_contract_invalid'; end if;
  if r.state='READY' and r.session_projection is distinct from p_session then raise exception 'checkout_result_conflict'; end if;
  update private.pocket_checkout_intents set state='READY',stripe_session_id=p_session->>'id',session_projection=p_session,updated_at=clock_timestamp()
    where intent_id=r.intent_id returning * into r;
  -- Save the known external result even if entitlement arrived meanwhile;
  -- withhold its redirect. No expiry/completion event releases the UUID here.
  if not private.pocket_checkout_identity_ok(p_user_id,r.verified_email,r.stripe_customer_id) or private.has_pocket_web_subscription(p_user_id)
    then return jsonb_build_object('kind','HOLD','reason','IDENTITY_OR_ACTIVE_SUBSCRIPTION'); end if;
  return private.pocket_checkout_packet(r,'READY');
end $$;

-- Additive fence only: a committed webhook before claim must be observed.
-- It cannot make a PostgreSQL transaction atomic with a remote Stripe call.
create function private.serialize_pocket_checkout_subscription() returns trigger
language plpgsql security definer set search_path='' as $$
declare owner uuid;
begin
  owner:=new.app_user_id;
  if owner is not null then perform pg_advisory_xact_lock(hashtextextended('pocket-checkout:'||owner::text,0)); end if;
  return new;
end $$;
create trigger pocket_checkout_subscription_fence before insert or update on private.pocket_web_subscriptions
  for each row execute function private.serialize_pocket_checkout_subscription();
revoke all on function private.serialize_pocket_checkout_subscription() from public,anon,authenticated,service_role,pocket_checkout_verifier;

create function public.prepare_pocket_checkout_intent(p_user_id uuid,p_email text,p_customer_id text,p_price_id text,p_candidate_sha text,p_stripe_account_id text,p_livemode boolean,p_offer text,p_seed jsonb)
returns jsonb language sql security invoker set search_path='' as $$ select private.prepare_pocket_checkout_intent(p_user_id,p_email,p_customer_id,p_price_id,p_candidate_sha,p_stripe_account_id,p_livemode,p_offer,p_seed) $$;
create function public.claim_pocket_checkout_intent(p_user_id uuid,p_intent_id uuid,p_parameters_sha256 text,p_customer_id text,p_candidate_sha text,p_stripe_account_id text,p_livemode boolean)
returns jsonb language sql security invoker set search_path='' as $$ select private.claim_pocket_checkout_intent(p_user_id,p_intent_id,p_parameters_sha256,p_customer_id,p_candidate_sha,p_stripe_account_id,p_livemode) $$;
create function public.record_pocket_checkout_session(p_user_id uuid,p_intent_id uuid,p_dispatch_token uuid,p_parameters_sha256 text,p_session jsonb)
returns jsonb language sql security invoker set search_path='' as $$ select private.record_pocket_checkout_session(p_user_id,p_intent_id,p_dispatch_token,p_parameters_sha256,p_session) $$;
create function public.attest_pocket_checkout_baseline(p_intent_id uuid,p_user_id uuid,p_customer_id text,p_stripe_account_id text,p_livemode boolean,p_candidate_sha text,p_receipt_sha256 text,p_fence_receipt_sha256 text,p_fenced_at timestamptz,p_inventory_started_at timestamptz,p_inventory_completed_at timestamptz,p_all_pages_verified boolean,p_open_checkout_count integer,p_active_or_pending_subscription_count integer)
returns void language sql security invoker set search_path='' as $$ select private.attest_pocket_checkout_baseline(p_intent_id,p_user_id,p_customer_id,p_stripe_account_id,p_livemode,p_candidate_sha,p_receipt_sha256,p_fence_receipt_sha256,p_fenced_at,p_inventory_started_at,p_inventory_completed_at,p_all_pages_verified,p_open_checkout_count,p_active_or_pending_subscription_count) $$;

revoke all on function private.prepare_pocket_checkout_intent(uuid,text,text,text,text,text,boolean,text,jsonb),public.prepare_pocket_checkout_intent(uuid,text,text,text,text,text,boolean,text,jsonb),
  private.claim_pocket_checkout_intent(uuid,uuid,text,text,text,text,boolean),public.claim_pocket_checkout_intent(uuid,uuid,text,text,text,text,boolean),
  private.record_pocket_checkout_session(uuid,uuid,uuid,text,jsonb),public.record_pocket_checkout_session(uuid,uuid,uuid,text,jsonb),
  private.attest_pocket_checkout_baseline(uuid,uuid,text,text,boolean,text,text,text,timestamptz,timestamptz,timestamptz,boolean,integer,integer),
  public.attest_pocket_checkout_baseline(uuid,uuid,text,text,boolean,text,text,text,timestamptz,timestamptz,timestamptz,boolean,integer,integer)
  from public,anon,authenticated,service_role,pocket_checkout_verifier;
grant execute on function private.prepare_pocket_checkout_intent(uuid,text,text,text,text,text,boolean,text,jsonb),public.prepare_pocket_checkout_intent(uuid,text,text,text,text,text,boolean,text,jsonb),
  private.claim_pocket_checkout_intent(uuid,uuid,text,text,text,text,boolean),public.claim_pocket_checkout_intent(uuid,uuid,text,text,text,text,boolean),
  private.record_pocket_checkout_session(uuid,uuid,uuid,text,jsonb),public.record_pocket_checkout_session(uuid,uuid,uuid,text,jsonb) to service_role;
grant usage on schema private to pocket_checkout_verifier;
grant execute on function private.attest_pocket_checkout_baseline(uuid,uuid,text,text,boolean,text,text,text,timestamptz,timestamptz,timestamptz,boolean,integer,integer),
  public.attest_pocket_checkout_baseline(uuid,uuid,text,text,boolean,text,text,text,timestamptz,timestamptz,timestamptz,boolean,integer,integer) to pocket_checkout_verifier;
commit;
