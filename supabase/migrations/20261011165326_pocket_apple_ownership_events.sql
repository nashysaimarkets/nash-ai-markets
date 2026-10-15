-- No possession-only binding endpoint. An operator must independently establish
-- historical ownership, retain the evidence reference and insert the mapping.
create schema if not exists private;
create table private.pocket_apple_legacy_owners (
 environment text not null check(environment in ('Production','Sandbox')),
 original_transaction_id text not null check(original_transaction_id ~ '^[0-9]{1,64}$'),
 user_id uuid not null,
 evidence_ref text not null check(length(trim(evidence_ref)) between 10 and 500),
 revoked boolean not null default false,
 created_at timestamptz not null default now(),
 primary key(environment,original_transaction_id)
);
create table private.pocket_apple_verified_events (
 environment text not null check(environment in ('Production','Sandbox')),
 notification_id uuid not null,
 notification_type text not null check(length(notification_type) between 1 and 100),
 subtype text,
 signed_date bigint not null check(signed_date>0),
 original_transaction_id text,
 digest text not null check(digest ~ '^[0-9a-f]{64}$'),
 received_at timestamptz not null default now(),
 primary key(environment,notification_id)
);
alter table private.pocket_apple_legacy_owners enable row level security;
alter table private.pocket_apple_verified_events enable row level security;
revoke all on private.pocket_apple_legacy_owners,private.pocket_apple_verified_events from public,anon,authenticated,service_role;
create function private.is_pocket_apple_legacy_owner(p_environment text,p_original_transaction_id text,p_user_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from private.pocket_apple_legacy_owners where environment=p_environment and original_transaction_id=p_original_transaction_id and user_id=p_user_id and not revoked)
$$;
create function private.record_pocket_apple_event(p_environment text,p_notification_id uuid,p_type text,p_subtype text,p_signed_date bigint,p_original_transaction_id text,p_digest text)
returns boolean language plpgsql security definer set search_path='' as $$
declare prior private.pocket_apple_verified_events;
begin
 if p_environment is null or p_environment not in ('Production','Sandbox') or p_notification_id is null or length(coalesce(p_type,'')) not between 1 and 100 or p_signed_date is null or p_signed_date<=0 or coalesce(p_digest,'') !~ '^[0-9a-f]{64}$' or (p_original_transaction_id is not null and p_original_transaction_id !~ '^[0-9]{1,64}$') then raise exception 'invalid_apple_event'; end if;
 insert into private.pocket_apple_verified_events(environment,notification_id,notification_type,subtype,signed_date,original_transaction_id,digest)
 values(p_environment,p_notification_id,p_type,p_subtype,p_signed_date,p_original_transaction_id,p_digest)
 on conflict(environment,notification_id) do nothing;
 select * into prior from private.pocket_apple_verified_events where environment=p_environment and notification_id=p_notification_id;
 return prior.digest=p_digest and prior.notification_type=p_type and prior.subtype is not distinct from p_subtype and prior.signed_date=p_signed_date and prior.original_transaction_id is not distinct from p_original_transaction_id;
end $$;
create function public.is_pocket_apple_legacy_owner(p_environment text,p_original_transaction_id text,p_user_id uuid)
returns boolean language sql stable security invoker set search_path='' as $$ select private.is_pocket_apple_legacy_owner(p_environment,p_original_transaction_id,p_user_id) $$;
create function public.record_pocket_apple_event(p_environment text,p_notification_id uuid,p_type text,p_subtype text,p_signed_date bigint,p_original_transaction_id text,p_digest text)
returns boolean language sql security invoker set search_path='' as $$ select private.record_pocket_apple_event(p_environment,p_notification_id,p_type,p_subtype,p_signed_date,p_original_transaction_id,p_digest) $$;
revoke all on function private.is_pocket_apple_legacy_owner(text,text,uuid),public.is_pocket_apple_legacy_owner(text,text,uuid),private.record_pocket_apple_event(text,uuid,text,text,bigint,text,text),public.record_pocket_apple_event(text,uuid,text,text,bigint,text,text) from public,anon,authenticated;
grant usage on schema private to service_role;
grant execute on function private.is_pocket_apple_legacy_owner(text,text,uuid),public.is_pocket_apple_legacy_owner(text,text,uuid),private.record_pocket_apple_event(text,uuid,text,text,bigint,text,text),public.record_pocket_apple_event(text,uuid,text,text,bigint,text,text) to service_role;
