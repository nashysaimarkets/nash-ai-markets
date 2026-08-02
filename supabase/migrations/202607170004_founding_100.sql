create table if not exists public.founding_100_members (
  programme text not null check (programme in ('pro', 'elite')),
  position smallint not null check (position between 1 and 100),
  email text not null check (email = lower(trim(email)) and length(email) between 3 and 254),
  stripe_subscription_id text not null check (length(stripe_subscription_id) between 3 and 255),
  status text not null default 'active' check (status in ('active', 'forfeited')),
  price_lock_active boolean not null default true,
  earned_at timestamptz not null default now(),
  forfeited_at timestamptz,
  last_event_created_at bigint not null check (last_event_created_at > 0),
  updated_at timestamptz not null default now(),
  primary key (programme, position),
  unique (programme, email),
  unique (programme, stripe_subscription_id),
  check (
    (status = 'active' and price_lock_active and forfeited_at is null)
    or
    (status = 'forfeited' and not price_lock_active and forfeited_at is not null)
  )
);

create index if not exists founding_100_members_email_idx
  on public.founding_100_members (email);

create index if not exists founding_100_members_status_idx
  on public.founding_100_members (programme, status, position);

alter table public.founding_100_members enable row level security;

comment on table public.founding_100_members is
  'Server-managed Founding 100 awards. No client policies. Positions are never reused after forfeiture.';

create or replace function public.sync_founding_100(
  p_email text,
  p_programme text,
  p_stripe_subscription_id text,
  p_subscription_active boolean,
  p_event_created_at bigint
)
returns table (
  outcome text,
  awarded_programme text,
  awarded_position smallint,
  award_status text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  normalized_email text := lower(trim(coalesce(p_email, '')));
  existing public.founding_100_members%rowtype;
  next_position integer;
  changed boolean;
begin
  if (p_subscription_active and length(normalized_email) not between 3 and 254)
    or length(p_stripe_subscription_id) not between 3 and 255
    or p_event_created_at <= 0
    or (p_subscription_active and (p_programme is null or p_programme not in ('pro', 'elite')))
    or (not p_subscription_active and p_programme is not null and p_programme not in ('pro', 'elite'))
  then
    raise exception 'invalid_founding_100_input';
  end if;

  perform pg_advisory_xact_lock(hashtext('founding_100:' || coalesce(p_programme, 'inactive')));

  if not p_subscription_active then
    update public.founding_100_members
      set status = 'forfeited',
          price_lock_active = false,
          forfeited_at = now(),
          last_event_created_at = p_event_created_at,
          updated_at = now()
      where stripe_subscription_id = p_stripe_subscription_id
        and status = 'active'
        and last_event_created_at <= p_event_created_at;
    changed := found;

    return query select
      case when changed then 'forfeited' else 'stale_or_not_awarded' end,
      null::text,
      null::smallint,
      null::text;
    return;
  end if;

  update public.founding_100_members
    set status = 'forfeited',
        price_lock_active = false,
        forfeited_at = now(),
        last_event_created_at = p_event_created_at,
        updated_at = now()
    where stripe_subscription_id = p_stripe_subscription_id
      and programme <> p_programme
      and status = 'active'
      and last_event_created_at <= p_event_created_at;

  select * into existing
    from public.founding_100_members
    where programme = p_programme
      and (email = normalized_email or stripe_subscription_id = p_stripe_subscription_id)
    for update;

  if found then
    if existing.last_event_created_at > p_event_created_at then
      return query select 'stale_ignored', existing.programme, existing.position, existing.status;
    elsif existing.status = 'forfeited' then
      return query select 'ineligible_lapsed', existing.programme, existing.position, existing.status;
    else
      update public.founding_100_members
        set last_event_created_at = p_event_created_at,
            updated_at = now()
        where programme = existing.programme and position = existing.position;
      return query select 'already_awarded', existing.programme, existing.position, existing.status;
    end if;
    return;
  end if;

  select coalesce(max(position), 0) + 1 into next_position
    from public.founding_100_members
    where programme = p_programme;

  if next_position > 100 then
    return query select 'capacity_reached', p_programme, null::smallint, null::text;
    return;
  end if;

  insert into public.founding_100_members (
    programme,
    position,
    email,
    stripe_subscription_id,
    status,
    price_lock_active,
    last_event_created_at
  ) values (
    p_programme,
    next_position,
    normalized_email,
    p_stripe_subscription_id,
    'active',
    true,
    p_event_created_at
  );

  return query select 'awarded', p_programme, next_position::smallint, 'active';
end;
$$;

revoke all on function public.sync_founding_100(text, text, text, boolean, bigint) from public;
grant execute on function public.sync_founding_100(text, text, text, boolean, bigint) to service_role;

comment on function public.sync_founding_100(text, text, text, boolean, bigint) is
  'Atomically awards one of 100 permanent programme positions or forfeits its active price lock after cancellation/lapse.';
