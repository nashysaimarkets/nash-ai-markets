alter table public.memberships
  add column if not exists billing_interval text
    check (billing_interval is null or billing_interval in ('month', 'year')),
  add column if not exists unit_amount integer
    check (unit_amount is null or unit_amount >= 0);

create index if not exists memberships_commercial_reporting_idx
  on public.memberships (plan, status, billing_interval);

comment on column public.memberships.billing_interval is
  'Stripe recurring interval synchronized by signed webhooks.';
comment on column public.memberships.unit_amount is
  'Stripe recurring unit amount in the smallest currency unit; server-managed.';
