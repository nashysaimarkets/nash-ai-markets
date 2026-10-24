# Operator sequence after the proposed scope is approved

This is a concrete preparation sequence, not permission to execute. Until a new owner scope extension is recorded, every paid path remains HOLD. The original six-run records and USD 1.5064 conservative commitment remain intact.

## Fixed proposal

Use up to six new named attempts, `v2-d001` through `v2-d006`, on the same original development charts. Reserve USD 0.33 for each case before dispatch, including the optional rescue. Maximum new exposure is USD 1.98 and maximum combined exposure is USD 3.4864 within the original USD 5 cumulative ceiling. Start with `v2-d001`; decide whether to proceed after its evidence is reviewed. A poor diagnostic is still a poor diagnostic even when the run and accounting complete successfully.

The request plan is SHA256 `cb2a6588759abd36b0cacf5972515dbd2a114d52c9e3224754d01af6b8a3e109`. Images, reference coordinates and the effective one-original-pixel comparison tolerance are unchanged. The 44 other corpus cases remain outside this scope.

## Preparation already available

| Component | Entry |
| --- | --- |
| Original material to new, single-case bundles | `scripts/pocket-scanner-evaluation-v2-prepare.mjs` |
| Static evidence template, presently HOLD | `RUN-ADMISSION.HOLD.json` |
| Proposed additive database migration | `database/neon/proposed/20261024-scanner-evaluation-v2.sql` |
| Exact owner approval and named-run SQL permit builder | `scripts/prepare-pocket-scanner-evaluation-v2-ledger.mjs` |
| Inert protected workflow template | `RUN-WORKFLOW.yml.template` |
| Offline workflow/input-envelope materializer | `scripts/pocket-scanner-evaluation-v2-operator.mjs` |
| Actual hosted entry | `scripts/pocket-scanner-evaluation-v2-hosted-entry.mjs` |
| One-shot action using the pinned Node runtime | `.github/actions/pocket-scanner-evaluation-v2` |
| Credential-free boundary and PostgreSQL tests | `.github/workflows/pocket-scanner-evaluation-v2-qa.yml` |

## Required order

1. **Record the new scope approval.** Preserve the owner's exact directive and an independently verified, immutable Issue126 reference/body hash. Do not use the old six-run approval, an assistant progress claim, a test fixture or a naked Boolean as new authority. Bind the accepted app source, final reviewed runtime source, exact plan, six named cases, 18 maximum possible calls, zero retries, USD 1.98 new maximum and the existing USD 5 aggregate ceiling.
2. **Recheck the existing account and price.** Independently verify the same existing project/key attribution, pinned model availability and current default-tier cost bound. Read the existing ledger and confirm the original six cases, 18 slots, 14 submitted receipts, four voided rescues, six accounts, original request-pin digest and USD 1.5064 held commitment. The runner must be NOLOGIN with no sessions. Do not change or reset old history if anything differs.
3. **Prepare a separate static evidence commit.** Populate `RUN-ADMISSION.json` from the HOLD template with the approved scope, final runtime source, exact selected bundle, existing public result recipient and independent admission/reassessment record hashes. `ownerDirectiveSha256` must equal the ledger scope's `approvalBodySha256`. Admission/reassessment digests identify independent retained review records; neither is a hash of its own containing file. The first case's `previousCaseReceiptSha256` is null; later cases cite the exact preceding account digest.
4. **Create the reviewed wrapper locally.** The operator's `workflow` mode substitutes only the source commit, evidence commit and named case into the inert template. It emits the workflow and a deployment-disabled `vercel.json`. Review those exact bytes before creating the future invocation branch. The wrapper uses the existing protected environment, the existing immutable runtime lock and a single first-attempt job. No new keys or environment are needed.
5. **Observe the pending protected run.** The new run/job/wrapper IDs now exist. Independently verify their repository, branch, first attempt, exact wrapper, source and evidence checkout pins, environment gate and final acceptance evidence. Static evidence cannot contain its own commit SHA or IDs that did not exist when it was written. The runtime derives these values from actual checkouts and official GitHub run/job metadata, then compares the complete identity to the database permit.
6. **Admit that one pending case.** Use the proposed migration and exact reviewed SQL permit under the existing owner role, with fresh carry-in evidence and the actual pending run/job IDs. This is an additive installation, not a rerun of any old migration or admission. The builder emits no credential, LOGIN statement or network action. Independently inspect the resulting immutable permit before any bounded use of the existing runner credential or release of the protected job.
7. **Deliver only its verified encrypted input.** After the approved runner authenticates its exact permit, obtain its official run/source-bound public handoff artifact and verify its origin and archive hash. The operator's `input` mode validates the original material, exact new case bundle and plan before encrypting it to that handoff. Publish only the resulting ciphertext and deployment-disabled relay configuration. Never send the result-decryption private key to the runner or the repository.
8. **Retain, reconcile, stop and review.** Preserve authenticated encrypted provider responses and the diagnostic output, verify their decrypted hashes and scoped identities, and reconcile provider request IDs/model/usage against the ledger. Retain the full case reservation; it is not an actual billed-cost attestation. Disable runner login and independently verify zero sessions at terminal cleanup. Review completion, original-coordinate error and interpretation limits before proposing the next named case.

A submitted call whose outcome is unknown cannot be retried. A known output-limit response is retained and counted as incomplete; it is never treated as completed JSON. Cancellation, revocation, stale approval, changed historical accounting, missing artifact acknowledgement or a conflicting identity stops further dispatch. Evidence recording can remain possible after a revocation or expiry, while new submissions remain blocked.

## Offline commands

All commands below prepare local files only. Configurations are explicit JSON files; no secret belongs in them.

```bash
node scripts/pocket-scanner-evaluation-v2-prepare.mjs \
  --original-bundle /private/first-six-input.bundle.gz \
  --out /private/new-evaluation-material

node scripts/pocket-scanner-evaluation-v2-operator.mjs \
  workflow /private/verified-wrapper-config.json /private/new-wrapper-output

node scripts/prepare-pocket-scanner-evaluation-v2-ledger.mjs \
  /private/verified-ledger-config.json /private/new-admission

node scripts/pocket-scanner-evaluation-v2-operator.mjs \
  input /private/verified-handoff-config.json /private/new-ciphertext-output
```

The new output directories/files must not already exist. The workflow configuration contains `caseId`, `sourceSha` and `evidenceSha`. The input configuration contains `caseId`, `sourceSha`, `runId`, `bundleSha256`, `planSha256`, `publicHandoffPath`, `bundlePath` and `planPath`. The ledger builder validates its complete approval, fresh carry-in and independently reviewed attempt data before producing SQL.

Reported execution timing includes serial provider work, evidence retention and accounting. It is not deployed HTTP response time, browser latency or physical-device acceptance. The exact repaired app's existing build/browser acceptance is recorded separately in PR144.
