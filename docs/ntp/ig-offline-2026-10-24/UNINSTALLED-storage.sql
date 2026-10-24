-- PROPOSAL ONLY. Not in migration discovery. Disposable acceptance only; never installed hosted.
-- Requires independent database review and explicit installation/grant approval.
BEGIN;
CREATE SCHEMA ig_demo_private;
REVOKE ALL ON SCHEMA ig_demo_private FROM PUBLIC;
CREATE TABLE ig_demo_private.sessions (
 application text NOT NULL, owner_id uuid NOT NULL,
 epoch bigint NOT NULL CHECK(epoch>0), sealed text CHECK(length(sealed)<=24000),
 PRIMARY KEY(application,owner_id)
);
CREATE TABLE ig_demo_private.credentials (
 application text NOT NULL, owner_id uuid NOT NULL,
 environment text NOT NULL CHECK(environment='DEMO'), enabled boolean NOT NULL DEFAULT false,
 sealed text NOT NULL CHECK(length(sealed)<=24000), PRIMARY KEY(application,owner_id)
);
CREATE TABLE ig_demo_private.requests (
 application text NOT NULL, account_id text NOT NULL, charged_at timestamptz NOT NULL
);
CREATE INDEX ig_demo_requests_window ON ig_demo_private.requests(application,charged_at);
CREATE TABLE ig_demo_private.chart_provenance (
 application text NOT NULL, owner_id uuid NOT NULL, token_hash bytea NOT NULL CHECK(octet_length(token_hash)=32),
 revision text NOT NULL CHECK(revision ~ '^[a-f0-9]{40}$'), expires_at timestamptz NOT NULL,
 epic text NOT NULL, account_type text NOT NULL CHECK(account_type IN ('CFD','SPREADBET','PHYSICAL')),
 PRIMARY KEY(application,owner_id,token_hash)
);
-- Populate only through approved server-verified source registration, never screenshot labels.
REVOKE ALL ON ALL TABLES IN SCHEMA ig_demo_private FROM PUBLIC;
-- Dedicated server role has no login or schema ownership. Never grant it to browser roles.
CREATE ROLE ig_demo_runtime NOLOGIN NOSUPERUSER NOBYPASSRLS;
GRANT USAGE ON SCHEMA ig_demo_private TO ig_demo_runtime;
GRANT SELECT,INSERT,UPDATE ON ig_demo_private.sessions TO ig_demo_runtime;
GRANT SELECT ON ig_demo_private.credentials,ig_demo_private.chart_provenance TO ig_demo_runtime;
GRANT SELECT,INSERT,DELETE ON ig_demo_private.requests TO ig_demo_runtime;
ALTER TABLE ig_demo_private.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ig_demo_private.sessions FORCE ROW LEVEL SECURITY;
ALTER TABLE ig_demo_private.credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE ig_demo_private.credentials FORCE ROW LEVEL SECURITY;
ALTER TABLE ig_demo_private.chart_provenance ENABLE ROW LEVEL SECURITY;
ALTER TABLE ig_demo_private.chart_provenance FORCE ROW LEVEL SECURITY;
ALTER TABLE ig_demo_private.requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE ig_demo_private.requests FORCE ROW LEVEL SECURITY;
CREATE POLICY owner_boundary ON ig_demo_private.sessions TO ig_demo_runtime
 USING(application=current_setting('ig_demo.application',true) AND owner_id::text=current_setting('ig_demo.owner_id',true))
 WITH CHECK(application=current_setting('ig_demo.application',true) AND owner_id::text=current_setting('ig_demo.owner_id',true));
CREATE POLICY owner_boundary ON ig_demo_private.credentials FOR SELECT TO ig_demo_runtime
 USING(application=current_setting('ig_demo.application',true) AND owner_id::text=current_setting('ig_demo.owner_id',true));
CREATE POLICY owner_boundary ON ig_demo_private.chart_provenance FOR SELECT TO ig_demo_runtime
 USING(application=current_setting('ig_demo.application',true) AND owner_id::text=current_setting('ig_demo.owner_id',true));
CREATE POLICY application_boundary ON ig_demo_private.requests TO ig_demo_runtime
 USING(application=current_setting('ig_demo.application',true))
 WITH CHECK(application=current_setting('ig_demo.application',true));
-- No browser/anon/authenticated grants. Dedicated approved server role only;
-- Attaching an actual login to this role requires separate hosted approval.
COMMIT;
