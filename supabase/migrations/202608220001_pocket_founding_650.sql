create table if not exists public.pocket_founding_members (
  position smallint primary key check (position between 1 and 650), email text not null unique check (email=lower(trim(email)) and length(email) between 3 and 254),
  stripe_customer_id text not null check (length(stripe_customer_id) between 3 and 255), stripe_subscription_id text not null unique check (length(stripe_subscription_id) between 3 and 255),
  status text not null default 'active' check (status in ('active','forfeited')), price_lock_active boolean not null default true,
  earned_at timestamptz not null default now(), forfeited_at timestamptz, current_period_end timestamptz,
  last_event_created_at bigint not null check (last_event_created_at>0), updated_at timestamptz not null default now(),
  check ((status='active' and price_lock_active and forfeited_at is null) or (status='forfeited' and not price_lock_active and forfeited_at is not null))
);
alter table public.pocket_founding_members enable row level security;
create index if not exists pocket_founding_members_status_idx on public.pocket_founding_members(status,position);
comment on table public.pocket_founding_members is 'Server-managed Pocket Bullseye Founding 650 awards. Positions are permanent and never reused after forfeiture.';
create or replace function public.sync_pocket_founding_650(p_email text,p_stripe_customer_id text,p_stripe_subscription_id text,p_subscription_active boolean,p_current_period_end timestamptz,p_event_created_at bigint)
returns table(outcome text,awarded_position smallint,award_status text) language plpgsql security definer set search_path=public,pg_temp as $$
declare normalized_email text:=lower(trim(coalesce(p_email,''))); existing public.pocket_founding_members%rowtype; next_position integer;
begin
 if length(normalized_email) not between 3 and 254 or length(coalesce(p_stripe_customer_id,'')) not between 3 and 255 or length(coalesce(p_stripe_subscription_id,'')) not between 3 and 255 or p_event_created_at<=0 then raise exception 'invalid_pocket_founding_input'; end if;
 perform pg_advisory_xact_lock(hashtext('pocket_founding_650'));
 select * into existing from public.pocket_founding_members where email=normalized_email or stripe_subscription_id=p_stripe_subscription_id for update;
 if found then
  if existing.last_event_created_at>p_event_created_at then return query select 'stale_ignored',existing.position,existing.status; return; end if;
  if not p_subscription_active then update public.pocket_founding_members set status='forfeited',price_lock_active=false,forfeited_at=coalesce(forfeited_at,now()),current_period_end=p_current_period_end,last_event_created_at=p_event_created_at,updated_at=now() where position=existing.position; return query select 'forfeited',existing.position,'forfeited'; return; end if;
  if existing.status='forfeited' then return query select 'ineligible_lapsed',existing.position,existing.status; return; end if;
  update public.pocket_founding_members set current_period_end=p_current_period_end,last_event_created_at=p_event_created_at,updated_at=now() where position=existing.position;
  return query select 'already_awarded',existing.position,existing.status; return;
 end if;
 if not p_subscription_active then return query select 'not_awarded',null::smallint,null::text; return; end if;
 select coalesce(max(position),0)+1 into next_position from public.pocket_founding_members;
 if next_position>650 then return query select 'capacity_reached',null::smallint,null::text; return; end if;
 insert into public.pocket_founding_members(position,email,stripe_customer_id,stripe_subscription_id,current_period_end,last_event_created_at) values(next_position,normalized_email,p_stripe_customer_id,p_stripe_subscription_id,p_current_period_end,p_event_created_at);
 return query select 'awarded',next_position::smallint,'active';
end; $$;
revoke all on function public.sync_pocket_founding_650(text,text,text,boolean,timestamptz,bigint) from public,anon,authenticated;
grant execute on function public.sync_pocket_founding_650(text,text,text,boolean,timestamptz,bigint) to service_role;
