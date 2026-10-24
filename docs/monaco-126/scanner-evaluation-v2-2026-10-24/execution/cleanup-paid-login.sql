-- Run in a separate committed call on success, failure, cancellation or timeout.
-- Do not combine with a failing zero-session assertion: that could roll NOLOGIN back.
-- This cleanup intentionally works even if the admission/runner failed midway.
DO $paid_cleanup$
BEGIN
 IF current_database()<>'monaco_ledger' OR session_user<>'monaco_ledger_owner'
  OR current_user<>'monaco_ledger_owner' THEN
  RAISE EXCEPTION 'Exact isolated ledger owner required'; END IF;
 IF (SELECT count(*) FROM private.monaco_neon_identity WHERE singleton
  AND organization_id='org-icy-butterfly-11039021' AND project_id='bitter-grass-28096464'
  AND branch_id='br-aged-mode-zaa9u7lr' AND endpoint_host='ep-silent-fire-za1s230f.c-2.eu-west-2.aws.neon.tech'
  AND database_name='monaco_ledger' AND runner_role='monaco_ledger_runner'
  AND control_plane_evidence_sha256='32c788992c1909a8c704e35744f94ebb6df82fd121cff4878653a1d1da03dfc1')<>1 THEN
  RAISE EXCEPTION 'Exact physical ledger identity required'; END IF;
 ALTER ROLE monaco_ledger_runner NOLOGIN;
END $paid_cleanup$;
