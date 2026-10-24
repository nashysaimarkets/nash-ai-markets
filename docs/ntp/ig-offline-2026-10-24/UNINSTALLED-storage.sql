-- PROPOSAL ONLY. Not in migration discovery. No database writes authorised/executed.
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
-- No browser/anon/authenticated grants. Dedicated approved server role only;
-- actual role selection/grants deliberately remain outside this uninstalled proposal.
COMMIT;
