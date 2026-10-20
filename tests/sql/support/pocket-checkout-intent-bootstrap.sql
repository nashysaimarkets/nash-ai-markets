-- Synthetic dependencies only. Disposable DB; not a production schema installer.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create role pocket_checkout_verifier nologin noinherit;
create schema auth;
create schema private;
grant usage on schema private to service_role;
create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,is_anonymous boolean default false,banned_until timestamptz);
create table private.pocket_web_identities(app_user_id uuid primary key,stripe_customer_id text not null unique,evidence_ref text not null default 'synthetic',unique(app_user_id,stripe_customer_id));
create table private.pocket_web_subscriptions(stripe_subscription_id text primary key,app_user_id uuid,email text,stripe_customer_id text,active boolean,current_period_end timestamptz);
create function private.has_pocket_web_subscription(p_user_id uuid) returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from private.pocket_web_subscriptions s join auth.users u on u.id=s.app_user_id
    join private.pocket_web_identities i on i.app_user_id=s.app_user_id and i.stripe_customer_id=s.stripe_customer_id
    where s.app_user_id=p_user_id and s.stripe_customer_id is not null and s.active and s.current_period_end>now()
      and u.email_confirmed_at is not null and not coalesce(u.is_anonymous,false) and (u.banned_until is null or u.banned_until<=now())
      and lower(trim(u.email))=s.email)
$$;

-- Only helpers for synthetic test orchestration, outside the proposal schema.
create function public.qa_checkout_seed(p_user_id uuid,p_customer_id text) returns jsonb language sql immutable as $$
  select jsonb_build_object('mode','subscription','customer',p_customer_id,'client_reference_id',p_user_id,
    'line_items',jsonb_build_array(jsonb_build_object('price','price_QA','quantity',1)),
    'success_url','https://example.test/pocket/founding/welcome','cancel_url','https://example.test/pocket/founding?checkout=cancelled',
    'allow_promotion_codes',true,'metadata',jsonb_build_object('supabase_user_id',p_user_id,'offering','pocket_founding_650'),
    'subscription_data',jsonb_build_object('metadata',jsonb_build_object('supabase_user_id',p_user_id,'offering','pocket_founding_650')))
$$;
