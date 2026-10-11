-- A lost admitted response is terminal; never replenish or stay busy forever.
create or replace function private.reserve_pocket_first_free(p_user_id uuid,p_email_hash text,p_phase text,p_image_key text,p_request_key text)
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
   if req.state='dispatched' then return jsonb_build_object('allowed',false,'status',case when req.dispatched_at>now()-interval '5 minutes' then 'busy' else 'interrupted' end); end if;
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

