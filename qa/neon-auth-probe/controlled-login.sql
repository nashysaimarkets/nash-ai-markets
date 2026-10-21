DO $monaco_auth$
DECLARE r record;
BEGIN
  IF current_database() <> 'monaco_ledger' OR session_user <> 'monaco_ledger_owner' THEN
    RAISE EXCEPTION 'Wrong isolated ledger identity';
  END IF;
  IF (SELECT count(*) FROM private.monaco_neon_identity
      WHERE project_id='bitter-grass-28096464' AND branch_id='br-aged-mode-zaa9u7lr'
      AND endpoint_host='ep-silent-fire-za1s230f.c-2.eu-west-2.aws.neon.tech'
      AND database_name=current_database() AND runner_role='monaco_ledger_runner') <> 1 THEN
    RAISE EXCEPTION 'Pinned ledger identity not present';
  END IF;
  SELECT * INTO STRICT r FROM pg_catalog.pg_roles WHERE rolname='monaco_ledger_runner';
  IF r.rolcanlogin OR r.rolsuper OR r.rolcreatedb OR r.rolcreaterole OR r.rolinherit
     OR r.rolreplication OR r.rolbypassrls OR
     EXISTS (SELECT 1 FROM pg_catalog.pg_auth_members WHERE member=r.oid) THEN
    RAISE EXCEPTION 'Restricted role state changed; stop';
  END IF;
  IF EXISTS (SELECT 1 FROM private.monaco_runner_binding)
     OR EXISTS (SELECT 1 FROM private.monaco_prior_budget) THEN
    RAISE EXCEPTION 'Admission state exists; auth-only activation refused';
  END IF;
  ALTER ROLE monaco_ledger_runner LOGIN;
END $monaco_auth$;
