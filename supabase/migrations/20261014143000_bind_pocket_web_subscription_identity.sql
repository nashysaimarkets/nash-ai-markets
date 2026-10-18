-- Bind Pocket web access to one authenticated application UUID, exact Stripe
-- customer and exact subscription. Historical email-only rows remain denied
-- until a deliberate evidence-backed service-role link is performed.
alter table private.pocket_web_subscriptions
  add column app_user_id uuid,
  add column stripe_customer_id text check (stripe_customer_id is null or length(stripe_customer_id) between 3 and 255),
  add column identity_evidence_ref text check (identity_evidence_ref is null or length(identity_evidence_ref) between 3 and 500),
  add column identity_linked_at timestamptz,
  add constraint pocket_web_subscription_complete_identity check ((app_user_id is null) = (stripe_customer_id is null));

-- Keep the durable one-to-one application-user/customer binding separate from
-- individual subscriptions so a legitimate resubscribe cannot transfer a
-- customer to another account (or attach a second customer to the account).
create table private.pocket_web_identities (
  app_user_id uuid primary key,
  stripe_customer_id text not null unique check (length(stripe_customer_id) between 3 and 255),
  evidence_ref text not null check (length(evidence_ref) between 3 and 500),
  linked_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(app_user_id,stripe_customer_id)
);
alter table private.pocket_web_subscriptions add constraint pocket_web_subscription_identity_fk
  foreign key(app_user_id,stripe_customer_id) references private.pocket_web_identities(app_user_id,stripe_customer_id) match full;
alter table private.pocket_web_identities enable row level security;
revoke all on private.pocket_web_identities from public,anon,authenticated,service_role;

create index pocket_web_subscriptions_user_access_idx
  on private.pocket_web_subscriptions(app_user_id,current_period_end)
  where active and app_user_id is not null and stripe_customer_id is not null;

revoke all on function public.sync_pocket_web_subscription(text,text,text,boolean,timestamptz,bigint),
  private.sync_pocket_web_subscription(text,text,text,boolean,timestamptz,bigint),
  public.has_pocket_web_subscription(text),private.has_pocket_web_subscription(text)
  from public,anon,authenticated,service_role;
-- Retain legacy signatures during the source/schema transition. The email
-- lookup becomes a deny-only compatibility shim; it can never grant access.
create or replace function private.has_pocket_web_subscription(p_email text)
returns boolean language sql stable security definer set search_path='' as $$ select false $$;


create function private.sync_pocket_web_subscription(
  p_app_user_id uuid,p_email text,p_stripe_customer_id text,p_stripe_subscription_id text,
  p_subscription_active boolean,p_current_period_end timestamptz,p_event_created_at bigint
) returns void language plpgsql security definer set search_path='' as $$
declare existing private.pocket_web_subscriptions%rowtype; affected integer;
begin
  if p_subscription_active is null or p_event_created_at is null or p_event_created_at<=0
    or length(lower(trim(coalesce(p_email,'')))) not between 3 and 254
    or length(coalesce(p_stripe_customer_id,'')) not between 3 and 255
    or length(coalesce(p_stripe_subscription_id,'')) not between 3 and 255
    or (p_subscription_active and (p_current_period_end is null or p_app_user_id is null)) then raise exception 'invalid_pocket_subscription'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_stripe_subscription_id,0));
  select * into existing from private.pocket_web_subscriptions where stripe_subscription_id=p_stripe_subscription_id for update;
  if found and not (p_event_created_at>existing.last_event_created_at
    or (p_event_created_at=existing.last_event_created_at and not p_subscription_active and existing.active)) then return; end if;

  if p_subscription_active and not exists(
    select 1 from auth.users u where u.id=p_app_user_id and u.email_confirmed_at is not null
      and not coalesce(u.is_anonymous,false) and (u.banned_until is null or u.banned_until<=now())
      and lower(trim(u.email))=lower(trim(p_email))
  ) then raise exception 'unverified_pocket_application_identity'; end if;

  if p_subscription_active then
    insert into private.pocket_web_identities(app_user_id,stripe_customer_id,evidence_ref)
    values(p_app_user_id,p_stripe_customer_id,'stripe_subscription_metadata:'||p_stripe_subscription_id)
    on conflict(app_user_id) do nothing;
    if not exists(select 1 from private.pocket_web_identities i where i.app_user_id=p_app_user_id and i.stripe_customer_id=p_stripe_customer_id)
    then raise exception 'pocket_customer_identity_conflict'; end if;
  end if;

  if found and ((existing.app_user_id is not null and existing.app_user_id<>p_app_user_id)
    or (existing.stripe_customer_id is not null and existing.stripe_customer_id<>p_stripe_customer_id)) then
    raise exception 'pocket_subscription_identity_conflict';
  end if;

  insert into private.pocket_web_subscriptions(stripe_subscription_id,email,app_user_id,stripe_customer_id,active,current_period_end,last_event_created_at,identity_linked_at)
  values(p_stripe_subscription_id,lower(trim(p_email)),p_app_user_id,p_stripe_customer_id,p_subscription_active,p_current_period_end,p_event_created_at,case when p_app_user_id is not null then now() end)
  on conflict(stripe_subscription_id) do update set email=excluded.email,
    app_user_id=coalesce(pocket_web_subscriptions.app_user_id,excluded.app_user_id),
    stripe_customer_id=coalesce(pocket_web_subscriptions.stripe_customer_id,excluded.stripe_customer_id),
    active=excluded.active,current_period_end=excluded.current_period_end,last_event_created_at=excluded.last_event_created_at,
    identity_linked_at=coalesce(pocket_web_subscriptions.identity_linked_at,excluded.identity_linked_at),updated_at=now()
  where excluded.last_event_created_at > pocket_web_subscriptions.last_event_created_at
    or (excluded.last_event_created_at = pocket_web_subscriptions.last_event_created_at and not excluded.active and pocket_web_subscriptions.active);
  get diagnostics affected=row_count;
  if affected=0 then return; end if;
  perform public.sync_pocket_founding_650(p_email,p_stripe_customer_id,p_stripe_subscription_id,p_subscription_active,p_current_period_end,p_event_created_at);
end $$;

create function private.link_pocket_web_subscription_identity(
  p_app_user_id uuid,p_email text,p_stripe_customer_id text,p_stripe_subscription_id text,p_evidence_ref text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare existing private.pocket_web_subscriptions%rowtype;
begin
  if p_app_user_id is null or length(lower(trim(coalesce(p_email,'')))) not between 3 and 254
    or length(coalesce(p_stripe_customer_id,'')) not between 3 and 255
    or length(coalesce(p_stripe_subscription_id,'')) not between 3 and 255
    or length(trim(coalesce(p_evidence_ref,''))) not between 3 and 500 then raise exception 'invalid_pocket_identity_link'; end if;
  if not exists(select 1 from auth.users u where u.id=p_app_user_id and u.email_confirmed_at is not null
    and not coalesce(u.is_anonymous,false) and (u.banned_until is null or u.banned_until<=now())
    and lower(trim(u.email))=lower(trim(p_email))) then raise exception 'unverified_pocket_application_identity'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_stripe_subscription_id,0));
  select * into existing from private.pocket_web_subscriptions where stripe_subscription_id=p_stripe_subscription_id for update;
  if not found or existing.email<>lower(trim(p_email)) or not existing.active or existing.current_period_end<=now()
    or (existing.app_user_id is not null and existing.app_user_id<>p_app_user_id)
    or (existing.stripe_customer_id is not null and existing.stripe_customer_id<>p_stripe_customer_id) then raise exception 'pocket_identity_link_mismatch'; end if;
  insert into private.pocket_web_identities(app_user_id,stripe_customer_id,evidence_ref)
  values(p_app_user_id,p_stripe_customer_id,trim(p_evidence_ref))
  on conflict(app_user_id) do nothing;
  if not exists(select 1 from private.pocket_web_identities i where i.app_user_id=p_app_user_id and i.stripe_customer_id=p_stripe_customer_id)
  then raise exception 'pocket_customer_identity_conflict'; end if;
  update private.pocket_web_subscriptions set app_user_id=p_app_user_id,stripe_customer_id=p_stripe_customer_id,
    identity_evidence_ref=trim(p_evidence_ref),identity_linked_at=now(),updated_at=now()
    where stripe_subscription_id=p_stripe_subscription_id;
  return jsonb_build_object('linked',true,'app_user_id',p_app_user_id,'stripe_subscription_id',p_stripe_subscription_id);
end $$;

create function private.has_pocket_web_subscription(p_user_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from private.pocket_web_subscriptions s join auth.users u on u.id=s.app_user_id
    join private.pocket_web_identities i on i.app_user_id=s.app_user_id and i.stripe_customer_id=s.stripe_customer_id
    where s.app_user_id=p_user_id and s.stripe_customer_id is not null and s.active and s.current_period_end>now()
      and u.email_confirmed_at is not null and not coalesce(u.is_anonymous,false) and (u.banned_until is null or u.banned_until<=now())
      and lower(trim(u.email))=s.email)
$$;

-- Lookup is UUID-bound even after subscription expiry. Checkout must reuse this
-- customer; email-based discovery would reintroduce recreated-account access.
create function private.get_pocket_web_customer(p_user_id uuid,p_email text)
returns text language plpgsql stable security definer set search_path='' as $$
declare customer_id text;
begin
  if p_user_id is null or not exists(select 1 from auth.users u where u.id=p_user_id
    and u.email_confirmed_at is not null and not coalesce(u.is_anonymous,false)
    and (u.banned_until is null or u.banned_until<=now())
    and lower(trim(u.email))=lower(trim(p_email))) then
    raise exception 'unverified_pocket_application_identity';
  end if;
  select i.stripe_customer_id into customer_id from private.pocket_web_identities i where i.app_user_id=p_user_id;
  return customer_id;
end $$;

create function public.get_pocket_web_customer(p_user_id uuid,p_email text)
returns text language sql stable security invoker set search_path='' as $$ select private.get_pocket_web_customer(p_user_id,p_email) $$;
revoke all on function private.get_pocket_web_customer(uuid,text),public.get_pocket_web_customer(uuid,text) from public,anon,authenticated,service_role;
grant execute on function private.get_pocket_web_customer(uuid,text),public.get_pocket_web_customer(uuid,text) to service_role;

create function public.sync_pocket_web_subscription(p_app_user_id uuid,p_email text,p_stripe_customer_id text,p_stripe_subscription_id text,p_subscription_active boolean,p_current_period_end timestamptz,p_event_created_at bigint)
returns void language sql security invoker set search_path='' as $$ select private.sync_pocket_web_subscription(p_app_user_id,p_email,p_stripe_customer_id,p_stripe_subscription_id,p_subscription_active,p_current_period_end,p_event_created_at) $$;
create function public.link_pocket_web_subscription_identity(p_app_user_id uuid,p_email text,p_stripe_customer_id text,p_stripe_subscription_id text,p_evidence_ref text)
returns jsonb language sql security invoker set search_path='' as $$ select private.link_pocket_web_subscription_identity(p_app_user_id,p_email,p_stripe_customer_id,p_stripe_subscription_id,p_evidence_ref) $$;
create function public.has_pocket_web_subscription(p_user_id uuid)
returns boolean language sql stable security invoker set search_path='' as $$ select private.has_pocket_web_subscription(p_user_id) $$;

revoke all on function private.sync_pocket_web_subscription(uuid,text,text,text,boolean,timestamptz,bigint),public.sync_pocket_web_subscription(uuid,text,text,text,boolean,timestamptz,bigint),
  private.link_pocket_web_subscription_identity(uuid,text,text,text,text),public.link_pocket_web_subscription_identity(uuid,text,text,text,text),
  private.has_pocket_web_subscription(uuid),public.has_pocket_web_subscription(uuid) from public,anon,authenticated,service_role;
grant execute on function private.sync_pocket_web_subscription(uuid,text,text,text,boolean,timestamptz,bigint),public.sync_pocket_web_subscription(uuid,text,text,text,boolean,timestamptz,bigint),
  private.link_pocket_web_subscription_identity(uuid,text,text,text,text),public.link_pocket_web_subscription_identity(uuid,text,text,text,text),
  private.has_pocket_web_subscription(uuid),public.has_pocket_web_subscription(uuid) to service_role;

-- Old deployed Stripe producers omit the UUID. Preserve their named-argument
-- contract without inferring ownership from email. An already bound exact
-- subscription/customer can use its durable UUID; unbound rows remain unbound.
create or replace function private.sync_pocket_web_subscription(
  p_email text,p_stripe_customer_id text,p_stripe_subscription_id text,
  p_subscription_active boolean,p_current_period_end timestamptz,p_event_created_at bigint
) returns void language plpgsql security definer set search_path='' as $$
declare existing private.pocket_web_subscriptions%rowtype; affected integer;
begin
  if p_subscription_active is null or p_event_created_at is null or p_event_created_at<=0
    or length(lower(trim(coalesce(p_email,'')))) not between 3 and 254
    or length(coalesce(p_stripe_customer_id,'')) not between 3 and 255
    or length(coalesce(p_stripe_subscription_id,'')) not between 3 and 255
    or (p_subscription_active and p_current_period_end is null) then raise exception 'invalid_pocket_subscription'; end if;
  -- Serialize both producer versions even when no subscription row exists yet.
  perform pg_advisory_xact_lock(hashtextextended(p_stripe_subscription_id,0));
  select * into existing from private.pocket_web_subscriptions where stripe_subscription_id=p_stripe_subscription_id for update;
  if found and existing.app_user_id is not null then
    if existing.stripe_customer_id<>p_stripe_customer_id or existing.email<>lower(trim(p_email))
    then raise exception 'pocket_subscription_identity_conflict'; end if;
    perform private.sync_pocket_web_subscription(existing.app_user_id,p_email,p_stripe_customer_id,
      p_stripe_subscription_id,p_subscription_active,p_current_period_end,p_event_created_at);
    return;
  end if;
  insert into private.pocket_web_subscriptions(stripe_subscription_id,email,active,current_period_end,last_event_created_at)
  values(p_stripe_subscription_id,lower(trim(p_email)),p_subscription_active,p_current_period_end,p_event_created_at)
  on conflict(stripe_subscription_id) do update set email=excluded.email,active=excluded.active,
    current_period_end=excluded.current_period_end,last_event_created_at=excluded.last_event_created_at,updated_at=now()
  where excluded.last_event_created_at>pocket_web_subscriptions.last_event_created_at
    or (excluded.last_event_created_at=pocket_web_subscriptions.last_event_created_at and not excluded.active and pocket_web_subscriptions.active);
  get diagnostics affected=row_count;
  if affected=0 then return; end if;
  perform public.sync_pocket_founding_650(p_email,p_stripe_customer_id,p_stripe_subscription_id,p_subscription_active,p_current_period_end,p_event_created_at);
end $$;
-- Existing public wrappers retain their OIDs and argument names for old clients.
grant execute on function public.sync_pocket_web_subscription(text,text,text,boolean,timestamptz,bigint),
  private.sync_pocket_web_subscription(text,text,text,boolean,timestamptz,bigint),
  public.has_pocket_web_subscription(text),private.has_pocket_web_subscription(text) to service_role;
