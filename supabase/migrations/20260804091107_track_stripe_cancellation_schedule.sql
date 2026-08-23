alter table public.memberships
  add column if not exists cancel_at_period_end boolean not null default false;

comment on column public.memberships.cancel_at_period_end is
  'Stripe subscription is scheduled to cancel when current_period_end is reached.';

create or replace function public.sync_membership_cancellation_from_stripe(
  p_stripe_subscription_id text,
  p_cancel_at_period_end boolean,
  p_event_created_at bigint
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_event_created_at <= 0 or length(p_stripe_subscription_id) < 3 then
    raise exception 'invalid_membership_cancellation_sync_input';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_stripe_subscription_id, 0));

  update public.memberships set
    cancel_at_period_end = p_cancel_at_period_end,
    last_stripe_event_created_at = p_event_created_at,
    updated_at = now()
  where stripe_subscription_id = p_stripe_subscription_id
    and coalesce(last_stripe_event_created_at, 0) <= p_event_created_at;

  return found;
end;
$$;

revoke all on function public.sync_membership_cancellation_from_stripe(
  text, boolean, bigint
) from public, anon, authenticated;
grant execute on function public.sync_membership_cancellation_from_stripe(
  text, boolean, bigint
) to service_role;
