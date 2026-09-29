-- Additive, compatible with earlier clients. Anonymous totals only.
alter table public.pocket_growth_daily drop constraint pocket_growth_daily_event_check;
alter table public.pocket_growth_daily add constraint pocket_growth_daily_event_check check (event in ('introduction_viewed', 'app_opened', 'sample_viewed', 'app_store_clicked', 'chart_uploaded', 'scan_started', 'scan_completed', 'scan_failed', 'paywall_viewed', 'purchase_started', 'purchase_completed', 'purchase_incomplete', 'purchase_failed', 'restore_completed', 'evidence_opened', 'timeframe_opened', 'decision_saved', 'review_started', 'review_completed', 'notebook_opened', 'note_saved', 'backup_exported', 'backup_restored', 'scan_prepared_single', 'scan_prepared_multi', 'scan_response_single', 'scan_response_multi', 'scan_verified_single', 'scan_verified_multi'));
alter table public.pocket_growth_daily drop constraint pocket_growth_daily_campaign_check;
alter table public.pocket_growth_daily add constraint pocket_growth_daily_campaign_check check (campaign in ('discovery', 'first10', 'founding650', 'directory', 'indices', 'forex', 'review', 'other'));
alter table public.pocket_growth_daily add column duration_histogram jsonb not null default '{}'::jsonb;

create or replace function public.record_pocket_growth_event(p_event text,p_platform text,p_source text,p_campaign text,p_flow text,p_is_test boolean,p_duration_ms integer)
returns void language plpgsql security invoker set search_path = '' as $$
declare bounded integer := greatest(0,least(600000,p_duration_ms)); bucket text;
begin
  select min(bound)::text into bucket from unnest(array[100,250,500,1000,2000,5000,10000,20000,40000,60000,90000,120000,180000,300000,600000]) bound where bound >= bounded;
  insert into public.pocket_growth_daily(day,event,platform,source,campaign,flow,is_test,event_count,duration_total_ms,duration_histogram)
  values ((now() at time zone 'UTC')::date,p_event,p_platform,p_source,p_campaign,p_flow,p_is_test,1,bounded,case when bounded>0 then jsonb_build_object(bucket,1) else '{}'::jsonb end)
  on conflict (day,event,platform,source,campaign,flow,is_test) do update
  set event_count = public.pocket_growth_daily.event_count + 1,
      duration_total_ms = public.pocket_growth_daily.duration_total_ms + excluded.duration_total_ms,
      duration_histogram = case when bounded>0 then jsonb_set(public.pocket_growth_daily.duration_histogram,array[bucket],to_jsonb(coalesce((public.pocket_growth_daily.duration_histogram->>bucket)::bigint,0)+1),true) else public.pocket_growth_daily.duration_histogram end;
end;
$$;
revoke all on function public.record_pocket_growth_event(text,text,text,text,text,boolean,integer) from public,anon,authenticated;
grant execute on function public.record_pocket_growth_event(text,text,text,text,text,boolean,integer) to service_role;

create or replace function public.pocket_growth_report(p_from date)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'timings', coalesce((select jsonb_agg(t) from (select event, platform, flow, bins.key::integer as bucket_ms, sum(bins.value::bigint) as total from public.pocket_growth_daily cross join lateral jsonb_each_text(duration_histogram) bins where day >= p_from and not is_test group by event,platform,flow,bins.key order by event,platform,flow,bins.key::integer) t), '[]'::jsonb),
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
