-- Additive personal trading workspace preferences.
-- Do NOT apply to production automatically. Follow docs/SUPABASE_MIGRATION_RUNBOOK.md.
-- Own-row RLS only. Does not alter memberships, auth, Stripe, or onboarding tables.

create table if not exists public.member_workspace_prefs (
  user_id uuid primary key references auth.users(id) on delete cascade,
  favourites text[] not null,
  primary_instrument text not null,
  active_instrument text not null,
  chart_timeframe text not null default '5m',
  widgets jsonb not null default '[]'::jsonb,
  preset text not null default 'custom',
  notes text not null default '',
  checklist text[] not null default '{}',
  dismissed_onboarding boolean not null default false,
  last_workspace_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint member_workspace_prefs_favourites_len check (
    cardinality(favourites) between 1 and 12
  ),
  constraint member_workspace_prefs_timeframe check (
    chart_timeframe in ('1m', '5m', '15m', '1h', '4h', '1d')
  )
);

alter table public.member_workspace_prefs enable row level security;

drop policy if exists "members manage own workspace prefs" on public.member_workspace_prefs;
create policy "members manage own workspace prefs" on public.member_workspace_prefs
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create or replace function public.save_member_workspace_prefs(
  p_favourites text[],
  p_primary_instrument text,
  p_active_instrument text,
  p_chart_timeframe text,
  p_widgets jsonb,
  p_preset text,
  p_notes text,
  p_checklist text[],
  p_dismissed_onboarding boolean
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_allowed text[] := array[
    'ES','NQ','YM','RTY','GC','SI','CL','BTC','EURUSD','GBPUSD',
    'FTSE','DAX','NIKKEI','VIX','DXY','QQQ','US10Y','US2Y','OIL'
  ];
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if cardinality(p_favourites) not between 1 and 12
    or p_chart_timeframe not in ('1m', '5m', '15m', '1h', '4h', '1d')
    or p_primary_instrument is null
    or p_active_instrument is null
    or not (p_primary_instrument = any (p_favourites))
    or not (p_active_instrument = any (p_favourites))
    or exists (
      select 1
      from unnest(p_favourites) as fav
      where not (fav = any (v_allowed))
    )
    or jsonb_typeof(coalesce(p_widgets, '[]'::jsonb)) <> 'array'
    or char_length(coalesce(p_notes, '')) > 4000
    or cardinality(coalesce(p_checklist, '{}')) > 20
  then
    raise exception 'Invalid workspace preferences' using errcode = '22023';
  end if;

  insert into public.member_workspace_prefs (
    user_id,
    favourites,
    primary_instrument,
    active_instrument,
    chart_timeframe,
    widgets,
    preset,
    notes,
    checklist,
    dismissed_onboarding,
    last_workspace_at,
    updated_at
  )
  values (
    v_user_id,
    p_favourites,
    p_primary_instrument,
    p_active_instrument,
    p_chart_timeframe,
    coalesce(p_widgets, '[]'::jsonb),
    coalesce(nullif(p_preset, ''), 'custom'),
    coalesce(p_notes, ''),
    coalesce(p_checklist, '{}'),
    coalesce(p_dismissed_onboarding, false),
    now(),
    now()
  )
  on conflict (user_id) do update set
    favourites = excluded.favourites,
    primary_instrument = excluded.primary_instrument,
    active_instrument = excluded.active_instrument,
    chart_timeframe = excluded.chart_timeframe,
    widgets = excluded.widgets,
    preset = excluded.preset,
    notes = excluded.notes,
    checklist = excluded.checklist,
    dismissed_onboarding = excluded.dismissed_onboarding,
    last_workspace_at = excluded.last_workspace_at,
    updated_at = excluded.updated_at;
end;
$$;

revoke all on function public.save_member_workspace_prefs(
  text[], text, text, text, jsonb, text, text, text[], boolean
) from public;
grant execute on function public.save_member_workspace_prefs(
  text[], text, text, text, jsonb, text, text, text[], boolean
) to authenticated;

-- Rollback (staging only; do not run casually in production):
-- drop function if exists public.save_member_workspace_prefs(text[], text, text, text, jsonb, text, text, text[], boolean);
-- drop policy if exists "members manage own workspace prefs" on public.member_workspace_prefs;
-- drop table if exists public.member_workspace_prefs;
