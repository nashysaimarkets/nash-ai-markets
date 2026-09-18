create table if not exists public.apple_subscription_events (
  notification_uuid text primary key check (length(notification_uuid) between 3 and 255),
  notification_type text not null check (length(notification_type) between 1 and 80),
  subtype text check (subtype is null or length(subtype) between 1 and 80),
  environment text not null check (environment in ('Production', 'Sandbox', 'Xcode', 'LocalTesting', 'UNKNOWN')),
  bundle_id text not null check (length(bundle_id) between 3 and 255),
  product_id text check (product_id is null or length(product_id) between 1 and 255),
  transaction_id text check (transaction_id is null or length(transaction_id) between 3 and 255),
  original_transaction_id text check (original_transaction_id is null or length(original_transaction_id) between 3 and 255),
  app_account_token uuid,
  purchase_date timestamptz,
  expires_date timestamptz,
  signed_date timestamptz,
  is_initial_purchase boolean not null default false,
  owner_alert_sent_at timestamptz,
  owner_alert_error text check (owner_alert_error is null or length(owner_alert_error) <= 255),
  received_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists apple_subscription_events_transaction_key
  on public.apple_subscription_events(transaction_id)
  where transaction_id is not null;

create index if not exists apple_subscription_events_original_transaction_idx
  on public.apple_subscription_events(original_transaction_id, received_at desc)
  where original_transaction_id is not null;

alter table public.apple_subscription_events enable row level security;
revoke all on table public.apple_subscription_events from anon, authenticated;
grant all on table public.apple_subscription_events to service_role;

comment on table public.apple_subscription_events is
  'Private, service-role-only ledger of cryptographically verified App Store Server Notifications V2 events.';
