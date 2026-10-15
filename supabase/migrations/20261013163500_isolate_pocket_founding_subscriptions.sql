-- A canceled Pocket subscription must never forfeit a different active
-- subscription merely because both were bought with the same email address.
create or replace function public.sync_pocket_founding_650(
  p_email text,
  p_stripe_customer_id text,
  p_stripe_subscription_id text,
  p_subscription_active boolean,
  p_current_period_end timestamptz,
  p_event_created_at bigint
)
returns table(outcome text, awarded_position smallint, award_status text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  normalized_email text := lower(trim(coalesce(p_email, '')));
  existing public.pocket_founding_members%rowtype;
  exact_subscription_match boolean := false;
  next_position integer;
begin
  if length(normalized_email) not between 3 and 254
    or length(coalesce(p_stripe_customer_id, '')) not between 3 and 255
    or length(coalesce(p_stripe_subscription_id, '')) not between 3 and 255
    or p_event_created_at <= 0 then
    raise exception 'invalid_pocket_founding_input';
  end if;

  perform pg_advisory_xact_lock(hashtext('pocket_founding_650'));

  select * into existing
  from public.pocket_founding_members
  where stripe_subscription_id = p_stripe_subscription_id
  for update;

  if found then
    exact_subscription_match := true;
  else
    select * into existing
    from public.pocket_founding_members
    where email = normalized_email
    for update;
  end if;

  if found then
    if not exact_subscription_match then
      return query select
        case when p_subscription_active then 'duplicate_active_ignored' else 'unrelated_cancellation_ignored' end,
        existing.position,
        existing.status;
      return;
    end if;

    if existing.last_event_created_at > p_event_created_at then
      return query select 'stale_ignored', existing.position, existing.status;
      return;
    end if;

    if not p_subscription_active then
      update public.pocket_founding_members
      set status = 'forfeited',
          price_lock_active = false,
          forfeited_at = coalesce(forfeited_at, now()),
          current_period_end = p_current_period_end,
          last_event_created_at = p_event_created_at,
          updated_at = now()
      where position = existing.position;
      return query select 'forfeited', existing.position, 'forfeited';
      return;
    end if;

    if existing.status = 'forfeited' then
      return query select 'ineligible_lapsed', existing.position, existing.status;
      return;
    end if;

    update public.pocket_founding_members
    set current_period_end = p_current_period_end,
        last_event_created_at = p_event_created_at,
        updated_at = now()
    where position = existing.position;
    return query select 'already_awarded', existing.position, existing.status;
    return;
  end if;

  if not p_subscription_active then
    return query select 'not_awarded', null::smallint, null::text;
    return;
  end if;

  select coalesce(max(position), 0) + 1
  into next_position
  from public.pocket_founding_members;

  if next_position > 650 then
    return query select 'capacity_reached', null::smallint, null::text;
    return;
  end if;

  insert into public.pocket_founding_members(
    position, email, stripe_customer_id, stripe_subscription_id,
    current_period_end, last_event_created_at
  ) values (
    next_position, normalized_email, p_stripe_customer_id,
    p_stripe_subscription_id, p_current_period_end, p_event_created_at
  );
  return query select 'awarded', next_position::smallint, 'active';
end;
$$;

revoke all on function public.sync_pocket_founding_650(text,text,text,boolean,timestamptz,bigint)
  from public, anon, authenticated;
grant execute on function public.sync_pocket_founding_650(text,text,text,boolean,timestamptz,bigint)
  to service_role;
