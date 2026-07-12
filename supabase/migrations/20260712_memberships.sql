create table if not exists public.memberships (
 id uuid primary key default gen_random_uuid(), email text not null unique,
 plan text not null check (plan in ('pro','elite')), status text not null default 'active',
 stripe_customer_id text unique, stripe_subscription_id text unique,
 current_period_end timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.memberships enable row level security;
drop policy if exists "Members can read own membership" on public.memberships;
create policy "Members can read own membership" on public.memberships for select to authenticated
using (lower(email)=lower(coalesce(auth.jwt()->>'email','')));
insert into public.memberships(email,plan,status) values('c.j.nash@outlook.com','elite','active')
on conflict(email) do update set plan=excluded.plan,status=excluded.status,updated_at=now();
