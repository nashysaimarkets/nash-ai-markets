# Current setup: isolated Neon Free ledger installed, credential handoff pending

The owner’s 21 October Neon-only amendment supersedes the proposed third Supabase project. The original setup approval remains saved in OWNER-SETUP-APPROVAL.json; first-six paid approval and internal-diagnostics amendment remain unchanged. Do not ask for those approvals or two human reviewers again. Original proposal: immutable PR140 checkpoint f4ee155f42a32aa50350c79f27674226542d6a7f.

## Installed and verified

One Neon Free project **monaco-first-six-ledger**, London, PostgreSQL17, 0.25CU, mandatory Free idle suspension. Connected organization was Free with zero projects before creation and remains Free afterwards. No card, trial, paid plan, upgrade, billable overage, extra database/branch, application migration or Supabase mutation. Capacity and hard-stop behavior are recorded in qa/neon-ledger/COST-CAPACITY.json.

Schema installed atomically from hash-pinned original SQL plus the small Neon adapter at source **2c5bbe11534ca288939025566fe7f097b23b26ff**. The physical project/branch/database/endpoint comes from provider control-plane results and is pinned in an immutable table; see NEON-IDENTITY-EVIDENCE.json. The runtime role is monaco_ledger_runner: NOLOGIN, NOSUPERUSER, NOCREATEDB, NOCREATEROLE, NOINHERIT, NOREPLICATION, NOBYPASSRLS, no role memberships. Its only application entry point is public.monaco_neon_rpc. Direct tables, private functions, settlement, baseline manufacture, schema creation and generic measurement storage are denied. No fabricated Supabase-compatible reference or service_role is used.

The protected GitHub environment **monaco-first-six-inference** is installed. Required reviewer: existing owner nashysaimarkets; administrator bypass disabled; only branch monaco-first-six-inference-126-20261021 allowed, currently matching no existing branch. No environment secrets or credentialed workflow have been installed. The separate review-branch QA workflow has no environment/secrets and only uses disposable synthetic PG17, standard free public-repository compute, no caches/artifact uploads or timer. No Work automation/schedule changes.

## Exact remaining secure handoff

The Neon connector is connected, but the Neon console is not signed into this browser. GitHub's connector cannot write environment secrets. Complete the secure browser sign-in, then use the provider's credential mechanism to issue only the new restricted database role password. Keep the role NOLOGIN until protected storage is verified. Transfer through approved concealed UI-to-UI copy/paste into **MONACO_FIRST_SIX_LEDGER_KEY** in the already configured GitHub environment; do not print/read the clipboard or secret, include it in tool output, files, logs, source or artifacts. Do not substitute the privileged database-owner credential. If secure transfer is unavailable, stop with NOLOGIN and no issued runtime credential.

The existing OpenAI key has not been accessed, created, rotated, widened or retested. Secure binding to a reviewed isolated inference executor remains a separate existing execution condition. This setup is not provider dispatch. Real dispatch still throws unconditionally.

## Budget history and data boundary

Only the non-secret physical Neon identity has been seeded. Allowance, carry-in, calls, request pins and runner/inference approval binding have no rows. **Unknown budget is not zero.** Preserve original allowance comment-6165012632, aggregate5000000 microUSD and required first-six headroom1917600 microUSD; historical$2 evidence remains separate and unresolved. Preserve all earlier reservations/spend/uncertainty records and import only an independently reconciled complete carry-in. Never infer a fresh allowance from this new database, delete history or create a second allowance to regain headroom.

Immutable prior spent+reserved+unresolved exposure is added to the greater of every new reserved/actual amount. Uncertain submitted requests retain reservations and cannot be voided or resent. The ledger rejects chart images, OHLC, prompts, raw provider responses and generic measurement payloads; allowed usage contains only the three token counts. Private source/output packets remain untouched.

Before any real inference: verify exact existing-key/executor binding, actual processor/security acceptance (including private output handling), authoritative carry-in/headroom, frozen source/request pins and single-programme spending authority. No paid run, extra44, metadata rerun, new OpenAI credential, deployment/main merge or store release is enabled by the ledger installation.

## Tests and rollback

42 unique affected checks pass:21 existing bridge checks,5 new transport/TLS/no-retry checks,16 real PostgreSQL17 checks including three overlapping-session scenarios, rollback of partial reservations, connection-loss recovery, immutable receipt/history, data exclusions, exact aggregate cap and installation as a non-superuser database owner. Strict affected TypeScript passes. Final exact-source CI: https://github.com/nashysaimarkets/nash-ai-markets/actions/runs/39598675588 . The128 unaffected diagnostic checks and original application evidence are reused; charts, metadata and full app builds were not repeated. No hosted runner/provider acceptance is claimed from CI.

Rollback now means retaining the unused database in disabled/NOLOGIN state and removing any new binding only if necessary. After any reservation/submission, preserve the ledger, evidence and receipts; never reset or destroy obligations. Do not alter either Supabase project or the original inference key. Source rollback returns to frozen PR140; the existing app has not been changed or deployed.
