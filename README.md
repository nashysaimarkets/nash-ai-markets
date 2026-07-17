# NASH AI Markets — Project Bullseye

Project Bullseye is a private-beta trading-intelligence application for
provider-backed S&P 500 futures context. It combines a fail-closed market-data
gateway with deterministic intelligence, decision and structured planning
engines. It does not place trades, fabricate unavailable values or provide
personalized financial advice.

## Architecture

```text
Public site
  ├─ pricing and legal information
  ├─ private-beta waiting list
  ├─ Stripe Checkout links
  └─ Supabase passwordless registration/login

Authenticated application
  ├─ Supabase user, membership and preview access
  ├─ reviewed Founding Member onboarding
  ├─ FMP or generic normalized market provider
  ├─ market gateway validation/retry/fallback
  ├─ deterministic intelligence and reasoning
  ├─ deterministic decision engine
  ├─ deterministic structured trade planner
  └─ entitlement-filtered dashboard, terminal and diagnostics

Stripe signed webhook
  └─ server-side Supabase membership synchronization
```

Premium output is conditionally rendered on the server and is absent from the
DOM when not entitled. Preview, unavailable, stale, future-dated, malformed and
fallback market data cannot produce actionable output.

For the full route, service, data-flow and security-boundary reference, see
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Services

- **Hosting/runtime:** Vinext/Vite application compiled to a Cloudflare
  Worker-style artifact.
- **Supabase:** passwordless authentication, sessions, memberships, progressive
  preview claims and verified outcome history.
- **Stripe:** hosted checkout/customer portal and signed subscription webhooks.
- **OpenAI:** official server-side SDK with an authenticated, sanitized
  connectivity health check.
- **Financial Modeling Prep:** first live provider adapter for S&P 500 futures,
  VIX, US 2Y/10Y Treasury yields and the US Dollar Index.
- **Generic HTTP provider:** optional alternative accepting the normalized
  Bullseye snapshot schema.

The FMP adapter does not currently supply an economic calendar. The UI shows an
explicit unavailable state unless a reliable provider supplies a complete
future timestamp.

## Application layers

- `app/lib/market-data.ts` — snapshot schema, normalization and freshness.
- `app/lib/providers/` — provider-specific adapters.
- `app/lib/live-market-gateway.ts` — retry, health and safe fallback.
- `app/lib/market-intelligence-engine.ts` — deterministic scores and reasoning.
- `app/lib/trading-decision-engine.ts` — deterministic decision output.
- `app/lib/structured-trade-planner.ts` — non-executing planning output.
- `app/lib/server/ai-morning-brief.ts` — structured OpenAI summary of verified
  Morning Brief evidence with deterministic fallback.
- `app/terminal/lib/membership-entitlement.ts` — Free, Pro, Elite and preview
  access.
- `app/dashboard/` — daily member experience.
- `app/waitlist/` — public private-beta interest registration.
- `app/founding-member/` — eligible paid-member onboarding application.
- `app/terminal/` — integrated visual terminal and diagnostics.
- `app/api/stripe/webhook/` — signed membership synchronization.
- `utils/supabase/` — browser, server-session and service-role clients.
- `worker/index.ts` — runtime entry and baseline response security headers.

## Routes

| Route | Purpose |
|---|---|
| `/` | Public product, pricing and risk information |
| `/login` | Passwordless registration and login |
| `/waitlist` | Private-beta waiting-list registration |
| `/dashboard` | Authenticated daily member dashboard |
| `/founding-member` | Authenticated Pro/Elite Founding Member onboarding |
| `/brief` | Authenticated, fail-safe AI-assisted market brief |
| `/profile` | Authenticated member profile and subscription status |
| `/terminal` | Authenticated market terminal |
| `/terminal/diagnostics` | Effective-Elite launch diagnostics |
| `/api/membership/preview` | Authenticated progressive preview claim |
| `/api/waitlist` | Same-origin waiting-list registration |
| `/api/founding-member` | Authenticated paid-member onboarding submission |
| `/api/profile` | Authenticated same-origin display-name update |
| `/api/stripe/webhook` | Stripe-signed subscription synchronization |
| `/api/openai/health` | Authenticated server-side OpenAI connectivity check |
| `/welcome`, `/cancelled` | Checkout return states |
| `/privacy`, `/terms` | Public legal information |

## Dependencies and prerequisites

- Node.js `>=22.13.0`
- Next `16.2.6`, React `19.2.6`
- Vinext `0.0.50`, Vite `8.0.13`
- Supabase JS/SSR
- Stripe Node SDK
- Lightweight Charts `5.2.0`
- TypeScript `5.9.3`, ESLint and Node test runner

The locked Linux dependency installer requires `flock`, `curl`, `sha256sum` and
GNU `timeout`. The build helper uses GNU `timeout` when available and otherwise
runs without an outer deadline, which keeps local macOS validation usable.

## Environment

Copy variable names from `.env.example`; never commit populated credentials.
The authoritative description of every implemented variable is
[docs/ENVIRONMENT_VARIABLES.md](docs/ENVIRONMENT_VARIABLES.md).

Validate production variable presence and safe formats without printing values:

```sh
npm run ops:check-env
```

This check does not contact external services and does not prove credential
validity.

## Supabase schema

The application expects `public.memberships`. Its canonical creation migration
is not yet present and remains a private-beta launch blocker.

Repository migrations add:

1. `202607170001_progressive_access_previews.sql`
2. `202607170002_verified_outcomes.sql`
3. `202607170003_operation_launch.sql`

All enable RLS and create no client policies. Apply migrations manually only
after backup and review; application deployment never applies them.

## Local development and validation

```sh
npm run dev
npm run ops:validate
npm test
npm run typecheck
npm run lint
npm run build
npm run validate:artifact
npm run security:scan
```

`npm run install:ci` performs the bounded lockfile installation used by the
Linux build environment. The normal build also validates the generated Worker
and hosting manifest.

On macOS, GNU `timeout` is not installed by default, so the build emits a
warning and runs without an outer deadline. Production Linux builds remain
bounded.

## Deployment

1. Select and record the exact reviewed commit.
2. Confirm backups, migration state and rollback artifact.
3. Validate operations documentation, tests, types and lint.
4. Validate environment-variable presence in the target environment.
5. Build one immutable production artifact.
6. Deploy that artifact without implicit database changes.
7. Complete the production smoke-test checklist.
8. Observe authentication, Stripe webhooks, Supabase, provider freshness and
   application errors.

Use the full [launch playbook](docs/LAUNCH_PLAYBOOK.md),
[launch-readiness checklist](docs/LAUNCH_READINESS_CHECKLIST.md),
[deployment checklist](docs/DEPLOYMENT_CHECKLIST.md) and
[release checklist](docs/RELEASE_CHECKLIST.md).

## Production operations

The complete operations pack is indexed at [docs/README.md](docs/README.md). It
includes rollback and incident procedures for Stripe, Supabase, market-provider,
authentication and high-error-rate incidents.

## Versioning and changelog

The application is pre-1.0 and follows Semantic Versioning. New release notes
belong in root `CHANGELOG.md`; `CHANGELOG-v11.md` remains a historical archive.
See [docs/VERSIONING.md](docs/VERSIONING.md).

## Known launch gaps

The repository does not invent production account IDs, hostnames, thresholds or
credentials. Outstanding documents and decisions are listed in
[docs/MISSING_DOCUMENTATION.md](docs/MISSING_DOCUMENTATION.md), including the
canonical membership migration, service ownership, monitoring thresholds,
backup objectives, provider licensing and legal approval.
