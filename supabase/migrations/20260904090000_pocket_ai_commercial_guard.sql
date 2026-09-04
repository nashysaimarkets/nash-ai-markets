create table if not exists public.pocket_ai_monthly_usage (
  subject_hash text not null check (subject_hash = '__global__' or subject_hash ~ '^[a-f0-9]{64}$'),
  month_start date not null,
  analysis_count integer not null default 0 check (analysis_count >= 0),
  updated_at timestamptz not null default now(),
  primary key (subject_hash, month_start)
);

create table if not exists public.pocket_ai_response_cache (
  cache_key text primary key check (cache_key ~ '^[a-f0-9]{64}$'),
  kind text not null check (kind in ('analysis', 'preflight')),
  response jsonb not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  last_accessed_at timestamptz not null default now()
);

create index if not exists pocket_ai_response_cache_expiry_idx
  on public.pocket_ai_response_cache (expires_at);

create table if not exists public.pocket_ai_usage_events (
  id bigint generated always as identity primary key,
  request_id uuid not null,
  subject_hash text not null check (subject_hash ~ '^[a-f0-9]{64}$'),
  stage text not null check (stage in ('preflight', 'report', 'precision', 'precision_rescue', 'level_lab', 'review', 'follow_up', 'cache')),
  model text not null,
  input_tokens integer check (input_tokens is null or input_tokens >= 0),
  output_tokens integer check (output_tokens is null or output_tokens >= 0),
  total_tokens integer check (total_tokens is null or total_tokens >= 0),
  cache_hit boolean not null default false,
  outcome text not null check (outcome in ('success', 'failed', 'cache_hit')),
  created_at timestamptz not null default now()
);

create index if not exists pocket_ai_usage_events_created_idx
  on public.pocket_ai_usage_events (created_at desc);
create index if not exists pocket_ai_usage_events_request_idx
  on public.pocket_ai_usage_events (request_id);

alter table public.pocket_ai_monthly_usage enable row level security;
alter table public.pocket_ai_response_cache enable row level security;
alter table public.pocket_ai_usage_events enable row level security;

revoke all on table public.pocket_ai_monthly_usage from public, anon, authenticated;
revoke all on table public.pocket_ai_response_cache from public, anon, authenticated;
revoke all on table public.pocket_ai_usage_events from public, anon, authenticated;
grant select, insert, update, delete on table public.pocket_ai_monthly_usage to service_role;
grant select, insert, update, delete on table public.pocket_ai_response_cache to service_role;
grant select, insert on table public.pocket_ai_usage_events to service_role;
grant usage, select on sequence public.pocket_ai_usage_events_id_seq to service_role;

create or replace function public.reserve_pocket_ai_analysis(
  p_subject_hash text,
  p_subject_limit integer,
  p_global_limit integer
)
returns table (
  allowed boolean,
  used_count integer,
  remaining_count integer,
  reset_at timestamptz,
  denial_reason text
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_month date := date_trunc('month', now() at time zone 'utc')::date;
  v_used integer := 0;
  v_global integer := 0;
begin
  if p_subject_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'invalid Pocket subject hash';
  end if;
  if p_subject_limit < 0 or p_global_limit < 0 then
    raise exception 'invalid Pocket allowance limit';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('pocket-ai:' || v_month::text, 0));
  select analysis_count into v_used from public.pocket_ai_monthly_usage where subject_hash = p_subject_hash and month_start = v_month;
  select analysis_count into v_global from public.pocket_ai_monthly_usage where subject_hash = '__global__' and month_start = v_month;
  v_used := coalesce(v_used, 0);
  v_global := coalesce(v_global, 0);

  if p_global_limit > 0 and v_global >= p_global_limit then
    return query select false, v_used, greatest(p_subject_limit - v_used, 0), (v_month + interval '1 month') at time zone 'utc', 'global_limit'::text;
    return;
  end if;
  if p_subject_limit > 0 and v_used >= p_subject_limit then
    return query select false, v_used, 0, (v_month + interval '1 month') at time zone 'utc', 'customer_limit'::text;
    return;
  end if;

  insert into public.pocket_ai_monthly_usage (subject_hash, month_start, analysis_count)
  values (p_subject_hash, v_month, 1)
  on conflict (subject_hash, month_start) do update
    set analysis_count = public.pocket_ai_monthly_usage.analysis_count + 1, updated_at = now();
  insert into public.pocket_ai_monthly_usage (subject_hash, month_start, analysis_count)
  values ('__global__', v_month, 1)
  on conflict (subject_hash, month_start) do update
    set analysis_count = public.pocket_ai_monthly_usage.analysis_count + 1, updated_at = now();

  v_used := v_used + 1;
  return query select true, v_used, case when p_subject_limit > 0 then greatest(p_subject_limit - v_used, 0) else 0 end,
    (v_month + interval '1 month') at time zone 'utc', null::text;
end;
$$;

create or replace function public.release_pocket_ai_analysis(p_subject_hash text)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_month date := date_trunc('month', now() at time zone 'utc')::date;
begin
  if p_subject_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'invalid Pocket subject hash';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('pocket-ai:' || v_month::text, 0));
  update public.pocket_ai_monthly_usage set analysis_count = greatest(analysis_count - 1, 0), updated_at = now()
    where subject_hash = p_subject_hash and month_start = v_month;
  update public.pocket_ai_monthly_usage set analysis_count = greatest(analysis_count - 1, 0), updated_at = now()
    where subject_hash = '__global__' and month_start = v_month;
end;
$$;

revoke execute on function public.reserve_pocket_ai_analysis(text, integer, integer) from public, anon, authenticated;
revoke execute on function public.release_pocket_ai_analysis(text) from public, anon, authenticated;
grant execute on function public.reserve_pocket_ai_analysis(text, integer, integer) to service_role;
grant execute on function public.release_pocket_ai_analysis(text) to service_role;

comment on table public.pocket_ai_monthly_usage is 'Privacy-preserving monthly Pocket AI allowance counters; stores only salted subject hashes.';
comment on table public.pocket_ai_response_cache is 'Short-lived structured AI responses keyed by a one-way hash; uploaded chart images are never stored.';
comment on table public.pocket_ai_usage_events is 'Server-only model and token telemetry for Pocket AI commercial cost control.';
