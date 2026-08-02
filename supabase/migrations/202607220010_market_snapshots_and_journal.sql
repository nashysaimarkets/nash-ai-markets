-- Market analysis snapshots (immutable after insert) + member trade journal.
-- Safe / reversible: drop policies + tables to roll back.

create extension if not exists pgcrypto;

create table if not exists public.market_analysis_snapshots (
  id uuid primary key default gen_random_uuid(),
  session_date date not null,
  kind text not null check (kind in ('morning', 'refresh', 'close', 'provider_change')),
  content_hash text not null,
  methodology_version text not null,
  data_quality text not null check (data_quality in ('live', 'delayed', 'stale', 'unavailable', 'partial')),
  provider_health text not null,
  bullseye_score integer,
  posture text,
  risk_rating text,
  trade_permission text,
  volatility_regime text,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  constraint market_analysis_snapshots_hash_unique unique (session_date, kind, content_hash)
);

create index if not exists market_analysis_snapshots_session_idx
  on public.market_analysis_snapshots (session_date desc, created_at desc);
create index if not exists market_analysis_snapshots_score_idx
  on public.market_analysis_snapshots (bullseye_score);

comment on table public.market_analysis_snapshots is
  'Immutable verified analysis snapshots. Never reconstructed retrospectively. Insert-only.';

alter table public.market_analysis_snapshots enable row level security;

create policy "authenticated read market snapshots"
  on public.market_analysis_snapshots
  for select
  to authenticated
  using (true);

-- Inserts are server-managed via service role (no authenticated insert policy).

create table if not exists public.member_trade_journal (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  traded_at timestamptz not null,
  instrument_class text not null check (instrument_class in ('futures', 'options')),
  underlying text not null check (char_length(underlying) between 1 and 32),
  direction text not null check (direction in ('long', 'short', 'neutral')),
  entry_price numeric,
  stop_price numeric,
  target_price numeric,
  position_size text,
  options_strategy text,
  expiry text,
  strikes text,
  planned_max_risk text,
  exit_price numeric,
  pnl numeric,
  notes text check (notes is null or char_length(notes) <= 4000),
  reason text check (reason is null or char_length(reason) <= 1000),
  emotion text check (emotion is null or char_length(emotion) <= 80),
  followed_plan boolean,
  respected_confirmation boolean,
  respected_invalidation boolean,
  event_exposure text,
  lesson text check (lesson is null or char_length(lesson) <= 2000),
  bullseye_score integer,
  vix_regime text,
  privacy text not null default 'private' check (privacy in ('private')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists member_trade_journal_user_idx
  on public.member_trade_journal (user_id, traded_at desc);

comment on table public.member_trade_journal is
  'Per-user manual trade journal. Never inferred from brokerage feeds.';

alter table public.member_trade_journal enable row level security;

create policy "members read own journal"
  on public.member_trade_journal for select to authenticated
  using (user_id = auth.uid());
create policy "members insert own journal"
  on public.member_trade_journal for insert to authenticated
  with check (user_id = auth.uid() and privacy = 'private');
create policy "members update own journal"
  on public.member_trade_journal for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and privacy = 'private');
create policy "members delete own journal"
  on public.member_trade_journal for delete to authenticated
  using (user_id = auth.uid());

grant select on public.market_analysis_snapshots to authenticated;
grant select, insert, update, delete on public.member_trade_journal to authenticated;
