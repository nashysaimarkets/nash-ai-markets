-- Current paid access is separate from permanent founding-place awards.
create schema if not exists private;
create table private.pocket_web_subscriptions (
  stripe_subscription_id text primary key check (length(stripe_subscription_id) between 3 and 255),
  email text check (email = lower(trim(email)) and length(email) between 3 and 254),
  active boolean not null,
  current_period_end timestamptz,
  last_event_created_at bigint not null check (last_event_created_at > 0),
  updated_at timestamptz not null default now(),
  check (not active or (email is not null and current_period_end is not null))
);
create index pocket_web_subscriptions_access_idx on private.pocket_web_subscriptions(email,current_period_end) where active;
alter table private.pocket_web_subscriptions enable row level security;
revoke all on private.pocket_web_subscriptions from public,anon,authenticated,service_role;

create function private.sync_pocket_web_subscription(p_email text,p_stripe_customer_id text,p_stripe_subscription_id text,p_subscription_active boolean,p_current_period_end timestamptz,p_event_created_at bigint)
returns void language plpgsql security definer set search_path='' as $$
declare affected integer;
begin
 if p_subscription_active is null or p_event_created_at is null or p_event_created_at <= 0 or length(coalesce(p_email,'')) not between 3 and 254 or length(coalesce(p_stripe_customer_id,'')) not between 3 and 255 or length(coalesce(p_stripe_subscription_id,'')) not between 3 and 255 or (p_subscription_active and p_current_period_end is null) then raise exception 'invalid_pocket_subscription'; end if;
 insert into private.pocket_web_subscriptions(stripe_subscription_id,email,active,current_period_end,last_event_created_at)
 values(p_stripe_subscription_id,lower(trim(p_email)),p_subscription_active,p_current_period_end,p_event_created_at)
 on conflict(stripe_subscription_id) do update set email=excluded.email,active=excluded.active,current_period_end=excluded.current_period_end,last_event_created_at=excluded.last_event_created_at,updated_at=now()
 where excluded.last_event_created_at > pocket_web_subscriptions.last_event_created_at
 or (excluded.last_event_created_at = pocket_web_subscriptions.last_event_created_at and not excluded.active and pocket_web_subscriptions.active);
 get diagnostics affected = row_count;
 -- Stale/idempotent events cannot change permanent awards either.
 if affected = 0 then return; end if;
 -- Award synchronization and current entitlement succeed or roll back together.
 perform public.sync_pocket_founding_650(p_email,p_stripe_customer_id,p_stripe_subscription_id,p_subscription_active,p_current_period_end,p_event_created_at);
end $$;

create function private.revoke_pocket_web_subscription(p_stripe_subscription_id text,p_event_created_at bigint)
returns void language plpgsql security definer set search_path='' as $$
begin
 if p_event_created_at is null or p_event_created_at <= 0 or length(coalesce(p_stripe_subscription_id,'')) not between 3 and 255 then raise exception 'invalid_pocket_subscription'; end if;
 -- Tombstones prevent a late older activation after a cancellation/payment failure.
 insert into private.pocket_web_subscriptions(stripe_subscription_id,active,last_event_created_at)
 values(p_stripe_subscription_id,false,p_event_created_at)
 on conflict(stripe_subscription_id) do update set active=false,last_event_created_at=excluded.last_event_created_at,updated_at=now()
 where excluded.last_event_created_at >= pocket_web_subscriptions.last_event_created_at;
 update public.pocket_founding_members set status='forfeited',price_lock_active=false,forfeited_at=coalesce(forfeited_at,now()),last_event_created_at=p_event_created_at,updated_at=now()
 where stripe_subscription_id=p_stripe_subscription_id and last_event_created_at <= p_event_created_at;
end $$;

create function private.has_pocket_web_subscription(p_email text)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from private.pocket_web_subscriptions where email=lower(trim(p_email)) and active and current_period_end > now())
$$;

create function public.sync_pocket_web_subscription(p_email text,p_stripe_customer_id text,p_stripe_subscription_id text,p_subscription_active boolean,p_current_period_end timestamptz,p_event_created_at bigint)
returns void language sql security invoker set search_path='' as $$ select private.sync_pocket_web_subscription(p_email,p_stripe_customer_id,p_stripe_subscription_id,p_subscription_active,p_current_period_end,p_event_created_at) $$;
create function public.revoke_pocket_web_subscription(p_stripe_subscription_id text,p_event_created_at bigint)
returns void language sql security invoker set search_path='' as $$ select private.revoke_pocket_web_subscription(p_stripe_subscription_id,p_event_created_at) $$;
create function public.has_pocket_web_subscription(p_email text)
returns boolean language sql stable security invoker set search_path='' as $$ select private.has_pocket_web_subscription(p_email) $$;

revoke all on function private.sync_pocket_web_subscription(text,text,text,boolean,timestamptz,bigint),public.sync_pocket_web_subscription(text,text,text,boolean,timestamptz,bigint),private.revoke_pocket_web_subscription(text,bigint),public.revoke_pocket_web_subscription(text,bigint),private.has_pocket_web_subscription(text),public.has_pocket_web_subscription(text) from public,anon,authenticated;
grant usage on schema private to service_role;
grant execute on function private.sync_pocket_web_subscription(text,text,text,boolean,timestamptz,bigint),public.sync_pocket_web_subscription(text,text,text,boolean,timestamptz,bigint),private.revoke_pocket_web_subscription(text,bigint),public.revoke_pocket_web_subscription(text,bigint),private.has_pocket_web_subscription(text),public.has_pocket_web_subscription(text) to service_role;
