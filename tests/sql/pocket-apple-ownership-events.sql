do $$
declare u uuid:='7a9d6268-93d5-43ec-bd05-15f074e35bcc'; n uuid:='84ed6b0b-1a45-43ec-bd05-15f074e35bcc';
begin
 assert not public.is_pocket_apple_legacy_owner('Sandbox','10001',u),'receipt alone never binds';
 insert into private.pocket_apple_legacy_owners(environment,original_transaction_id,user_id,evidence_ref) values('Sandbox','10001',u,'synthetic-independent-ownership-test');
 assert public.is_pocket_apple_legacy_owner('Sandbox','10001',u);
 assert not public.is_pocket_apple_legacy_owner('Production','10001',u);
 assert not public.is_pocket_apple_legacy_owner('Sandbox','10001','7a9d6268-93d5-43ec-bd05-15f074e35bcd');
 update private.pocket_apple_legacy_owners set revoked=true where original_transaction_id='10001';
 assert not public.is_pocket_apple_legacy_owner('Sandbox','10001',u);
 assert public.record_pocket_apple_event('Sandbox',n,'REFUND',null,1000,'10001',repeat('a',64));
 assert public.record_pocket_apple_event('Sandbox',n,'REFUND',null,1000,'10001',repeat('a',64)),'idempotent event';
 assert not public.record_pocket_apple_event('Sandbox',n,'DID_RENEW',null,1000,'10001',repeat('b',64)),'immutable duplicate conflict';
 assert not public.is_pocket_apple_legacy_owner('Sandbox','10001',u),'events cannot restore revoked ownership';
 assert not has_table_privilege('service_role','private.pocket_apple_legacy_owners','INSERT'),'no client/service possession-only binding';
 assert not has_function_privilege('authenticated','public.is_pocket_apple_legacy_owner(text,text,uuid)','EXECUTE');
 assert not has_function_privilege('anon','public.record_pocket_apple_event(text,uuid,text,text,bigint,text,text)','EXECUTE');
end $$;
select 'apple_ownership_events_sql_pass' as result;
