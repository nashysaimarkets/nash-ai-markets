-- Read independently after activation and after the committed cleanup.
-- Final cleanup passes only when both cleanup_verified=true and runner_sessions=0.
SELECT clock_timestamp() AS observed_at_utc,current_database() AS database_name,session_user AS observer,
 r.rolname,r.rolcanlogin,r.rolvaliduntil,r.rolsuper,r.rolcreatedb,r.rolcreaterole,r.rolinherit,r.rolreplication,r.rolbypassrls,
 (SELECT count(*) FROM pg_auth_members m WHERE m.member=r.oid) AS memberships,
 (SELECT count(*) FROM pg_stat_activity a WHERE a.usename=r.rolname) AS runner_sessions,
 (NOT r.rolcanlogin AND NOT r.rolsuper AND NOT r.rolcreatedb AND NOT r.rolcreaterole AND NOT r.rolinherit
  AND NOT r.rolreplication AND NOT r.rolbypassrls
  AND NOT EXISTS(SELECT 1 FROM pg_auth_members m WHERE m.member=r.oid)
  AND NOT EXISTS(SELECT 1 FROM pg_stat_activity a WHERE a.usename=r.rolname)) AS cleanup_verified
FROM pg_roles r WHERE r.rolname='monaco_ledger_runner';
