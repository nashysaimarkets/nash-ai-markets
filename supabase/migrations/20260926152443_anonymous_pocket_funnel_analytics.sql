grant delete on table public.marketing_visits to service_role;

create or replace function public.record_pocket_growth_event(
  p_event text,
  p_platform text,
  p_source text,
  p_campaign text,
  p_flow text,
  p_is_test boolean,
  p_duration_ms integer
)
returns void
language plpgsql
set search_path to ''
as $function$
declare
  bounded integer := greatest(0, least(600000, p_duration_ms));
  bucket text;
begin
  delete from public.pocket_growth_daily
  where day < ((now() at time zone 'UTC')::date - 365);

  delete from public.marketing_visits
  where created_at < now() - interval '90 days';

  select min(bound)::text into bucket
  from unnest(array[100,250,500,1000,2000,5000,10000,20000,40000,60000,90000,120000,180000,300000,600000]) bound
  where bound >= bounded;

  insert into public.pocket_growth_daily(
    day,event,platform,source,campaign,flow,is_test,event_count,duration_total_ms,duration_histogram
  )
  values (
    (now() at time zone 'UTC')::date,
    p_event,p_platform,p_source,p_campaign,p_flow,p_is_test,1,bounded,
    case when bounded > 0 then jsonb_build_object(bucket,1) else '{}'::jsonb end
  )
  on conflict (day,event,platform,source,campaign,flow,is_test) do update
  set event_count = public.pocket_growth_daily.event_count + 1,
      duration_total_ms = public.pocket_growth_daily.duration_total_ms + excluded.duration_total_ms,
      duration_histogram = case
        when bounded > 0 then jsonb_set(
          public.pocket_growth_daily.duration_histogram,
          array[bucket],
          to_jsonb(coalesce((public.pocket_growth_daily.duration_histogram->>bucket)::bigint,0)+1),
          true
        )
        else public.pocket_growth_daily.duration_histogram
      end;
end;
$function$;

create or replace function public.pocket_growth_report(p_from date)
returns jsonb
language sql
stable
set search_path to ''
as $function$
  select jsonb_build_object(
    'timings', coalesce((
      select jsonb_agg(t) from (
        select event,platform,source,campaign,flow,bins.key::integer as bucket_ms,
          sum(bins.value::bigint) as total
        from public.pocket_growth_daily
        cross join lateral jsonb_each_text(duration_histogram) bins
        where day >= p_from and not is_test
        group by event,platform,source,campaign,flow,bins.key
        order by event,platform,source,campaign,flow,bins.key::integer
      ) t
    ), '[]'::jsonb),
    'events', coalesce((
      select jsonb_agg(e) from (
        select event,platform,source,campaign,flow,sum(event_count) as total,
          case when sum(event_count)>0
            then round(sum(duration_total_ms)::numeric/sum(event_count))
            else 0
          end as average_ms
        from public.pocket_growth_daily
        where day >= p_from and not is_test
        group by event,platform,source,campaign,flow
        order by event,platform,source,campaign,flow
      ) e
    ), '[]'::jsonb),
    'sources', coalesce((
      select jsonb_agg(s) from (
        select source,campaign,
          coalesce(sum(event_count) filter (where event='introduction_viewed'),0) as views,
          coalesce(sum(event_count) filter (where event='sample_viewed'),0) as samples,
          coalesce(sum(event_count) filter (where event='app_store_clicked'),0) as app_store_clicks
        from public.pocket_growth_daily
        where day >= p_from and not is_test
        group by source,campaign
        order by source,campaign
      ) s
    ), '[]'::jsonb)
  );
$function$;
