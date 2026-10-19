# Pocket Bullseye: isolated verification without an administrator key

This isolated successor starts at PR #125 commit `b02d5dd7a44c61fbdb6d99c60e365700d9f66d92`. It adds a standalone metadata review tool and does not change the application verifier, production routes, database migration, financial release veto, owner approvals or cumulative $5 allowance. It does not integrate its output into the existing release gate. The tested implementation remains `93f3fe282c6cab0196812aec989dddaa915bb986`; the previous successful CI and SQL evidence is reused.

## Why this alternative is limited and useful

Official OpenAI documentation requires an administrator credential for the Admin APIs that read project/key inventory. Project model metadata can be retrieved with an ordinary API credential and explicit organisation/project headers. The model object identifies the model's owner, not the calling API key's owner. A successful model GET, an asserted project header, a model's `owned_by` field or browser login alone cannot establish the tracking ID of a concealed runtime key.

Sources checked on 19 October 2026:

- [Administration authentication](https://developers.openai.com/api/docs/guides/admin-apis)
- [Project/key inventory metadata](https://developers.openai.com/api/reference/resources/admin/subresources/organization/subresources/projects/subresources/api_keys/methods/retrieve)
- [Authentication and project scoping](https://developers.openai.com/api/reference/overview)
- [Retrieve model](https://developers.openai.com/api/reference/resources/models/methods/retrieve)
- [Role and key permissions](https://developers.openai.com/api/docs/guides/rbac)

The existing authenticated browser instead supplied a reviewed dashboard attestation: verified Personal organisation `org-5vLRRzXwcigUx96TVE0rI3RW`, active pilot `proj_LTmAIE2Ve7gUAFJ9M74ZxIBI`, Owner account, Standard default tier and the complete unfiltered two-row key inventory. The intended `key_EjND5GXtuqF2K0hp` is Active, never expires, is named `pocket bullseye staging`, and is owned by the verified user. The other chart-reader key is Revoked. Only provider-redacted values and non-secret inventory metadata are retained; no complete credential was read or copied. The administrator-key inventory is empty, as already verified.

The JSON attestation is pinned by SHA-256 in the new tool. There is no caller-supplied evidence path, digest override, alternate API host or administrator-key fallback. An edit, filtered/truncated inventory, collision, different owner/project, expiration or observation older than one hour fails closed before network access. Refreshing expired evidence requires a new authenticated dashboard observation and a reviewed digest update; changing a timestamp without re-observation is forbidden.

The actual executor must already hold the existing project key. In that same process, the tool checks a unique redacted match to the pinned inventory and makes exactly one fixed-origin `GET /v1/models/gpt-5-mini-2025-08-07`, with explicit organisation/project scope, a 10-second timeout, redirects rejected and no retries. The project key needs its existing model-read permission; the tool does not modify permissions. It validates the exact model object and provider request identifier. Errors never dump provider bodies or credentials. No inference, health probe, database access, key-management request, browser-cookie extraction or secret-file loading is present.

This retains an explicitly described **redacted correlation** assurance, with a manually reviewed inventory snapshot instead of live administrator inventory. The digest prevents unnoticed evidence edits; it is not an OpenAI signature. A short masked suffix is not cryptographic proof of key identity. The report labels the evidence source and age and does not claim otherwise. The actual key/model authorisation remains unknown until a real scoped GET succeeds in the credentialed executor. Even success verifies only that executor's credential, not the concealed Sites secret.

## Execution and validation

From this isolated branch, in the existing trusted local runner where the project credential already resides:

```bash
bash scripts/verify-pocket-benchmark-no-admin.sh --metadata-only
```

No `OPENAI_ADMIN_KEY` is needed or accessed. Do not copy a Sites production key, reveal a key, paste secrets into chat, create a credential or load an unverified old dotenv file. If the runner's existing project key does not match, stop on the non-secret failure code. The wrapper pins both exact models and the reviewed configuration only in its child process, and forces paid dispatch off. It does not connect to the configured shared-live Supabase backend.

Focused new offline validation: **52/52 tests passed**, including an independent mocked-transport harness, wrong owner/project/tracking ID, mask ambiguity, revoked/expired keys, stale/future or tampered evidence, arbitrary-origin rejection, exact model enforcement, redirects, provider errors/secret reflection, missing credential before network, wrapper argument/paid-hold checks and non-secret CLI failure. Bash syntax validation passed. Only the newly added test suite was run; no passed legacy CI, scanner measurement, build or SQL test was repeated. All test credentials and provider responses were synthetic; no authenticated provider request was made.

The current cloud executor has no project credential, as already established. The real model GET remains **BLOCKED**, not PASS. The only required access action is to execute the prepared command inside the existing runner that holds the approved project key, with fresh reviewed evidence, and return only non-secret JSON. No administrator credential is requested. Successful output is schema 2, `STANDALONE_REVIEW_ONLY`, `releaseAuthorized=false`, `paidDispatchEnabled=false`, `financiallySettled=false` and `liveSitesBindingVerified=false`; it cannot replace the existing schema-1 release verifier automatically.

The new branch disables Vercel deployment before its first remote ref is created. No existing workflow is triggered by a push to this branch; no pull request, manual workflow dispatch, production change, migration, merge or deployment is part of this checkpoint.
