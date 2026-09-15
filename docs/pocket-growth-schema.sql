-- Apply with Supabase's named migration API: pocket_growth_daily.
-- Daily totals only. No identifiers, individual event history, images or prices.
create table public.pocket_growth_daily (
  day date not null,
  event text not null check (event in ('introduction_viewed','app_opened','sample_viewed','app_store_clicked','chart_uploaded','scan_started','scan_completed','scan_failed','paywall_viewed','purchase_started','purchase_completed','purchase_incomplete','purchase_failed','restore_completed')),
  platform text not null check (platform in ('web','apple')),
  source text not null check (source in ('direct','instagram','tiktok','x','youtube','snapchat','linkedin','tipseason','launchingnext','aisuperhub','aitools','insidr','macstories','appadvice','newsletter','other')),
  campaign text not null check (campaign in ('discovery','first10','founding650','directory','other')),
  flow text not null check (flow in ('browse','sample','web','free','paid')),
  is_test boolean not null default false,
  event_count bigint not null default 0 check (event_count >= 0),
  duration_total_ms bigint not null default 0 check (duration_total_ms >= 0),
  primary key (day,event,platform,source,campaign,flow,is_test)
);
alter table public.pocket_growth_daily enable row level security;
revoke all on public.pocket_growth_daily from public, anon, authenticated;
grant select, insert, update on public.pocket_growth_daily to service_role;
comment on table public.pocket_growth_daily is 'Server-only anonymous daily activity totals; no people/device/session identifiers. Test events remain separate. Counts are not unique users or authoritative Apple sales.';

create function public.record_pocket_growth_event(p_event text,p_platform text,p_source text,p_campaign text,p_flow text,p_is_test boolean,p_duration_ms integer)
returns void language sql security invoker set search_path = '' as $$
  insert into public.pocket_growth_daily(day,event,platform,source,campaign,flow,is_test,event_count,duration_total_ms)
  values ((now() at time zone 'UTC')::date,p_event,p_platform,p_source,p_campaign,p_flow,p_is_test,1,greatest(0,least(600000,p_duration_ms)))
  on conflict (day,event,platform,source,campaign,flow,is_test) do update
  set event_count = public.pocket_growth_daily.event_count + 1,
      duration_total_ms = public.pocket_growth_daily.duration_total_ms + excluded.duration_total_ms;
$$;
revoke all on function public.record_pocket_growth_event(text,text,text,text,text,boolean,integer) from public,anon,authenticated;
grant execute on function public.record_pocket_growth_event(text,text,text,text,text,boolean,integer) to service_role;

create function public.pocket_growth_report(p_from date)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'events', coalesce((select jsonb_agg(e) from (
      select event,platform,flow,sum(event_count) as total,
        case when sum(event_count)>0 then round(sum(duration_total_ms)::numeric/sum(event_count)) else 0 end as average_ms
      from public.pocket_growth_daily where day >= p_from and not is_test
      group by event,platform,flow order by event,platform,flow
    ) e), '[]'::jsonb),
    'sources', coalesce((select jsonb_agg(s) from (
      select source,campaign,
        coalesce(sum(event_count) filter (where event='introduction_viewed'),0) as views,
        coalesce(sum(event_count) filter (where event='sample_viewed'),0) as samples,
        coalesce(sum(event_count) filter (where event='app_store_clicked'),0) as app_store_clicks
      from public.pocket_growth_daily where day >= p_from and not is_test
      group by source,campaign order by source,campaign
    ) s), '[]'::jsonb)
  );
$$;
revoke all on function public.pocket_growth_report(date) from public,anon,authenticated;
grant execute on function public.pocket_growth_report(date) to service_role;
