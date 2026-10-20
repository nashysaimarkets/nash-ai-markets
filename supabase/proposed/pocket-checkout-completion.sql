-- UNINSTALLED extension of pocket-checkout-intent.sql; no automatic migration.
-- Separate NOLOGIN verifier authority; no role/key/membership is created here.
begin;
set local lock_timeout='2s';
set local statement_timeout='30s';
create table private.pocket_checkout_fences (
  scope jsonb primary key,
  receipt_sha256 text not null unique check(receipt_sha256 ~ '^[a-f0-9]{64}$'),
  evidence jsonb not null,
  fenced_at timestamptz not null,
  valid_until timestamptz not null,
  check(valid_until>fenced_at)
);
create table private.pocket_checkout_fence_history (
  receipt_sha256 text primary key,
  scope jsonb not null,
  evidence jsonb not null,
  fenced_at timestamptz not null,
  valid_until timestamptz not null
);
alter table private.pocket_checkout_baselines add column inventory_text text;
create table private.pocket_customer_provisions (
  id uuid primary key default gen_random_uuid(),
  app_user_id uuid not null unique references auth.users(id),
  scope jsonb not null,
  enrollment_sha256 text not null unique check(enrollment_sha256 ~ '^[a-f0-9]{64}$'),
  fence_sha256 text not null,
  approved_until timestamptz not null,
  state text not null default 'PREPARED' check(state in('PREPARED','DISPATCHED','BOUND')),
  token uuid,
  customer_id text unique,
  check((state='PREPARED')=(token is null)),
  check((state='BOUND')=(customer_id is not null))
);
create table private.pocket_checkout_reconciliations (
  intent_id uuid not null references private.pocket_checkout_intents(intent_id),
  receipt_sha256 text primary key,
  inventory_text text not null,
  fence_sha256 text not null,
  session jsonb not null,
  recorded_at timestamptz not null default clock_timestamp()
);
alter table private.pocket_checkout_fences enable row level security;
alter table private.pocket_checkout_fence_history enable row level security;
alter table private.pocket_customer_provisions enable row level security;
alter table private.pocket_checkout_reconciliations enable row level security;
revoke all on private.pocket_checkout_fences,private.pocket_checkout_fence_history,private.pocket_customer_provisions,private.pocket_checkout_reconciliations from public,anon,authenticated,service_role,pocket_checkout_verifier;

create function private.checkout_base_scope_ok(s jsonb) returns boolean language sql immutable set search_path='' as $$
  select coalesce(jsonb_typeof(s)='object' and (select count(*) from jsonb_object_keys(s))=6
    and s->>'userId' ~ '^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$'
    and s->>'stripeAccountId' ~ '^acct_[A-Za-z0-9]+$' and s->>'priceId' ~ '^price_[A-Za-z0-9]+$'
    and s->>'candidateSha' ~ '^[a-f0-9]{40}$' and jsonb_typeof(s->'livemode')='boolean'
    and s->>'offer'='pocket_founding_650',false)
$$;
create function private.checkout_user_ok(p_user uuid) returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from auth.users where id=p_user and email_confirmed_at is not null and not coalesce(is_anonymous,false)
    and (banned_until is null or banned_until<=now()) and length(trim(email)) between 3 and 254)
$$;
create function private.register_pocket_checkout_fence(p_scope jsonb,p_evidence jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare digest text; f timestamptz; v timestamptz;
begin
  if not private.checkout_base_scope_ok(p_scope) or p_evidence->'old_writers_drained' is distinct from 'true'::jsonb
    or p_evidence->'recovery_links_disabled' is distinct from 'true'::jsonb or p_evidence->'other_obligations_reviewed' is distinct from 'true'::jsonb
    or coalesce(p_evidence->>'approval_sha256','') !~ '^[a-f0-9]{64}$' or coalesce(p_evidence->>'cutover_sha256','') !~ '^[a-f0-9]{64}$'
    then raise exception 'checkout_fence_evidence_required'; end if;
  f:=(p_evidence->>'fenced_at')::timestamptz; v:=(p_evidence->>'valid_until')::timestamptz;
  if f is null or v is null or f>clock_timestamp() or f<clock_timestamp()-interval '60 seconds'
    or v<=clock_timestamp() or v>f+interval '5 minutes' then raise exception 'checkout_fence_time_invalid'; end if;
  perform pg_advisory_xact_lock(hashtextextended('pocket-checkout:'||(p_scope->>'userId'),0));
  digest:=encode(sha256(convert_to(jsonb_build_object('scope',p_scope,'evidence',p_evidence)::text,'UTF8')),'hex');
  insert into private.pocket_checkout_fences values(p_scope,digest,p_evidence,f,v)
    on conflict(scope) do update set receipt_sha256=excluded.receipt_sha256,evidence=excluded.evidence,fenced_at=excluded.fenced_at,valid_until=excluded.valid_until;
  insert into private.pocket_checkout_fence_history values(digest,p_scope,p_evidence,f,v) on conflict(receipt_sha256) do nothing;
  return jsonb_build_object('kind','FENCED','receipt_sha256',digest);
end $$;
create function private.get_pocket_checkout_fence(p_scope jsonb) returns jsonb language sql security definer set search_path='' as $$
  select jsonb_build_object('kind','FENCED','scope',scope,'receipt_sha256',receipt_sha256,'fenced_at',fenced_at,'valid_until',valid_until,
    'old_writers_drained',true,'recovery_links_disabled',true,'other_obligations_reviewed',true)
  from private.pocket_checkout_fences where scope=p_scope and valid_until>clock_timestamp()
$$;
-- Verify exact raw inventory bytes and a still-current operator fence under the UUID lock.
create function private.checkout_evidence(p_text text,p_sha text,p_fence text) returns jsonb language plpgsql security definer set search_path='' as $$
declare e jsonb; s jsonb; f private.pocket_checkout_fences%rowtype; started timestamptz; finished timestamptz;
begin
  if p_text is null or octet_length(p_text)>2097152 or encode(sha256(convert_to(p_text,'UTF8')),'hex') is distinct from p_sha then raise exception 'checkout_inventory_hash_invalid'; end if;
  e:=p_text::jsonb; s:=e->'scope';
  if not private.checkout_base_scope_ok(s-'intentId'-'customerId') or coalesce(s->>'intentId','') !~ '^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$'
    or coalesce(s->>'customerId','') !~ '^cus_[A-Za-z0-9]+$' or e->'schemaVersion' is distinct from '1'::jsonb
    or e->'allPagesVerified' is distinct from 'true'::jsonb or e->'authorisesCheckout' is distinct from 'false'::jsonb
    or jsonb_typeof(e->'subscriptions') is distinct from 'array' or jsonb_typeof(e->'checkoutSessions') is distinct from 'array'
    or jsonb_typeof(e->'subscriptionSchedules') is distinct from 'array' then raise exception 'checkout_inventory_contract_invalid'; end if;
  perform pg_advisory_xact_lock(hashtextextended('pocket-checkout:'||(s->>'userId'),0));
  select * into strict f from private.pocket_checkout_fences where scope=s-'intentId'-'customerId' for update;
  started:=(e->>'inventoryStartedAt')::timestamptz; finished:=(e->>'inventoryCompletedAt')::timestamptz;
  if f.receipt_sha256 is distinct from p_fence or f.valid_until<=clock_timestamp() or started is null or finished is null
    or started<f.fenced_at or started<clock_timestamp()-interval '60 seconds' or finished<started or finished>clock_timestamp()
    or finished-started>interval '45 seconds' then raise exception 'checkout_inventory_stale_or_unfenced'; end if;
  -- Do not trust caller-supplied blocker counts alone, even on the governed role.
  if exists(select 1 from jsonb_array_elements(e->'subscriptions') x where coalesce(x->>'status','') not in('canceled','incomplete_expired'))
    or exists(select 1 from jsonb_array_elements(e->'subscriptionSchedules') x where coalesce(x->>'status','') not in('completed','released','canceled'))
    or e->'blockers'->'activeOrPendingSubscription' is distinct from '0'::jsonb
    or e->'blockers'->'activeOrPendingSchedule' is distinct from '0'::jsonb
    or e->'blockers'->'checkoutReconciliation' is distinct from '0'::jsonb
    or e->'blockers'->'scheduleReconciliation' is distinct from '0'::jsonb then raise exception 'checkout_inventory_obligations'; end if;
  if (select count(*) from jsonb_each(e->'pages'))<>3 or exists(select 1 from jsonb_each(e->'pages') x where jsonb_typeof(x.value)<>'number' or (x.value::text)::numeric not between 1 and 20)
    or exists(select 1 from jsonb_array_elements(e->'checkoutSessions') x where coalesce(x->>'status','') not in('open','complete','expired'))
    or exists(select 1 from jsonb_array_elements(e->'checkoutSessions') x where x->>'mode'='subscription' and x->>'status'='complete' and not exists(
      select 1 from jsonb_array_elements(e->'subscriptions') sub where sub->>'id'=x->>'subscription' and sub->>'status' in('canceled','incomplete_expired')))
    or exists(select 1 from jsonb_array_elements(e->'subscriptionSchedules') x where
      (x->>'status'='released' and x->>'releasedSubscription' is null) or
      (x->>'subscription' is not null and not exists(select 1 from jsonb_array_elements(e->'subscriptions') sub where sub->>'id'=x->>'subscription' and sub->>'status' in('canceled','incomplete_expired'))) or
      (x->>'releasedSubscription' is not null and not exists(select 1 from jsonb_array_elements(e->'subscriptions') sub where sub->>'id'=x->>'releasedSubscription' and sub->>'status' in('canceled','incomplete_expired'))))
    then raise exception 'checkout_inventory_incomplete_obligations'; end if;
  return e;
end $$;
create function private.issue_pocket_checkout_baseline(p_inventory_text text,p_inventory_sha256 text,p_fence_sha256 text) returns jsonb language plpgsql security definer set search_path='' as $$
declare e jsonb; s jsonb; f private.pocket_checkout_fences%rowtype;
begin
  e:=private.checkout_evidence(p_inventory_text,p_inventory_sha256,p_fence_sha256); s:=e->'scope';
  if e->'blockers'->'openCheckout' is distinct from '0'::jsonb
    or exists(select 1 from jsonb_array_elements(e->'checkoutSessions') x where coalesce(x->>'status','') not in('expired','complete')) then raise exception 'checkout_open_session'; end if;
  if not exists(select 1 from private.pocket_checkout_intents where intent_id=(s->>'intentId')::uuid and price_id=s->>'priceId' and offer=s->>'offer') then raise exception 'checkout_baseline_offer_mismatch'; end if;
  select * into strict f from private.pocket_checkout_fences where scope=s-'intentId'-'customerId';
  perform private.attest_pocket_checkout_baseline((s->>'intentId')::uuid,(s->>'userId')::uuid,s->>'customerId',s->>'stripeAccountId',(s->>'livemode')::boolean,s->>'candidateSha',
    p_inventory_sha256,p_fence_sha256,f.fenced_at,(e->>'inventoryStartedAt')::timestamptz,(e->>'inventoryCompletedAt')::timestamptz,true,0,0);
  update private.pocket_checkout_baselines set inventory_text=p_inventory_text where intent_id=(s->>'intentId')::uuid;
  return jsonb_build_object('kind','ISSUED','id',s->>'intentId');
end $$;
create function private.enroll_pocket_customer_provision(p_scope jsonb,p_enrollment_sha256 text,p_fence_sha256 text) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid; f private.pocket_checkout_fences%rowtype; r private.pocket_customer_provisions%rowtype;
begin
  if not private.checkout_base_scope_ok(p_scope) or coalesce(p_enrollment_sha256,'') !~ '^[a-f0-9]{64}$' then raise exception 'checkout_enrollment_evidence_required'; end if;
  u:=(p_scope->>'userId')::uuid;
  perform pg_advisory_xact_lock(hashtextextended('pocket-checkout:'||u::text,0));
  select * into strict f from private.pocket_checkout_fences where scope=p_scope for update;
  if f.receipt_sha256 is distinct from p_fence_sha256 or f.valid_until<=clock_timestamp() or not private.checkout_user_ok(u)
    or exists(select 1 from private.pocket_web_identities where app_user_id=u)
    or exists(select 1 from private.pocket_web_subscriptions s join auth.users a on a.id=u where s.app_user_id=u or lower(trim(s.email))=lower(trim(a.email)))
    then raise exception 'checkout_enrollment_conflict'; end if;
  -- Receipt must attest the independent legacy/customer association review, not email ownership.
  insert into private.pocket_customer_provisions(app_user_id,scope,enrollment_sha256,fence_sha256,approved_until)
    values(u,p_scope,p_enrollment_sha256,p_fence_sha256,least(f.valid_until,clock_timestamp()+interval '60 seconds')) returning * into r;
  return jsonb_build_object('kind','ENROLLED','id',r.id);
end $$;
create function private.prepare_pocket_customer_provision(p_scope jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare r private.pocket_customer_provisions%rowtype;
begin
  if not private.checkout_base_scope_ok(p_scope) or not private.checkout_user_ok((p_scope->>'userId')::uuid) then raise exception 'checkout_provision_identity_invalid'; end if;
  select * into r from private.pocket_customer_provisions where app_user_id=(p_scope->>'userId')::uuid and scope=p_scope;
  if not found then return jsonb_build_object('kind','HOLD'); end if;
  if r.state='BOUND' and exists(select 1 from private.pocket_web_identities where app_user_id=r.app_user_id and stripe_customer_id=r.customer_id)
    then return jsonb_build_object('kind','BOUND','customer_id',r.customer_id); end if;
  if r.state<>'PREPARED' or r.approved_until<=clock_timestamp() then return jsonb_build_object('kind','HOLD'); end if;
  return jsonb_build_object('kind','PREPARED','id',r.id,'scope',r.scope);
end $$;
create function private.claim_pocket_customer_provision(p_id uuid,p_scope jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare r private.pocket_customer_provisions%rowtype;
begin
  if not private.checkout_base_scope_ok(p_scope) then raise exception 'checkout_scope_invalid'; end if;
  perform pg_advisory_xact_lock(hashtextextended('pocket-checkout:'||(p_scope->>'userId'),0));
  select * into strict r from private.pocket_customer_provisions where id=p_id and scope=p_scope for update;
  if r.state<>'PREPARED' or r.approved_until<=clock_timestamp() or not private.checkout_user_ok(r.app_user_id)
    or exists(select 1 from private.pocket_web_identities where app_user_id=r.app_user_id)
    or exists(select 1 from private.pocket_web_subscriptions s join auth.users a on a.id=r.app_user_id where s.app_user_id=r.app_user_id or lower(trim(s.email))=lower(trim(a.email)))
    or not exists(select 1 from private.pocket_checkout_fences where scope=p_scope and receipt_sha256=r.fence_sha256 and valid_until>clock_timestamp())
    then return jsonb_build_object('kind','HOLD'); end if;
  update private.pocket_customer_provisions set state='DISPATCHED',token=gen_random_uuid() where id=r.id returning * into r;
  return jsonb_build_object('kind','DISPATCH','id',r.id,'scope',r.scope,'token',r.token,'key','pocket-customer:'||r.id::text);
end $$;
create function private.bind_pocket_customer_provision(p_id uuid,p_scope jsonb,p_customer jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare r private.pocket_customer_provisions%rowtype; m jsonb;
begin
  if not private.checkout_base_scope_ok(p_scope) then raise exception 'checkout_scope_invalid'; end if;
  perform pg_advisory_xact_lock(hashtextextended('pocket-checkout:'||(p_scope->>'userId'),0));
  select * into strict r from private.pocket_customer_provisions where id=p_id and scope=p_scope for update;
  m:=jsonb_build_object('supabase_user_id',r.app_user_id::text,'pocket_provision_id',r.id::text,'pocket_candidate_sha',r.scope->>'candidateSha');
  if r.state not in('DISPATCHED','BOUND') or not private.checkout_user_ok(r.app_user_id) or coalesce(p_customer->>'id','') !~ '^cus_[A-Za-z0-9]+$'
    or p_customer->'livemode' is distinct from r.scope->'livemode' or p_customer->'metadata' is distinct from m
    or (r.customer_id is not null and r.customer_id is distinct from p_customer->>'id') then raise exception 'checkout_customer_result_invalid'; end if;
  insert into private.pocket_web_identities(app_user_id,stripe_customer_id,evidence_ref)
    values(r.app_user_id,p_customer->>'id','checkout_provision:'||r.id::text) on conflict(app_user_id) do nothing;
  if not exists(select 1 from private.pocket_web_identities where app_user_id=r.app_user_id and stripe_customer_id=p_customer->>'id') then raise exception 'checkout_customer_binding_conflict'; end if;
  update private.pocket_customer_provisions set state='BOUND',customer_id=p_customer->>'id' where id=r.id;
  return jsonb_build_object('kind','BOUND','customer_id',p_customer->>'id');
end $$;
create function private.record_pocket_customer_provision(p_id uuid,p_token uuid,p_scope jsonb,p_customer jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
begin
  if p_token is null or not exists(select 1 from private.pocket_customer_provisions where id=p_id and token=p_token and scope=p_scope)
    then raise exception 'checkout_provision_token_invalid'; end if;
  return private.bind_pocket_customer_provision(p_id,p_scope,p_customer);
end $$;
create function private.recover_pocket_customer_provision(p_id uuid,p_scope jsonb,p_customer jsonb) returns jsonb language sql security definer set search_path='' as $$
  select private.bind_pocket_customer_provision(p_id,p_scope,p_customer)
$$;
create function private.inspect_pocket_checkout_recovery(p_scope jsonb) returns jsonb language sql security definer set search_path='' as $$
  select jsonb_build_object('kind',state,'scope',p_scope,'parameters_text',parameters_text,'parameters_sha256',parameters_sha256,'session_id',stripe_session_id)
  from private.pocket_checkout_intents where intent_id=(p_scope->>'intentId')::uuid and app_user_id=(p_scope->>'userId')::uuid
    and stripe_customer_id=p_scope->>'customerId' and stripe_account_id=p_scope->>'stripeAccountId' and livemode=(p_scope->>'livemode')::boolean
    and candidate_sha=p_scope->>'candidateSha' and price_id=p_scope->>'priceId' and offer=p_scope->>'offer' and dispatch_count=1
$$;
create function private.reconcile_pocket_checkout_intent(p_scope jsonb,p_session jsonb,p_parameters_sha256 text,p_inventory_text text,p_inventory_sha256 text,p_fence_sha256 text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare e jsonb; r private.pocket_checkout_intents%rowtype; params jsonb; is_open boolean; listed jsonb;
begin
  e:=private.checkout_evidence(p_inventory_text,p_inventory_sha256,p_fence_sha256);
  if e->'scope' is distinct from p_scope then raise exception 'checkout_reconcile_scope_invalid'; end if;
  select * into strict r from private.pocket_checkout_intents where intent_id=(p_scope->>'intentId')::uuid and app_user_id=(p_scope->>'userId')::uuid for update;
  params:=r.parameters_text::jsonb;
  if r.state not in('DISPATCHED','READY') or r.dispatch_count<>1 or r.parameters_sha256 is distinct from p_parameters_sha256
    or r.stripe_customer_id is distinct from p_scope->>'customerId' or r.stripe_account_id is distinct from p_scope->>'stripeAccountId'
    or r.candidate_sha is distinct from p_scope->>'candidateSha' or to_jsonb(r.livemode) is distinct from p_scope->'livemode'
    or r.price_id is distinct from p_scope->>'priceId' or r.offer is distinct from p_scope->>'offer'
    or not private.pocket_checkout_identity_ok(r.app_user_id,r.verified_email,r.stripe_customer_id)
    or private.has_pocket_web_subscription(r.app_user_id) then raise exception 'checkout_reconcile_state_invalid'; end if;
  if coalesce(p_session->>'id','') !~ '^cs_(test_|live_)?[A-Za-z0-9]+$' or p_session->>'customer' is distinct from r.stripe_customer_id
    or (r.stripe_session_id is not null and r.stripe_session_id is distinct from p_session->>'id')
    or p_session->>'mode' is distinct from 'subscription' or p_session->'livemode' is distinct from to_jsonb(r.livemode)
    or p_session->>'client_reference_id' is distinct from r.app_user_id::text or p_session->'metadata' is distinct from params->'metadata'
    or p_session->'expires_at' is distinct from params->'expires_at' or coalesce(p_session->>'status','') not in('open','expired','complete')
    then raise exception 'checkout_reconcile_session_invalid'; end if;
  select x into strict listed from jsonb_array_elements(e->'checkoutSessions') x where x->>'id'=p_session->>'id';
  if listed->>'status' is distinct from p_session->>'status' or listed->'subscription' is distinct from p_session->'subscription'
    or listed->>'paymentStatus' is distinct from p_session->>'payment_status' then raise exception 'checkout_reconcile_inventory_conflict'; end if;
  is_open:=p_session->>'status'='open';
  if e->'blockers'->'openCheckout' is distinct from to_jsonb(case when is_open then 1 else 0 end)
    or (select count(*) from jsonb_array_elements(e->'checkoutSessions') x where x->>'status'='open')<>(case when is_open then 1 else 0 end)
    then raise exception 'checkout_reconcile_other_session'; end if;
  insert into private.pocket_checkout_reconciliations values(r.intent_id,p_inventory_sha256,p_inventory_text,p_fence_sha256,p_session,clock_timestamp()) on conflict(receipt_sha256) do nothing;
  if is_open then
    if r.expires_at<=extract(epoch from clock_timestamp()) or coalesce(p_session->>'url','') !~ '^https://checkout[.]stripe[.]com/c/pay/[^[:space:]]+$' then raise exception 'checkout_reconcile_url_invalid'; end if;
    update private.pocket_checkout_intents set state='READY',stripe_session_id=p_session->>'id',session_projection=p_session-'subscription'-'payment_status',updated_at=clock_timestamp() where intent_id=r.intent_id;
    return jsonb_build_object('kind','RECOVERED','id',r.intent_id);
  end if;
  -- Preserve old intent, token, hashes and receipt permanently; no delete/reset.
  update private.pocket_checkout_intents set state='RECONCILED',stripe_session_id=p_session->>'id',session_projection=p_session,updated_at=clock_timestamp() where intent_id=r.intent_id;
  return jsonb_build_object('kind','RECONCILED','id',r.intent_id);
end $$;
-- The old count-only attestor is no longer a public verifier entry point.
revoke execute on function private.attest_pocket_checkout_baseline(uuid,uuid,text,text,boolean,text,text,text,timestamptz,timestamptz,timestamptz,boolean,integer,integer),
 public.attest_pocket_checkout_baseline(uuid,uuid,text,text,boolean,text,text,text,timestamptz,timestamptz,timestamptz,boolean,integer,integer) from pocket_checkout_verifier;
-- Public wrappers are invoker-only; private SECURITY DEFINER functions have empty search_path and explicit ACLs.
do $$
declare p record; signature text; args text; runtime boolean;
begin
  for p in select * from pg_proc where pronamespace='private'::regnamespace and proname=any(array[
    'checkout_base_scope_ok','checkout_user_ok','register_pocket_checkout_fence','get_pocket_checkout_fence','checkout_evidence',
    'issue_pocket_checkout_baseline','enroll_pocket_customer_provision','prepare_pocket_customer_provision','claim_pocket_customer_provision',
    'bind_pocket_customer_provision','record_pocket_customer_provision','recover_pocket_customer_provision','inspect_pocket_checkout_recovery','reconcile_pocket_checkout_intent']) loop
    signature:=pg_get_function_identity_arguments(p.oid);
    execute format('revoke all on function private.%I(%s) from public,anon,authenticated,service_role,pocket_checkout_verifier',p.proname,signature);
    if p.proname in('checkout_base_scope_ok','checkout_user_ok','checkout_evidence','bind_pocket_customer_provision') then continue; end if;
    select string_agg(quote_ident(a),',') into args from unnest(p.proargnames) a;
    execute format('create function public.%I(%s) returns jsonb language sql security invoker set search_path='''' as %L',p.proname,signature,format('select private.%I(%s)',p.proname,args));
    execute format('revoke all on function public.%I(%s) from public,anon,authenticated,service_role,pocket_checkout_verifier',p.proname,signature);
    runtime:=p.proname in('prepare_pocket_customer_provision','claim_pocket_customer_provision','record_pocket_customer_provision');
    execute format('grant execute on function private.%I(%s),public.%I(%s) to %I',p.proname,signature,p.proname,signature,case when runtime then 'service_role' else 'pocket_checkout_verifier' end);
  end loop;
end $$;
commit;
