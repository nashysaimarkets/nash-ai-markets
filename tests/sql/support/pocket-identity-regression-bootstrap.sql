-- Synthetic disposable fixture only; no hosted Supabase connection is used.
-- Tests the actual UUID-bound function's row-integrity guard. The founding
-- award side effect is stubbed; this is not a full migration/privileges test.
create schema private;
create schema auth;
create table auth.users (
  id uuid primary key, email text, email_confirmed_at timestamptz,
  is_anonymous boolean, banned_until timestamptz
);
create table private.pocket_web_identities (
  app_user_id uuid primary key, stripe_customer_id text unique, evidence_ref text
);
create table private.pocket_web_subscriptions (
  stripe_subscription_id text primary key, email text, app_user_id uuid,
  stripe_customer_id text, active boolean, current_period_end timestamptz,
  last_event_created_at bigint, identity_linked_at timestamptz,
  updated_at timestamptz default now()
);
create function public.sync_pocket_founding_650(text,text,text,boolean,timestamptz,bigint)
returns void language sql as $$ select $$;
insert into auth.users values
 ('11111111-1111-4111-8111-111111111111','a@example.invalid',now(),false,null),
 ('22222222-2222-4222-8222-222222222222','b@example.invalid',now(),false,null);
