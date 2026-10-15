-- Explicit null rejection: SQL three-valued comparisons must not permit missing leases.
create or replace function private.claim_pocket_first_free(p_user_id uuid,p_email_hash text,p_phase text,p_image_key text,p_request_key text,p_lease uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare policy private.pocket_first_free_policy; account private.pocket_first_free_accounts; req private.pocket_first_free_requests;
begin
 if p_lease is null or p_user_id is null or p_phase is null or p_phase not in ('preflight','analyse') or coalesce(p_email_hash,'') !~ '^[0-9a-f]{64}$' or coalesce(p_image_key,'') !~ '^[0-9a-f]{64}$' or coalesce(p_request_key,'') !~ '^[0-9a-f]{64}$' then return jsonb_build_object('ok',false); end if;
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

create or replace function private.finish_pocket_first_free(p_user_id uuid,p_email_hash text,p_phase text,p_image_key text,p_request_key text,p_lease uuid,p_dispatched boolean,p_response_status integer,p_response_body jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare req private.pocket_first_free_requests;
begin
 if p_lease is null or p_user_id is null or p_phase is null or p_phase not in ('preflight','analyse') or coalesce(p_email_hash,'') !~ '^[0-9a-f]{64}$' or coalesce(p_image_key,'') !~ '^[0-9a-f]{64}$' or coalesce(p_request_key,'') !~ '^[0-9a-f]{64}$' then return jsonb_build_object('ok',false); end if;
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

