-- PROPOSAL ONLY. Not in migration discovery; no hosted installation or role grant.
-- Call only from the authenticated server after a fresh Google verification.
-- This index records ownership, never an entitlement or purchase acknowledgement.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
CREATE SCHEMA pocket_google_ownership;
REVOKE ALL ON SCHEMA pocket_google_ownership FROM PUBLIC;

CREATE TABLE pocket_google_ownership.tokens (
  token_sha256 text PRIMARY KEY CHECK (token_sha256 ~ '^[a-f0-9]{64}$'),
  account_id uuid NOT NULL,
  package_name text NOT NULL CHECK (package_name ~ '^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$'),
  environment text NOT NULL CHECK (environment IN ('production', 'sandbox')),
  supersedes_token_sha256 text REFERENCES pocket_google_ownership.tokens(token_sha256),
  replaced_by_token_sha256 text REFERENCES pocket_google_ownership.tokens(token_sha256),
  revoked boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK (supersedes_token_sha256 IS DISTINCT FROM token_sha256),
  CHECK (replaced_by_token_sha256 IS DISTINCT FROM token_sha256)
);
ALTER TABLE pocket_google_ownership.tokens ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE pocket_google_ownership.tokens FROM PUBLIC;

CREATE FUNCTION pocket_google_ownership.preserve_history() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, pocket_google_ownership AS $$
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RAISE EXCEPTION 'Google ownership history cannot be deleted or reset';
  END IF;
  IF ROW(NEW.token_sha256,NEW.account_id,NEW.package_name,NEW.environment,NEW.supersedes_token_sha256,NEW.created_at)
       IS DISTINCT FROM ROW(OLD.token_sha256,OLD.account_id,OLD.package_name,OLD.environment,OLD.supersedes_token_sha256,OLD.created_at)
    OR (OLD.revoked AND NOT NEW.revoked)
    OR (OLD.replaced_by_token_sha256 IS NOT NULL AND NEW.replaced_by_token_sha256 IS DISTINCT FROM OLD.replaced_by_token_sha256) THEN
    RAISE EXCEPTION 'Google ownership and retirement are immutable';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER preserve_token_rows BEFORE UPDATE OR DELETE ON pocket_google_ownership.tokens
  FOR EACH ROW EXECUTE FUNCTION pocket_google_ownership.preserve_history();
CREATE TRIGGER preserve_token_history BEFORE TRUNCATE ON pocket_google_ownership.tokens
  FOR EACH STATEMENT EXECUTE FUNCTION pocket_google_ownership.preserve_history();

CREATE FUNCTION pocket_google_ownership.claim_token(
  p_account_id uuid, p_package_name text, p_environment text,
  p_token_sha256 text, p_supersedes_token_sha256 text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pocket_google_ownership AS $$
DECLARE
  current_token pocket_google_ownership.tokens%ROWTYPE;
  previous_token pocket_google_ownership.tokens%ROWTYPE;
  already_bound boolean;
  lock_id bigint;
BEGIN
  IF p_account_id IS NULL OR p_package_name IS NULL
    OR p_package_name !~ '^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$'
    OR length(p_package_name) > 255 OR p_environment IS NULL
    OR p_environment NOT IN ('production','sandbox') OR p_token_sha256 IS NULL
    OR p_token_sha256 !~ '^[a-f0-9]{64}$'
    OR (p_supersedes_token_sha256 IS NOT NULL AND p_supersedes_token_sha256 !~ '^[a-f0-9]{64}$') THEN
    RETURN jsonb_build_object('status','HOLD','reason','INVALID_OWNERSHIP_INPUT');
  END IF;
  IF p_supersedes_token_sha256 = p_token_sha256 THEN
    RETURN jsonb_build_object('status','DENIED','reason','LINKED_TOKEN_CYCLE');
  END IF;
  -- Row locks alone cannot lock an absent token. Sorted transaction locks cover
  -- both absent/new and existing/linked tokens. Hash collisions only serialize.
  FOR lock_id IN
    SELECT DISTINCT hashtextextended('pocket-google:' || h, 0) AS id
    FROM unnest(ARRAY[p_token_sha256,p_supersedes_token_sha256]) AS q(h)
    WHERE h IS NOT NULL ORDER BY id
  LOOP
    PERFORM pg_advisory_xact_lock(lock_id);
  END LOOP;

  SELECT * INTO current_token FROM pocket_google_ownership.tokens
    WHERE token_sha256 = p_token_sha256 FOR UPDATE;
  already_bound := FOUND;
  IF already_bound THEN
    IF current_token.account_id <> p_account_id THEN
      RETURN jsonb_build_object('status','DENIED','reason','ACCOUNT_OWNERSHIP_CONFLICT');
    ELSIF current_token.package_name <> p_package_name OR current_token.environment <> p_environment THEN
      RETURN jsonb_build_object('status','DENIED','reason','TOKEN_SCOPE_CONFLICT');
    ELSIF current_token.revoked THEN
      RETURN jsonb_build_object('status','DENIED','reason','TOKEN_REVOKED');
    ELSIF current_token.replaced_by_token_sha256 IS NOT NULL THEN
      RETURN jsonb_build_object('status','DENIED','reason','TOKEN_REPLACED');
    ELSIF current_token.supersedes_token_sha256 IS DISTINCT FROM p_supersedes_token_sha256 THEN
      RETURN jsonb_build_object('status','DENIED','reason','LINKED_OWNERSHIP_CHANGED');
    END IF;
  END IF;

  IF p_supersedes_token_sha256 IS NOT NULL THEN
    SELECT * INTO previous_token FROM pocket_google_ownership.tokens
      WHERE token_sha256 = p_supersedes_token_sha256 FOR UPDATE;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('status','HOLD','reason','LINKED_OWNERSHIP_REVIEW_REQUIRED');
    ELSIF previous_token.account_id <> p_account_id THEN
      RETURN jsonb_build_object('status','DENIED','reason','ACCOUNT_OWNERSHIP_CONFLICT');
    ELSIF previous_token.package_name <> p_package_name OR previous_token.environment <> p_environment THEN
      RETURN jsonb_build_object('status','DENIED','reason','TOKEN_SCOPE_CONFLICT');
    ELSIF previous_token.revoked THEN
      RETURN jsonb_build_object('status','DENIED','reason','TOKEN_REVOKED');
    ELSIF previous_token.replaced_by_token_sha256 IS NOT NULL
      AND previous_token.replaced_by_token_sha256 <> p_token_sha256 THEN
      RETURN jsonb_build_object('status','DENIED','reason','TOKEN_REPLACED');
    END IF;
  END IF;

  IF NOT already_bound THEN
    INSERT INTO pocket_google_ownership.tokens
      (token_sha256,account_id,package_name,environment,supersedes_token_sha256)
    VALUES (p_token_sha256,p_account_id,p_package_name,p_environment,p_supersedes_token_sha256);
  END IF;
  IF p_supersedes_token_sha256 IS NOT NULL THEN
    UPDATE pocket_google_ownership.tokens SET replaced_by_token_sha256 = p_token_sha256
      WHERE token_sha256 = p_supersedes_token_sha256 AND replaced_by_token_sha256 IS NULL;
  END IF;
  RETURN jsonb_build_object('status','RECORDED','accountId',p_account_id,
    'packageName',p_package_name,'environment',p_environment,'tokenSha256',p_token_sha256,
    'supersedesTokenSha256',p_supersedes_token_sha256,'created',NOT already_bound,'entitled',false);
END $$;
REVOKE ALL ON FUNCTION pocket_google_ownership.preserve_history() FROM PUBLIC;
REVOKE ALL ON FUNCTION pocket_google_ownership.claim_token(uuid,text,text,text,text) FROM PUBLIC;
-- No runtime GRANT here. A reviewed installation must explicitly select its
-- trusted server-only executor. Never grant to public/anon/authenticated clients.
COMMIT;
