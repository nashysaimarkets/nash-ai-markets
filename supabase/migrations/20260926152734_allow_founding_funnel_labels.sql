alter table public.pocket_growth_daily
  drop constraint pocket_growth_daily_source_check,
  add constraint pocket_growth_daily_source_check
    check (source ~ '^[a-z0-9][a-z0-9_-]{0,63}$');

alter table public.pocket_growth_daily
  drop constraint pocket_growth_daily_campaign_check,
  add constraint pocket_growth_daily_campaign_check
    check (campaign ~ '^[a-z0-9][a-z0-9_-]{0,63}$');

alter table public.pocket_growth_daily
  drop constraint pocket_growth_daily_event_check,
  add constraint pocket_growth_daily_event_check
    check (event = any (array[
      'introduction_viewed','app_opened','sample_viewed','app_store_clicked',
      'chart_uploaded','scan_started','scan_completed','scan_failed','paywall_viewed',
      'purchase_started','purchase_completed','purchase_incomplete','purchase_failed',
      'restore_completed','evidence_opened','timeframe_opened','decision_saved',
      'review_started','review_completed','notebook_opened','note_saved','backup_exported',
      'backup_restored','scan_prepared_single','scan_prepared_multi','scan_response_single',
      'scan_response_multi','scan_verified_single','scan_verified_multi',
      'founding_page_viewed','founding_offer_clicked','app_open_clicked','checkout_started',
      'checkout_cancelled','checkout_unavailable'
    ]));

alter table public.pocket_growth_daily
  drop constraint pocket_growth_daily_flow_check,
  add constraint pocket_growth_daily_flow_check
    check (flow = any (array['browse','sample','web','free','paid','founding650']));
