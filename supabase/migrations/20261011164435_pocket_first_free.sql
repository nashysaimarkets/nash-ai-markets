-- Prepared candidate migration. Not a production activation. Policy starts OFF.
-- Durable identities have no auth.users FK: deleting/recreating an account cannot
-- replenish the same verified email allowance. No image or Apple proof is stored.
create schema if not exists private;
create table private.pocket_first_free_policy (
 singleton boolean primary key default true check(singleton),
 enabled boolean not null default false,
 max_preflights integer not null default 3 check(max_preflights between 1 and 3),
 max_daily_phases integer not null default 50 check(max_daily_phases between 1 and 50)
);
insert into private.pocket_first_free_policy(singleton) values(true);
create table private.pocket_first_free_accounts (
 user_id uuid primary key,
 email_hash text not null unique check(email_hash ~ '^[0-9a-f]{64}$'),
 preflights integer not null default 0 check(preflights between 0 and 3),
 analysis_consumed boolean not null default false,
 created_at timestamptz not null default now()
);
create table private.pocket_first_free_requests (
 user_id uuid not null references private.pocket_first_free_accounts(user_id),
 phase text not null check(phase in ('preflight','analyse')),
 request_key text not null check(request_key ~ '^[0-9a-f]{64}$'),
 image_key text not null check(image_key ~ '^[0-9a-f]{64}$'),
 lease uuid not null,
 state text not null check(state in ('reserved','dispatched','completed','released')),
 expires_at timestamptz not null,
 dispatched_at timestamptz,
 response_status integer,
 response_body jsonb,
 completed_at timestamptz,
 primary key(user_id,phase,request_key),
 check (response_body is null or pg_column_size(response_body) <= 1000000)
);
create index pocket_first_free_daily_idx on private.pocket_first_free_requests(dispatched_at) where dispatched_at is not null;
alter table private.pocket_first_free_policy enable row level security;
alter table private.pocket_first_free_accounts enable row level security;
alter table private.pocket_first_free_requests enable row level security;
revoke all on private.pocket_first_free_policy,private.pocket_first_free_accounts,private.pocket_first_free_requests from public,anon,authenticated,service_role;

-- Caller must be the server's service role; never expose these RPCs to clients.
-- Independently revalidate auth.users rather than trusting user metadata/headers.
create function private.reserve_pocket_first_free(p_user_id uuid,p_email_hash text,p_phase text,p_image_key text,p_request_key text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare policy private.pocket_first_free_policy; account private.pocket_first_free_accounts; req private.pocket_first_free_requests; new_lease uuid;
begin
 if p_user_id is null or p_phase is null or p_phase not in ('preflight','analyse') or coalesce(p_email_hash,'') !~ '^[0-9a-f]{64}$' or coalesce(p_image_key,'') !~ '^[0-9a-f]{64}$' or coalesce(p_request_key,'') !~ '^[0-9a-f]{64}$' then raise exception 'invalid_free_request'; end if;
 if not exists(select 1 from auth.users u where u.id=p_user_id and u.email_confirmed_at is not null and not coalesce(u.is_anonymous,false) and (u.banned_until is null or u.banned_until <= now()) and encode(extensions.digest(lower(trim(u.email)),'sha256'),'hex')=p_email_hash) then return jsonb_build_object('allowed',false,'status','identity'); end if;
 select * into policy from private.pocket_first_free_policy where singleton for update;
 if not found or not policy.enabled then return jsonb_build_object('allowed',false,'status','disabled'); end if;
 -- The global policy lock serializes account creation, claims and global limits.
 select * into account from private.pocket_first_free_accounts where user_id=p_user_id for update;
 if not found then
   if exists(select 1 from private.pocket_first_free_accounts where email_hash=p_email_hash) then return jsonb_build_object('allowed',false,'status','used'); end if;
   insert into private.pocket_first_free_accounts(user_id,email_hash) values(p_user_id,p_email_hash) returning * into account;
 end if;
 if account.email_hash <> p_email_hash then return jsonb_build_object('allowed',false,'status','identity_changed'); end if;
 select * into req from private.pocket_first_free_requests where user_id=p_user_id and phase=p_phase and request_key=p_request_key for update;
 if found then
   if req.image_key <> p_image_key then raise exception 'free_identity_conflict'; end if;
   if req.state='completed' and req.response_status=200 and req.completed_at > now()-interval '24 hours' then return jsonb_build_object('allowed',false,'status','replay','response_status',req.response_status,'response_body',req.response_body); end if;
   if req.state='dispatched' then return jsonb_build_object('allowed',false,'status','busy'); end if;
   if req.state='completed' then return jsonb_build_object('allowed',false,'status','used'); end if;
 end if;
 if exists(select 1 from private.pocket_first_free_requests where user_id=p_user_id and state in ('reserved','dispatched') and expires_at>now()) then return jsonb_build_object('allowed',false,'status','busy'); end if;
 if account.analysis_consumed or (p_phase='preflight' and account.preflights>=policy.max_preflights) then return jsonb_build_object('allowed',false,'status','used'); end if;
 if p_phase='analyse' and not exists(select 1 from private.pocket_first_free_requests r where r.user_id=p_user_id and r.phase='preflight' and r.image_key=p_image_key and r.state='completed' and r.response_status=200 and r.response_body->'preflight'->>'status' in ('READY','LIMITED') and r.response_body->'preflight'->>'priceScaleVisible'='true' and r.response_body->'preflight'->>'candlesReadable'='true' and coalesce(r.response_body->'preflight'->>'sameInstrument','')<>'false' and r.completed_at>now()-interval '24 hours') then return jsonb_build_object('allowed',false,'status','preflight_required'); end if;
 if (select count(*) from private.pocket_first_free_requests where dispatched_at >= date_trunc('day',now() at time zone 'UTC') at time zone 'UTC') >= policy.max_daily_phases then return jsonb_build_object('allowed',false,'status','daily_limit'); end if;
 new_lease:=gen_random_uuid();
 insert into private.pocket_first_free_requests(user_id,phase,request_key,image_key,lease,state,expires_at)
 values(p_user_id,p_phase,p_request_key,p_image_key,new_lease,'reserved',now()+interval '90 seconds')
 on conflict(user_id,phase,request_key) do update set lease=excluded.lease,state='reserved',expires_at=excluded.expires_at;
 return jsonb_build_object('allowed',true,'status','reserved','lease',new_lease);
end $$;

create function private.claim_pocket_first_free(p_user_id uuid,p_email_hash text,p_phase text,p_image_key text,p_request_key text,p_lease uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare policy private.pocket_first_free_policy; account private.pocket_first_free_accounts; req private.pocket_first_free_requests;
begin
 select * into policy from private.pocket_first_free_policy where singleton for update;
 if not found or not policy.enabled then return jsonb_build_object('ok',false); end if;
 select * into account from private.pocket_first_free_accounts where user_id=p_user_id for update;
 if not found or account.email_hash <> p_email_hash or account.analysis_consumed then return jsonb_build_object('ok',false); end if;
 if not exists(select 1 from auth.users u where u.id=p_user_id and u.email_confirmed_at is not null and not coalesce(u.is_anonymous,false) and (u.banned_until is null or u.banned_until <= now()) and encode(extensions.digest(lower(trim(u.email)),'sha256'),'hex')=p_email_hash) then return jsonb_build_object('ok',false); end if;
 select * into req from private.pocket_first_free_requests where user_id=p_user_id and phase=p_phase and request_key=p_request_key for update;
 if not found or req.lease<>p_lease or req.image_key<>p_image_key or req.state<>'reserved' or req.expires_at<=now() then return jsonb_build_object('ok',false); end if;
 if p_phase='preflight' and account.preflights>=policy.max_preflights then return jsonb_build_object('ok',false); end if;
 if (select count(*) from private.pocket_first_free_requests where dispatched_at >= date_trunc('day',now() at time zone 'UTC') at time zone 'UTC') >= policy.max_daily_phases then return jsonb_build_object('ok',false); end if;
 update private.pocket_first_free_accounts set preflights=preflights+case when p_phase='preflight' then 1 else 0 end,analysis_consumed=(p_phase='analyse') where user_id=p_user_id;
 update private.pocket_first_free_requests set state='dispatched',dispatched_at=now() where user_id=p_user_id and phase=p_phase and request_key=p_request_key;
 return jsonb_build_object('ok',true);
end $$;

create function private.finish_pocket_first_free(p_user_id uuid,p_email_hash text,p_phase text,p_image_key text,p_request_key text,p_lease uuid,p_dispatched boolean,p_response_status integer,p_response_body jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare req private.pocket_first_free_requests;
begin
 if not exists(select 1 from private.pocket_first_free_accounts where user_id=p_user_id and email_hash=p_email_hash) then return jsonb_build_object('ok',false); end if;
 select * into req from private.pocket_first_free_requests where user_id=p_user_id and phase=p_phase and request_key=p_request_key for update;
 if not found or req.lease<>p_lease or req.image_key<>p_image_key then return jsonb_build_object('ok',false); end if;
 if p_dispatched is null or p_response_status is null or p_response_status not between 200 and 599 or (p_response_body is not null and pg_column_size(p_response_body)>1000000) then raise exception 'invalid_free_response'; end if;
 if req.state='reserved' and not p_dispatched then
   update private.pocket_first_free_requests set state='released' where user_id=p_user_id and phase=p_phase and request_key=p_request_key;
   return jsonb_build_object('ok',true);
 end if;
 if req.state='completed' then return jsonb_build_object('ok',req.response_status=p_response_status and req.response_body is not distinct from p_response_body); end if;
 if req.state<>'dispatched' or not p_dispatched then return jsonb_build_object('ok',false); end if;
 update private.pocket_first_free_requests set state='completed',response_status=p_response_status,response_body=p_response_body,completed_at=now() where user_id=p_user_id and phase=p_phase and request_key=p_request_key;
 return jsonb_build_object('ok',true);
end $$;

create function public.reserve_pocket_first_free(p_user_id uuid,p_email_hash text,p_phase text,p_image_key text,p_request_key text)
returns jsonb language sql security invoker set search_path='' as $$ select private.reserve_pocket_first_free(p_user_id,p_email_hash,p_phase,p_image_key,p_request_key) $$;
create function public.claim_pocket_first_free(p_user_id uuid,p_email_hash text,p_phase text,p_image_key text,p_request_key text,p_lease uuid)
returns jsonb language sql security invoker set search_path='' as $$ select private.claim_pocket_first_free(p_user_id,p_email_hash,p_phase,p_image_key,p_request_key,p_lease) $$;
create function public.finish_pocket_first_free(p_user_id uuid,p_email_hash text,p_phase text,p_image_key text,p_request_key text,p_lease uuid,p_dispatched boolean,p_response_status integer,p_response_body jsonb)
returns jsonb language sql security invoker set search_path='' as $$ select private.finish_pocket_first_free(p_user_id,p_email_hash,p_phase,p_image_key,p_request_key,p_lease,p_dispatched,p_response_status,p_response_body) $$;
revoke all on function private.reserve_pocket_first_free(uuid,text,text,text,text),public.reserve_pocket_first_free(uuid,text,text,text,text),private.claim_pocket_first_free(uuid,text,text,text,text,uuid),public.claim_pocket_first_free(uuid,text,text,text,text,uuid),private.finish_pocket_first_free(uuid,text,text,text,text,uuid,boolean,integer,jsonb),public.finish_pocket_first_free(uuid,text,text,text,text,uuid,boolean,integer,jsonb) from public,anon,authenticated;
grant usage on schema private to service_role;
grant execute on function private.reserve_pocket_first_free(uuid,text,text,text,text),public.reserve_pocket_first_free(uuid,text,text,text,text),private.claim_pocket_first_free(uuid,text,text,text,text,uuid),public.claim_pocket_first_free(uuid,text,text,text,text,uuid),private.finish_pocket_first_free(uuid,text,text,text,text,uuid,boolean,integer,jsonb),public.finish_pocket_first_free(uuid,text,text,text,text,uuid,boolean,integer,jsonb) to service_role;
