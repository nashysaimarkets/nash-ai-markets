DO $monaco_auth$
BEGIN
  IF current_database() <> 'monaco_ledger' OR session_user <> 'monaco_ledger_owner' THEN
    RAISE EXCEPTION 'Wrong isolated ledger identity';
  END IF;
  ALTER ROLE monaco_ledger_runner NOLOGIN;
END $monaco_auth$;
