-- UNAPPLIED PROPOSAL. Not an automatic migration and not executed in this session.
-- Management-plane target MUST be pxlqvaddvghjjhenqmdh, never production.
-- Run only as a separately reviewed compensating migration after checking this checkpoint.
-- Do not delete or rewrite the installation/acceptance migration history.
BEGIN;
SET LOCAL lock_timeout='1s';
SET LOCAL statement_timeout='5s';
DO $guard$
DECLARE n integer;
BEGIN
 IF current_user<>'postgres' THEN RAISE EXCEPTION 'ROLLBACK_REQUIRES_REVIEWED_ADMIN'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='ig_demo_runtime' AND NOT rolcanlogin AND rolconnlimit=0) OR EXISTS(SELECT 1 FROM pg_stat_activity WHERE usename='ig_demo_runtime') THEN RAISE EXCEPTION 'ROLLBACK_REFUSES_ACTIVE_RUNTIME'; END IF;
 SELECT count(*) INTO n FROM pg_class c JOIN pg_namespace s ON s.oid=c.relnamespace WHERE s.nspname='ig_demo_private' AND c.relkind IN ('r','p','v','m','S','f');
 IF n<>4 OR EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace s ON s.oid=p.pronamespace WHERE s.nspname='ig_demo_private') THEN RAISE EXCEPTION 'ROLLBACK_REFUSES_EXTRA_OBJECTS'; END IF;
END $guard$;
LOCK TABLE ig_demo_private.sessions,ig_demo_private.credentials,ig_demo_private.requests,ig_demo_private.chart_provenance IN ACCESS EXCLUSIVE MODE;
DO $empty$
BEGIN
 IF EXISTS(SELECT 1 FROM ig_demo_private.sessions) OR EXISTS(SELECT 1 FROM ig_demo_private.credentials) OR EXISTS(SELECT 1 FROM ig_demo_private.requests) OR EXISTS(SELECT 1 FROM ig_demo_private.chart_provenance) THEN RAISE EXCEPTION 'ROLLBACK_REFUSES_STORED_DATA'; END IF;
END $empty$;
DROP TABLE ig_demo_private.chart_provenance;
DROP TABLE ig_demo_private.credentials;
DROP TABLE ig_demo_private.requests;
DROP TABLE ig_demo_private.sessions;
REVOKE USAGE ON SCHEMA ig_demo_private FROM ig_demo_runtime;
DROP SCHEMA ig_demo_private;
-- RESTRICT is the default: unknown dependencies abort the transaction.
DROP ROLE ig_demo_runtime;
COMMIT;
