-- UNINSTALLED additive proposal. Existing trusted executor only; no runtime grants.
BEGIN;
CREATE FUNCTION pocket_google_ownership.revoke_known_token(p_account uuid,p_package text,p_environment text,p_hash text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pocket_google_ownership AS $$
DECLARE found_token pocket_google_ownership.tokens%ROWTYPE;
BEGIN
 IF p_account IS NULL OR p_package IS NULL OR p_environment NOT IN ('sandbox','production') OR p_environment IS NULL OR p_hash IS NULL OR p_hash !~ '^[a-f0-9]{64}$' THEN RETURN jsonb_build_object('status','HOLD'); END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('pocket-google:'||p_hash,0));
 SELECT * INTO found_token FROM pocket_google_ownership.tokens WHERE token_sha256=p_hash FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('status','UNKNOWN_TOKEN_REQUIRES_REVIEW'); END IF;
 IF found_token.account_id<>p_account OR found_token.package_name<>p_package OR found_token.environment<>p_environment THEN RETURN jsonb_build_object('status','SCOPE_CONFLICT'); END IF;
 UPDATE pocket_google_ownership.tokens SET revoked=true WHERE token_sha256=p_hash AND revoked=false;
 RETURN jsonb_build_object('status','REVOKED');
END $$;
REVOKE ALL ON FUNCTION pocket_google_ownership.revoke_known_token(uuid,text,text,text) FROM PUBLIC;
COMMIT;
