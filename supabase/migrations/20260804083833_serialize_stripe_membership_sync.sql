create or replace function public.sync_membership_from_stripe(
  p_email text,
  p_plan text,
  p_status text,
  p_stripe_customer_id text,
  p_stripe_subscription_id text,
  p_current_period_end timestamptz,
  p_billing_interval text,
  p_unit_amount integer,
  p_event_created_at bigint
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_event_created_at <= 0 or length(p_stripe_subscription_id) < 3
    or (p_plan is not null and p_plan not in ('pro', 'elite'))
    or (p_billing_interval is not null and p_billing_interval not in ('month', 'year'))
    or (p_unit_amount is not null and p_unit_amount < 0) then
    raise exception 'invalid_membership_sync_input';
  end if;

  -- Stripe can deliver checkout.session.completed and
  -- customer.subscription.created concurrently for the same subscription.
  -- Serialize those writes so the customer uniqueness constraint cannot race.
  perform pg_advisory_xact_lock(hashtextextended(p_stripe_subscription_id, 0));

  if p_plan is null then
    update public.memberships set
      status = p_status,
      current_period_end = coalesce(p_current_period_end, current_period_end),
      last_stripe_event_created_at = p_event_created_at,
      updated_at = now()
    where stripe_subscription_id = p_stripe_subscription_id
      and coalesce(last_stripe_event_created_at, 0) <= p_event_created_at;
    return found;
  end if;

  if length(lower(trim(coalesce(p_email, '')))) < 3 or length(coalesce(p_stripe_customer_id, '')) < 3 then
    raise exception 'invalid_membership_sync_input';
  end if;

  insert into public.memberships (
    email, plan, status, stripe_customer_id, stripe_subscription_id,
    current_period_end, billing_interval, unit_amount,
    last_stripe_event_created_at, updated_at
  ) values (
    lower(trim(p_email)), p_plan, p_status, p_stripe_customer_id,
    p_stripe_subscription_id, p_current_period_end, p_billing_interval,
    p_unit_amount, p_event_created_at, now()
  )
  on conflict (email) do update set
    plan = excluded.plan,
    status = excluded.status,
    stripe_customer_id = excluded.stripe_customer_id,
    stripe_subscription_id = excluded.stripe_subscription_id,
    current_period_end = excluded.current_period_end,
    billing_interval = excluded.billing_interval,
    unit_amount = excluded.unit_amount,
    last_stripe_event_created_at = excluded.last_stripe_event_created_at,
    updated_at = now()
  where coalesce(public.memberships.last_stripe_event_created_at, 0)
    <= excluded.last_stripe_event_created_at;
  return found;
end;
$$;

revoke all on function public.sync_membership_from_stripe(
  text, text, text, text, text, timestamptz, text, integer, bigint
) from public, anon, authenticated;
grant execute on function public.sync_membership_from_stripe(
  text, text, text, text, text, timestamptz, text, integer, bigint
) to service_role;
