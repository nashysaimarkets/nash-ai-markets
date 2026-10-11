-- Execute with candidate migration inside a single BEGIN/ROLLBACK transaction.
-- Disposable users and policy values are synthetic; no provider requests.
do $$
declare u uuid:='7a9d6268-93d5-43ec-bd05-15f074e35bcc'; v uuid:='7a9d6268-93d5-43ec-bd05-15f074e35bcd'; h text:=encode(extensions.digest('free-test@example.invalid','sha256'),'hex'); k text:=repeat('a',64); k2 text:=repeat('b',64); img text:=repeat('c',64); r jsonb; lease uuid;
begin
 if exists(select 1 from auth.users where id in (u,v)) then raise exception 'fixture_uuid_collision'; end if;
 insert into auth.users(id,email,email_confirmed_at,is_anonymous) values(u,'free-test@example.invalid',now(),false);
 r:=public.reserve_pocket_first_free(u,h,'preflight',img,k);
 assert r->>'status'='disabled','default must remain off';
 update private.pocket_first_free_policy set enabled=true;
 r:=public.reserve_pocket_first_free(u,h,'analyse',img,k);
 assert r->>'status'='preflight_required','no preflight bypass';
 r:=public.reserve_pocket_first_free(u,h,'preflight',img,k); lease:=(r->>'lease')::uuid;
 assert r->>'allowed'='true';
 assert public.reserve_pocket_first_free(u,h,'preflight',img,k2)->>'status'='busy','concurrent reserve blocked';
 assert public.claim_pocket_first_free(u,h,'preflight',img,k,gen_random_uuid())->>'ok'='false','wrong lease';
 assert public.claim_pocket_first_free(u,h,'preflight',img,k,null)->>'ok'='false','missing lease must fail closed';
 assert public.finish_pocket_first_free(u,h,'preflight',img,k,null,false,400,'{}')->>'ok'='false','missing lease cannot settle';
 assert public.finish_pocket_first_free(u,h,'preflight',img,k,lease,false,400,'{}')->>'ok'='true','pre-dispatch release';
 assert (select preflights=0 from private.pocket_first_free_accounts where user_id=u),'release does not consume';
 r:=public.reserve_pocket_first_free(u,h,'preflight',img,k); lease:=(r->>'lease')::uuid;
 assert public.claim_pocket_first_free(u,h,'preflight',img,k,lease)->>'ok'='true','single dispatch';
 assert public.claim_pocket_first_free(u,h,'preflight',img,k,lease)->>'ok'='false','duplicate dispatch denied';
 assert public.finish_pocket_first_free(u,h,'preflight',img,k,lease,false,400,'{}')->>'ok'='false','post-dispatch cannot release';
 assert public.finish_pocket_first_free(u,h,'preflight',img,k,lease,true,200,'{"preflight":{"status":"READY","priceScaleVisible":true,"candlesReadable":true,"sameInstrument":null}}')->>'ok'='true';
 assert public.finish_pocket_first_free(u,h,'preflight',img,k,lease,true,200,'{"preflight":{"status":"RETAKE"}}')->>'ok'='false','immutable response';
 assert public.reserve_pocket_first_free(u,h,'preflight',img,k)->>'status'='replay','durable retry';
 assert public.reserve_pocket_first_free(u,h,'analyse',repeat('d',64),k)->>'status'='preflight_required','wrong image denied';
 r:=public.reserve_pocket_first_free(u,h,'analyse',img,k); lease:=(r->>'lease')::uuid;
 assert r->>'allowed'='true','matching chart accepted';
 update private.pocket_first_free_policy set enabled=false;
 assert public.claim_pocket_first_free(u,h,'analyse',img,k,lease)->>'ok'='false','revoked policy stops dispatch';
 update private.pocket_first_free_policy set enabled=true;
 assert public.claim_pocket_first_free(u,h,'analyse',img,k,lease)->>'ok'='true';
 assert public.finish_pocket_first_free(u,h,'analyse',img,k,lease,true,200,'{"analysis":{"levels":[]}}')->>'ok'='true';
 assert public.reserve_pocket_first_free(u,h,'analyse',img,k)->>'status'='replay','analysis recovery';
 assert public.reserve_pocket_first_free(u,h,'analyse',img,k2)->>'status'='used','new payload cannot redispatch';
 assert public.reserve_pocket_first_free(u,h,'preflight',img,k2)->>'status'='used','no extra preflight after analysis';
 -- Reinstall/account deletion must not reset the same verified-email allowance.
 delete from auth.users where id=u;
 insert into auth.users(id,email,email_confirmed_at,is_anonymous) values(v,'free-test@example.invalid',now(),false);
 assert public.reserve_pocket_first_free(v,h,'preflight',img,k)->>'status'='used','recreated user must not replenish';
 update auth.users set email_confirmed_at=null where id=v;
 assert public.reserve_pocket_first_free(v,h,'preflight',img,k)->>'status'='identity','unverified identity denied';
 assert not has_table_privilege('service_role','private.pocket_first_free_accounts','SELECT'),'no direct private table access';
 assert not has_function_privilege('anon','public.reserve_pocket_first_free(uuid,text,text,text,text)','EXECUTE');
 assert not has_function_privilege('authenticated','public.claim_pocket_first_free(uuid,text,text,text,text,uuid)','EXECUTE');
 assert has_function_privilege('service_role','public.finish_pocket_first_free(uuid,text,text,text,text,uuid,boolean,integer,jsonb)','EXECUTE');
end $$;
-- Preflight failures/retakes/cancellations are bounded, and global admission is durable.
do $$
declare u uuid:='7a9d6268-93d5-43ec-bd05-15f074e35bce'; h text:=encode(extensions.digest('retake-test@example.invalid','sha256'),'hex'); img text:=repeat('e',64); k text; r jsonb; lease uuid;
begin
 insert into auth.users(id,email,email_confirmed_at,is_anonymous) values(u,'retake-test@example.invalid',now(),false);
 for i in 1..3 loop
  k:=lpad(i::text,64,'0'); r:=public.reserve_pocket_first_free(u,h,'preflight',img,k); lease:=(r->>'lease')::uuid;
  assert r->>'allowed'='true';
  assert public.claim_pocket_first_free(u,h,'preflight',img,k,lease)->>'ok'='true';
  assert public.finish_pocket_first_free(u,h,'preflight',img,k,lease,true,200,'{"preflight":{"status":"RETAKE","priceScaleVisible":false,"candlesReadable":false}}')->>'ok'='true';
 end loop;
 assert public.reserve_pocket_first_free(u,h,'preflight',img,repeat('f',64))->>'status'='used','retakes bounded';
 assert public.reserve_pocket_first_free(u,h,'analyse',img,repeat('f',64))->>'status'='preflight_required','RETAKE cannot authorize analysis';
 update private.pocket_first_free_policy set max_daily_phases=1;
 update auth.users set email='third-test@example.invalid' where id=u;
 insert into auth.users(id,email,email_confirmed_at,is_anonymous) values('7a9d6268-93d5-43ec-bd05-15f074e35bcf','daily-test@example.invalid',now(),false);
 h:=encode(extensions.digest('daily-test@example.invalid','sha256'),'hex');
 assert public.reserve_pocket_first_free('7a9d6268-93d5-43ec-bd05-15f074e35bcf',h,'preflight',img,repeat('f',64))->>'status'='daily_limit','global daily dispatch cap';
end $$;
select 'first_free_sql_pass' as result;
