create table if not exists public.marketing_visits (
  id bigint generated always as identity primary key,
  visitor_key uuid not null,
  source text not null check (source in ('instagram','tiktok','x','youtube','linkedin','direct')),
  medium text not null check (medium ~ '^[a-z0-9][a-z0-9_-]{0,63}$'),
  campaign text not null check (campaign ~ '^[a-z0-9][a-z0-9_-]{0,63}$'),
  landing_path text not null check (landing_path = '/pocket/founding'),
  created_at timestamptz not null default now(),
  unique (visitor_key, source, campaign)
);

alter table public.marketing_visits enable row level security;
revoke all on table public.marketing_visits from public, anon, authenticated;
grant select, insert on table public.marketing_visits to service_role;
grant usage, select on sequence public.marketing_visits_id_seq to service_role;

create index if not exists marketing_visits_campaign_source_created_idx
  on public.marketing_visits (campaign, source, created_at desc);

comment on table public.marketing_visits is
  'Server-managed, privacy-light campaign attribution. Stores a random browser key and UTM labels only; no IP, user agent or personal identity.';
