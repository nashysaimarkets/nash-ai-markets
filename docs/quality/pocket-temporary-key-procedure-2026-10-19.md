# Temporary model-metadata key: prepared, not created

The authenticated OpenAI Platform form is prepared in **Personal → bullseye private pilot** (`proj_LTmAIE2Ve7gUAFJ9M74ZxIBI`). No credential has been created. The separate owner approval required by the current instruction has not yet been given.

## Exact proposal

| Setting | Prepared value |
| --- | --- |
| Name | Pocket Bullseye Metadata Verification |
| Owner | You (the existing user; no service account or new role) |
| Permission mode | Restricted |
| List models | Read |
| Linked model-read scopes | `api.model.read`, `model.read` |
| Model capabilities | None |
| Every other category | None |
| Expiration | 1 day after creation |
| Permitted verifier request | One GET to `https://api.openai.com/v1/models/gpt-5-mini-2025-08-07` |

The actual permission menu identifies the model-read option as `api.model.read`; selecting it shows two linked selected permissions, consistent with the official RBAC guide's `api.model.read`/`model.read` pair. The other 17 top-level permission categories remain None: Agents, Traces, Vaults, Voices, Model capabilities, Threads, Evals, Fine-tuning, Files, Videos, Vector Stores, Prompts, Batch, Tunnels, Datasets, Safety and Project safety alerts. There is no `api.model.request`, `model.request`, write permission, administrative permission or broad Read only selection.

The expiration control offers 1, 7 or 30 days, Never and Custom. Custom accepts integer days with min=1, max=365 and step=1. A 1-day expiry is therefore the shortest supported by this form. No existing key, membership, permission, application setting or production secret has been edited.

References already reviewed: [model metadata](https://developers.openai.com/api/reference/resources/models/methods/retrieve) and [RBAC permissions](https://developers.openai.com/api/docs/guides/rbac). No billed request will be made to test an expected permission denial; inference/write access is checked in the reviewed permission configuration instead.

## Stop before creation

1. The owner reviews the exact proposal and gives separate final approval. Until then, leave Create secret key unclicked.
2. After approval, hand creation and the one-time secret screen to the owner. Do not inspect, screenshot, print, copy through assistant clipboard tools, transmit to chat, or save the generated secret in the repository, Library, a dotenv file or a report.
3. The owner keeps the secret only for the brief owner-controlled local execution. The selected project, name, expiry and permissions must still match the reviewed form before creation. If anything differs, stop; do not create another key or broaden permissions.

## Fresh independent evidence after creation

The new tracking ID and secret fingerprint do not exist yet. `pocket-temporary-key-plan-20261019.json` therefore contains `DRAFT_NOT_CREATED`, `key=null`, `ownerApprovalAt=null` and no invented creation/review timestamps. The verifier and local launcher refuse execution before prompting for any secret.

Only after actual approval and creation may the plan be replaced with fresh independently reviewed dashboard metadata. Record the new key's exact tracking ID, expected name, creator, Active status, redacted value, both read-only scopes, actual creation/expiry timestamps and observation/review times. The owner and an independent reviewer must confirm the resulting row and permission details; `observedBy` and `reviewedBy` must identify distinct actors. Pin the reviewed JSON's SHA-256 in `verify-pocket-temporary-key.mjs`. Do not merely edit the existing timestamp or mark unobserved fields reviewed. If any metadata cannot be established, keep the plan blocked.

The guard rejects either pre-existing pilot key tracking ID, either known old redacted suffix, inference/write/broad scopes, more than 24 hours of key lifetime, stale evidence older than one hour, missing final approval, and the same observer/reviewer. Pinned evidence changes require review, rather than an arbitrary runtime file or digest override.

## Secure local execution

The isolated branch retains disabled Vercel deployments and does not modify any live application or database. After the new plan is genuinely created, independently reviewed and pinned, use an existing trusted interactive local terminal with Node.js and Python:

```bash
python3 scripts/run-pocket-metadata-temporary.py --metadata-only
```

The launcher first performs a secret-free preflight. A draft or invalid plan stops without requesting a credential. It then accepts the new temporary key using hidden terminal input, never as a command argument or chat message, and passes it only to the child process as `OPENAI_METADATA_VERIFICATION_KEY`. Its explicit environment allowlist excludes inherited `OPENAI_API_KEY`, `OPENAI_ADMIN_KEY`, custom API origins and Node startup options. It does not load secret files, persist the new credential, create a service account, change permissions or copy a Sites key. Credential variables are discarded on process exit. The owner should clear any clipboard copy through their own local interface after entry.

The Node tool permits only the fixed-origin scoped model GET, rejects redirects, has a 10-second timeout, performs no retry and never dumps provider error bodies. Return only its non-secret JSON. A key with only model-read permission cannot perform inference or writes under the reviewed scope model; no inference or write request is attempted to prove this.

## Identity separation and cleanup

The temporary report uses schema 3, `reportKind=TEMPORARY_METADATA_ACCESS_ONLY` and `temporaryKeyTrackingId`, rather than the original verifier's existing `keyTrackingId`. It always states `liveSitesBindingVerified=false`, `existingPilotKeyBindingVerified=false`, `releaseAuthorized=false`, `paidDispatchEnabled=false` and `financiallySettled=false`. The temporary credential verifies its own model-metadata access only; it cannot prove ownership of a different concealed live Sites secret. No live application is configured to use it, and it is not automatically accepted by the release gate.

After the one metadata run and the owner's review of its non-secret result, identify the temporary row by **both** its new tracking ID and exact name. Obtain the required action-time confirmation before revoking that key. Revoke only this temporary key, then observe its Revoked status in the same project. Never revoke, rotate or replace the existing staging/chart-reader keys. The 1-day automatic expiry is a backstop, not evidence that manual revocation occurred. If the temporary key was not created, no revocation is required.

## Validation preserved

All previous 52 no-admin tests are reused unchanged and were not rerun. Only the new temporary-key preparation tests ran: **30/30 passed** with synthetic keys, synthetic post-approval evidence and mocked transport. They cover the uncreated draft stopping before secret entry/network, approval/review ordering, exact read scopes, lifetime and freshness, old-key collisions, separate credential input, no live-binding claims, fixed GET/redirect rejection and secret-free failures. Python launcher syntax passed. No real credential, live provider request, production change, database operation, merge or deployment was used.
