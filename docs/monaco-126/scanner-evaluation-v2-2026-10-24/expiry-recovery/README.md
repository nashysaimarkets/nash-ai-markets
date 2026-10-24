# Proposed recovery of the unused d002 execution window

**Status: OFFLINE PREPARED, UNAPPROVED, UNINSTALLED.** No lease, login, provider request, new attempt, or additional budget has been created. The accepted runtime, wrapper, application, request plan, original permit, prior records and their triggers remain unchanged.

The original d002 permit expired at **2026-10-24 15:50 UTC** while run **40105387615**, job **120905891814**, attempt **1** remained protected and unused. The original contract contains no renewal operation. This proposal adds one separately authorized, immutable execution lease for that exact permit. It is a new database protocol amendment; it is not represented as existing authority or unchanged SQL.

## Concrete proposal

The proposed SQL adds one private lease table and three restricted helpers. A lease can be inserted only by the exact isolated owner, under the same aggregate allowance lock used by claim/submission, with the runner inactive, no sessions, and no claim, submission, receipt, account or stop for d002. It binds the full original permit and scope, every retained d001 row, all eighteen request pins, original history, exact runtime/run/job/wrapper identity, a new approved amendment, an independent source review, and fresh official pending-run and ledger observations. The one row cannot be updated, deleted, truncated or renewed.

The RPC body changes in **one expression only**: an expired per-case permit may consult this exact active lease. Revocation, original scope expiry, future admission time, identity, previous-case sequencing, budget, one-claim and one-submission guards are retained verbatim. Missing or malformed lease evidence cannot evaluate as an accidental SQL NULL allowance. Late receipt and accounting behavior is unchanged.

Installation, the derived RPC replacement, and the first validated lease INSERT form **one transaction**. A rejected owner record, stale observation, changed history or failed INSERT rolls back the DDL and RPC replacement. The standalone proposed SQL is review material, not an operational install instruction.

The new lease is at most sixty minutes and ends inside the original scope, which expires **2026-10-25T12:40:25Z**. The original `permit.valid_until` remains **15:50**. A separately reviewed activation variant permits the existing twenty-minute login only strictly inside the committed lease and original scope. No password or privilege is changed by the proposal or grant.

## Frozen files and owner decision

`proposal/PROPOSAL-MANIFEST.json` binds the three implementation files, generated install SQL, original and amended RPC bodies, and every helper body. `proposal/RPC-CHANGE.diff` shows the one predicate replacement. The proposal digest deliberately excludes later owner responses, actual lease dates and grant material, avoiding a self-referential approval hash.

`proposal/OWNER-AMENDMENT-REQUEST.txt` is the exact affirmative request rendered **after** the proposal source is frozen. Root must show that wording and retain the actual response. A new canonical GitHub owner amendment then binds the exact request hash, response hash, proposal and unchanged target. The materializer and SQL reject progress notes, proposed/denied decisions, a reversed rejection question plus “Yes”, missing or null timestamps, old approval references and bare approval flags. The HOLD templates are not accepted authority. Synthetic test comments are never operational approval.

The root-only opener keeps the accepted authenticated artifact parser and original identity. It verifies the three recovery source files before importing recovery code, requires an independently retained committed lease, and checks claim and submission timestamps to microsecond precision against the lease and original scope. Receipts, accounting and decryption may occur later. The sanitized result records both unchanged runtime identity and the separately amended database protocol. It does not claim new scanner accuracy or latency acceptance.

## Reconstruct from the publication

Publish the new directory at:

`docs/monaco-126/scanner-evaluation-v2-2026-10-24/expiry-recovery`

Use proposal branch `monaco-scanner-unused-permit-recovery-126-20261024`, based on existing PR145 commit `b4d5a71c8077f43a83c29e551eb4cce5bb463e19` (tree `4f3be585b4af279429c48f018741eebf09e35208`). Root owns publication and the branch deployment-disable setting.

`DEPENDENCIES.json` lists every external operation/binding baseline, its exact hash and suggested publication path. The parent tree supplies the accepted SQL, PLAN, runtime files and retained SOURCE-IDENTITY. Copy only the listed **non-secret owner ledger metadata and operation source** into `inputs/execution/`, and the prior d001 owner ledger into `inputs/prior-v2-d001-LEDGER.json`. Original pending-run files are synthetic-test baselines only; a grant requires new post-amendment observations.

Set these explicit task-specific paths after checkout (absolute paths are recommended):

```bash
export POCKET_RECOVERY_EXECUTION_ROOT="$RECOVERY_DIR/inputs/execution"
export POCKET_RECOVERY_ACCEPTED_ROOT="$ACCEPTED_CHECKOUT"
export POCKET_RECOVERY_PRIOR_LEDGER_PATH="$RECOVERY_DIR/inputs/prior-v2-d001-LEDGER.json"
export POCKET_RECOVERY_SOURCE_ROOT="$RECOVERY_DIR"
```

`RECOVERY_DIR` is the published proposal directory; `ACCEPTED_CHECKOUT` is the repository root containing the unchanged accepted runtime and its retained source-identity record. These overrides do not relax any content hashes.

**The SQL fixture has fixed relative imports and must be reconstructed in the original sibling layout.** It cannot run directly under the published `docs/` directory merely by setting the environment overrides. In a new empty reconstruction directory, restore the accepted parent checkout at `scanner-evaluation-v2/`, copy the complete published recovery directory to `scanner-evaluation-v2-execution/expiry-recovery/`, copy `inputs/execution/` into `scanner-evaluation-v2-execution/`, and copy `inputs/prior-v2-d001-LEDGER.json` to `private-six/results/v2-run40095819408/LEDGER.json`. This last file is owner ledger metadata only; no private payload directory is restored. The resulting exact paths are:

| Reconstructed location under the new root | Source |
| --- | --- |
| `scanner-evaluation-v2/` | Accepted PR145 parent checkout `b4d5a71c8077f43a83c29e551eb4cce5bb463e19`, including the unchanged runtime, PLAN, source identity and old test/SQL fixture dependencies |
| `scanner-evaluation-v2-execution/expiry-recovery/` | Complete published recovery code, tests, proposal, README and receipts |
| `scanner-evaluation-v2-execution/d002-preparation/` | Corresponding files from published `inputs/execution/d002-preparation/` |
| `scanner-evaluation-v2-execution/permit-v2-d002/` | Corresponding files from published `inputs/execution/permit-v2-d002/` |
| `scanner-evaluation-v2-execution/ACTIVATE-v2-d002-40105387615.sql`, original opener and reconciliation SQL | Published `inputs/execution/` baselines |
| `private-six/results/v2-run40095819408/LEDGER.json` | Published prior owner ledger metadata, exact hash from DEPENDENCIES.json |

Run the two new suites from the reconstructed recovery directory, with the cached PGlite module path supplied as specified in the SQL fixture. That fixture reuses the accepted SQL bootstrap and original fixture exports from its sibling checkout. No hosted database is used. Operational materialization can alternatively run in the published location using the explicit overrides above.

No chart, provider response body, calibration, private key, credential or signed URL is needed for preparation, tests, grant creation, activation creation or publication. **The sole private dependency is the existing recipient private key supplied by root to the opener after terminal execution.** It remains outside Git, is never read during preparation, and is checked only after all source/ledger/artifact guards.

## Root execution sequence after independent acceptance and actual owner approval

1. Retain the exact affirmative owner response to the rendered request. The saved `OWNER-AMENDMENT-REQUEST.txt` contains the exact request bytes **without a trailing line feed**; its content must equal `ownerApprovalPrompt(proposalSha256)`. Use `ownerAmendmentBody()` with the exact request/response hashes to record the new canonical owner comment; save the official comment JSON. Do not use the original spending approval as this amendment.
2. Retain an independent review JSON with `decision: "ACCEPTED"`, the exact `proposalSha256`, `installSqlSha256` and `rpcAfterSha256`. Refresh official run/jobs/protected-environment evidence and the owner read from `proposal/PRE-GRANT-OBSERVATION.sql`. Both fresh records must be observed after the amendment and within fifteen minutes of materialization and grant. Pending evidence is one JSON object containing `observedAt`, `run`, `jobs`, `environments` (unaltered official objects).
3. Fill a **new** grant-inputs JSON with paths to `ownerComment`, `ownerDecision`, `independentReview`, `pendingEvidence`, `carryIn`, and a fresh absolute `validUntil`. Do not fill the default HOLD file with invented authority. Choose the deadline only now, with more than twenty minutes and at most sixty minutes remaining, inside the original scope.
4. Run `node recovery-builder.mjs grant INPUTS.json NEW_GRANT_DIR`. Independently review its manifest and complete transaction before root installs it. No separate migration, login or provider call is performed by this materializer.
5. Retain the independent result of `proposal/POST-LEASE-OBSERVATION.sql`. Create activation-inputs JSON with `grantManifestPath` and `postLeaseObservationPath`, then run `node recovery-builder.mjs activation ACTIVATION_INPUTS.json NEW_ACTIVATION.sql`. Review the exact generated statement. Root performs the bounded activation and protected release only after the committed observation passes.
6. After terminal execution, retain official artifact/run/job metadata and the new reconciliation from `proposal/RECONCILE-RECOVERED-v2-d002.sql`. Invoke the new root-only opener with `LEDGER.json ARTIFACT_DIR PRIVATE_KEY.pem NEW_PRIVATE_OUTPUT GRANT-MANIFEST.json POST-LEASE.json`. Reuse the accepted cleanup procedure to restore NOLOGIN and verify zero sessions; do not renew this lease or replay this attempt.

To regenerate unapproved review material in a new directory, run `node recovery-builder.mjs proposal NEW_DIR`. This neither inserts a lease nor records an owner approval. If any binding is absent, changed, expired or unresolved, keep the case HOLD.

## Verification scope

The final targeted materialization suite passes **9/9** and covers authority rejection, exact RPC delta, bounded deadlines, stale/wrong official evidence, unchanged permit/history witnesses, microsecond audit bounds, the new activation expression, and an actual generated-opener tamper control. The final SQL suite passes **21/21**, executing the accepted base ledger and proposed amendment in disposable cached PGlite, including immutable triggers, privileges, grant/claim/submit, missing lease/NULL behavior, revocation, expiry, late bookkeeping and actual generated owner-observation queries. Final logs and source pins are retained in the materialization receipt and the SQL author's separate receipt.

PGlite here is PostgreSQL 18.6/WASM 0.5.10 in one connection. It establishes actual SQL, PL/pgSQL, constraint and role behavior in that engine. It is **not** PostgreSQL17 multi-session race, live authentication, network/TLS, hosted installation or provider-execution evidence. The proposal retains the accepted common row-lock path; independent review must keep that concurrency limitation explicit. No unrelated app/browser suites or held-out cases were rerun.
