# Launch Gate Status

Status reflects repository evidence at commit `29d8dce`. Update this file with
sanitized staging evidence; never mark a gate Cleared from assumption.

| Gate | Classification | Evidence required to clear |
|---|---|---|
| Repository tests, typecheck, lint and build | Cleared | RC2 validation: 230 tests, production build, rendered output and simulation passed |
| Deployment artifact and operations validation | Cleared | Artifact, documentation and secret-pattern checks passed |
| Target staging hosting account/project | Requires external configuration | Account/project owner, staging hostname and environment scope recorded |
| Canonical Supabase migration chain documented | Cleared | `202607170000`–`202607170007` plus additive follow-ons through `202607230011_member_workspace_prefs` documented; workspace prefs **not** auto-applied to production |
| Identify or create isolated staging Supabase project | Ready for user action | Staging project reference and owner recorded |
| Staging backup/restore evidence | Requires external configuration | Backup identifier and successful disposable restore |
| Apply and verify migrations in staging | Requires staging evidence | Migration log, RLS/grant checks and schema verification |
| Production migration | Requires external configuration | Separate approval after staging; not authorized in this phase |
| Four Stripe test-mode Prices | Requires external configuration | GBP amounts/intervals and Price mappings verified |
| Stripe portal and signed webhook endpoint | Requires external configuration | Test endpoint, selected events and portal policy verified |
| Stripe lifecycle, duplicate and ordering matrix | Requires staging evidence | Completed matrix with sanitized event evidence |
| Founding 100 limit and concurrency | Requires staging evidence | Concurrent Pro/Elite tests, exhaustion and permanent allocation checks |
| Supabase staging Site URL and redirect URL | Requires external configuration | Exact HTTPS staging origin/callback saved |
| Magic-link delivery, expiry, reuse and sign-out | Requires staging evidence | Completed auth-domain matrix |
| Production domain, DNS and TLS | Requires external configuration | Assigned hostname, DNS/TLS and redirect evidence |
| Target hosting environment variables | Requires external configuration | Matrix completed and `ops:check-env` passed in target environment |
| Market-provider licence and symbols | Requires legal or business approval | Account entitlement/licence and verified symbol catalogue |
| Market data live/fallback smoke tests | Requires staging evidence | Fresh/live and stale/future/timeout fail-closed evidence |
| OpenAI staging health and deterministic fallback | Requires staging evidence | Sanitized connected/degraded results and fallback output |
| Transactional lifecycle email delivery | Requires external configuration | Provider, sender, suppression, idempotency and monitoring; repository currently has templates only |
| PWA implementation and static assets | Cleared | Manifest, service worker, icons, splash assets and automated contracts pass |
| Physical PWA/device/accessibility matrix | Requires staging evidence | iPhone, iPad, Android Chrome, Samsung Internet, VoiceOver and TalkBack results |
| Monitoring vendor, thresholds and owners | Requires external configuration | Monitor IDs, test alerts, on-call owner and escalation timing |
| Backup/RPO/RTO and incident ownership | Requires legal or business approval | Approved recovery targets, operators and restore drill |
| Privacy/data retention/vendor register | Requires legal or business approval | Approved policies and processor inventory |
| Terms, risk disclaimer and financial-promotion review | Requires legal or business approval | Qualified approval for launch jurisdictions |
| Provider and OpenAI terms/data-use review | Requires legal or business approval | Approved vendor/licensing record |
| Staging smoke test and 48-hour soak | Requires staging evidence | Completed smoke checklist and stable monitoring window |
| Production deployment | Ready for user action only after all launch gates clear | Explicit go decision, immutable artifact and rollback owner |

## Current decision

**NO-GO for public deployment.** The repository is ready for staging
configuration. No production deployment, migration or live billing is
authorized by this status.

### Personal trading workspace (branch `bullseye-personal-trading-workspace`)

Additive member journey: `/markets` selection → `/terminal` personal desk with
widget registry and cookie/DB prefs fallback. Preview deploy only. Migration
`202607230011_member_workspace_prefs.sql` must follow the staging runbook and
must not be applied to production automatically. Auth, Stripe, and production
hosting config are unchanged.

## Safest next manual action for Chris

Identify an isolated staging Supabase project before entering any credentials
or running SQL:

1. Open [Supabase Dashboard](https://supabase.com/dashboard).
2. Inspect the organizations and projects visible to your account.
3. If a project explicitly labelled **staging** exists, open it, then open
   **Project Settings → General** and record its project name/reference in the
   private release record.
4. If no explicitly labelled staging project exists, record
   **“staging Supabase project required”** and stop; do not create one until the
   project owner confirms the organization, region, plan and password-storage
   location.
5. Do not open SQL Editor or apply migrations. The next action after ownership
   confirmation is the backup and schema preflight in
   `SUPABASE_MIGRATION_RUNBOOK.md`.
