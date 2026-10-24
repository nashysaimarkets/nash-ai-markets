-- UNINSTALLED additive server-only lookup. Existing ownership schema required.
BEGIN;
SET LOCAL lock_timeout='2s';
SET LOCAL statement_timeout='5s';
CREATE FUNCTION pocket_google_ownership.lookup_token(p_token_sha256 text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pocket_google_ownership AS $$
DECLARE t pocket_google_ownership.tokens%ROWTYPE;
BEGIN
 IF p_token_sha256 IS NULL OR p_token_sha256 !~ '^[a-f0-9]{64}$' THEN
   RETURN jsonb_build_object('status','HOLD');
 END IF;
 SELECT * INTO t FROM pocket_google_ownership.tokens WHERE token_sha256=p_token_sha256;
 IF NOT FOUND THEN RETURN jsonb_build_object('status','UNBOUND'); END IF;
 RETURN jsonb_build_object('status','BOUND','accountId',t.account_id,'packageName',t.package_name,
   'environment',t.environment,'revoked',t.revoked,'replacedByTokenSha256',t.replaced_by_token_sha256);
END $$;
REVOKE ALL ON FUNCTION pocket_google_ownership.lookup_token(text) FROM PUBLIC;
-- Runtime role grants require explicit installation approval. No browser access.
COMMIT;
