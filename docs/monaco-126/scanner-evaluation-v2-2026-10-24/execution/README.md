# Offline execution material

This directory prepares the already accepted runner. It does not contain a replacement runner and does not perform provider calls, database calls, publication, LOGIN changes or credential access.

The accepted executable is `20783ed5e8eb95a11df86b0d60766ffcbbf4fa79`; the exact plan is `cb2a6588759abd36b0cacf5972515dbd2a114d52c9e3224754d01af6b8a3e109`. The helper checks every file in the accepted SOURCE-IDENTITY record before importing the existing builder. It reads the existing public result recipient only.

## First case

1. Root performs the owner read in `OWNER-CARRY-IN.sql`. Retain the complete observation; require every `checks` value to be true. Save only the returned `carryIn` object as a separate JSON input. The digest uses UTC and the exact database-native JSONB encoding in the accepted migration. The existing continuation table must be present.
2. The independent reviewer retains two distinct records: admission review and first-case reassessment. Put their absolute paths in `STATIC-MATERIAL-CONFIG.json`. Its real approval URL, exact body digest, approval time and scope deadline are already populated from the parent-provided immutable comment.
3. Materialize the static evidence into a new directory:

```bash
node prepare-execution-material.mjs static STATIC-MATERIAL-CONFIG.json static-v2-d001
```

The resulting `RUN-ADMISSION.json` is the file for the separate evidence commit at `docs/monaco-126/scanner-evaluation-v2-2026-10-24/RUN-ADMISSION.json`. Retain its owner approval and the exact review bytes. Do not embed dynamic evidence/wrapper/run/job IDs in this file.

4. Use the accepted operator helper's `workflow` mode with case `v2-d001`, source `20783ed5e8eb95a11df86b0d60766ffcbbf4fa79`, and the actual new evidence commit. Root reviews and publishes the wrapper, then independently observes the protected pending run/job.
5. Refresh owner carry-in if older than 15 minutes. Create a permit input JSON containing `staticDirectory`, `carryInPath` and `attempt`. The attempt has the observed `evidenceSha`, `wrapperSha`, numeric-string `runId` and `jobId`, `runAttempt: "1"`, and a current `validUntil` no more than 60 minutes away and before the scope deadline. No invented IDs are usable.
6. Materialize the exact named permit:

```bash
node prepare-execution-material.mjs permit PERMIT-CONFIG.json permit-v2-d001
```

This calls the accepted ledger builder, then checks that the actual hosted admission validator produces exactly the same full identity and five authority fields. Outputs are `LEDGER-CONFIG.json`, `ADMISSION.sql`, `ADMISSION-MANIFEST.json` and `POST-INSTALL-OBSERVATION.sql`. Nothing is executed.

7. Root installs the unchanged proposed migration and the exact admission SQL, then performs the independent `POST-INSTALL-OBSERVATION.sql` read. Every `checks` value must be true before bounded activation/release. The named case must still be unclaimed and unsent; the runner must still be NOLOGIN with zero sessions. An unexpected result is preserved and investigated.
8. Use the accepted operator's `input` mode after official handoff observation. Reconcile retained results and accounting, then run `cleanup-paid-login.sql` as a separate committed operation. Read `verify-paid-login.sql` afterward; both NOLOGIN and zero sessions are required. These two SQL files are copied byte-for-byte from the original accepted cleanup, not rewritten.

Each later case reuses the same recorded owner scope; it requires its own retained reassessment, exact preceding account digest and new actual pending run permit. Never update the scope to authorize an old attempt again. The full USD 0.33 reservation remains held per claimed case.

`EXISTING-EVIDENCE-REFERENCES.json` identifies prior metadata to reuse. Historical storage receipts predate authentication; the later original14-response reconciliation is the evidence of subsequent successful use. No credential reset, fresh key or repeat authentication is part of this materialization.
