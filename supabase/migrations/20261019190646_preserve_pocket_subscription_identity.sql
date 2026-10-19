-- Additive successor: preserve an existing subscription identity after INSERT
-- changes PL/pgSQL FOUND. No rows/tables/grants are changed. Requires independent
-- shared-live rollout approval; do not install with a staging-only approval.
create or replace function private.sync_pocket_web_subscription(
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

  if existing.stripe_subscription_id is not null and ((existing.app_user_id is not null and existing.app_user_id<>p_app_user_id)
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
