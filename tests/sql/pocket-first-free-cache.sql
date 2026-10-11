-- Run in BEGIN/ROLLBACK. Synthetic reports; no provider calls.
do $$
declare u uuid:='7a9d6268-93d5-43ec-bd05-15f074e35bd0'; h text:=repeat('9',64); erased integer;
begin
 insert into private.pocket_first_free_accounts(user_id,email_hash,analysis_consumed) values(u,h,true);
 insert into private.pocket_first_free_requests(user_id,phase,request_key,image_key,lease,state,expires_at,dispatched_at,response_status,response_body,completed_at)
 values(u,'analyse',repeat('1',64),repeat('2',64),gen_random_uuid(),'completed',now()-interval '25 hours',now()-interval '25 hours',200,'{"analysis":{"secretChartFact":"expired"}}',now()-interval '25 hours'),
       (u,'preflight',repeat('3',64),repeat('2',64),gen_random_uuid(),'completed',now()+interval '1 hour',now()-interval '1 hour',200,'{"preflight":{"status":"READY"}}',now()-interval '1 hour');
 erased:=private.purge_pocket_first_free_cache();
 assert erased>=1,'expired body must be erased';
 assert (select response_body is null from private.pocket_first_free_requests where user_id=u and phase='analyse'),'erase cached facts';
 assert (select response_body is not null from private.pocket_first_free_requests where user_id=u and phase='preflight'),'preserve current replay';
 assert (select analysis_consumed from private.pocket_first_free_accounts where user_id=u),'cleanup never resets allowance';
 assert (select dispatched_at is not null and response_status=200 and state='completed' from private.pocket_first_free_requests where user_id=u and phase='analyse'),'preserve admission audit';
 assert not has_function_privilege('authenticated','private.purge_pocket_first_free_cache()','EXECUTE');
 assert not has_function_privilege('anon','private.purge_pocket_first_free_cache()','EXECUTE');
 assert (select count(*)=1 from cron.job where jobname='pocket-first-free-cache-retention' and active and schedule='17 * * * *' and command='select private.purge_pocket_first_free_cache();'),'one automatic cleanup job';
end $$;
select 'first_free_cache_sql_pass' as result;
