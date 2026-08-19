# Environment Variable Reference

Values belong in the deployment secret/configuration manager. Never commit a populated `.env` file. “Mandatory” means required for the stated production capability; the application may deliberately fail closed when a provider is absent.

## OpenAI

| Variable | Visibility | Requirement | Used for |
|---|---|---|---|
| `OPENAI_API_KEY` | Secret, server only | Optional; required when AI brief prioritisation is enabled | Authenticates the official server-side OpenAI client used by `/api/openai/health` and the market brief |
| `OPENAI_BRIEF_MODEL` | Server only | Optional; requires `OPENAI_API_KEY` when set | Selects the deployment-approved Responses API model for constrained market-brief prioritisation |
| `OPENAI_MORNING_BRIEF_MODEL` | Server only | Optional | Overrides the live dashboard Morning Brief model; falls back to `OPENAI_BRIEF_MODEL`, then the server default `gpt-5-mini` |
| `OPENAI_POCKET_MODEL` | Server only | Optional; requires `OPENAI_API_KEY` when set | Selects the deployment-approved Responses API model for Pocket Bullseye chart-analysis prioritisation |

The key is read only from `process.env`, is never returned by the health route, and must not use a `NEXT_PUBLIC_` or `VITE_` prefix. When either credential or model access is unavailable, Bullseye retains its deterministic engine output and labels the AI enhancement as inactive.

Pocket Bullseye uses strict structured output and supplies only deterministic Bullseye evidence. AI responses must not invent priorities, price levels, instructions, certainty or malformed content. Missing credentials, rate limits, timeouts and provider failures retain the deterministic result.

Every OpenAI Responses request explicitly sets `store: false`; this avoids default Responses application-state storage but does not remove separate provider abuse-monitoring retention or replace account-level privacy controls.

## Supabase

| Variable | Visibility | Requirement | Used for |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Public | Mandatory | Browser/server Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Public | Mandatory (preferred) | Browser/server publishable key |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public | Temporary fallback only | Legacy JWT `anon` key |
| `SUPABASE_SERVICE_ROLE_KEY` | Secret, server only | Mandatory | Membership preview and verified-outcome server operations; Stripe membership synchronization |

## Stripe

| Variable | Visibility | Requirement | Used for |
|---|---|---|---|
| `STRIPE_SECRET_KEY` | Secret, server only | Mandatory for paid beta | Stripe API access |
| `STRIPE_WEBHOOK_SECRET` | Secret, server only | Mandatory for paid beta | Webhook signature verification |
| `STRIPE_PRO_PRICE_ID` | Server config | Mandatory | Pro monthly Price ID |
| `STRIPE_FOUNDING_PRO_PRICE_ID` | Server config | Conditional | Founding Pro launch Price ID |
| `STRIPE_ELITE_PRICE_ID` | Server config | Mandatory | Elite monthly Price ID |
| `STRIPE_PRO_ANNUAL_PRICE_ID` | Server config | Mandatory | Pro annual Price ID |
| `STRIPE_ELITE_ANNUAL_PRICE_ID` | Server config | Mandatory | Elite annual Price ID |
| `STRIPE_CUSTOMER_PORTAL_LINK` | Server-rendered config | Mandatory operationally | Member billing-management link |

## Launch email readiness

Provider-neutral launch templates and a fail-closed Resend transport are implemented. Dispatch remains dormant unless the supported provider, a verified sender and the server-only API key are all configured. Configuration alone does not clear the operational launch gate: sender-domain authentication, suppression handling, idempotency, delivery monitoring and ownership still require evidence.

| Variable | Visibility | Requirement | Used for |
|---|---|---|---|
| `LAUNCH_EMAIL_PROVIDER` | Server config | Optional until launch dispatch is approved | Selects the approved transactional transport |
| `LAUNCH_EMAIL_FROM` | Server config | Conditional mandatory with `resend` | Verified sender identity |
| `RESEND_API_KEY` | Secret, server only | Conditional mandatory with `resend` | Authenticates dormant transactional email transport |

## Market provider selection

| Variable | Visibility | Requirement | Used for |
|---|---|---|---|
| `MARKET_DATA_PROVIDER` | Server config | Mandatory for actionable production data | Selects FMP, preview, or generic provider path |
| `MARKET_DATA_MAX_RETRIES` | Server config | Optional; default `1` | Gateway retry count |
| `MARKET_DATA_RETRY_DELAY_MS` | Server config | Optional; default `250` | Delay between retries |

Verified live/delayed snapshots use a fixed 15-second per-instance in-memory cache. Concurrent requests share one provider load; unavailable results are not retained. This intentionally limits upstream calls and data usage.

## Financial Modeling Prep

`MARKET_DATA_PROVIDER=fmp` and `FMP_API_KEY` are required together. The base URL defaults to the official FMP Stable endpoint.

| Variable | Visibility | Requirement | Used for |
|---|---|---|---|
| `FMP_API_KEY` | Secret, server only | Conditional mandatory | FMP authentication |
| `FMP_API_BASE_URL` | Server config | Optional | FMP Stable API base URL override |
| `FMP_REQUEST_TIMEOUT_MS` | Server config | Optional | Per-request timeout |
| `FMP_SP500_FUTURES_SYMBOL` | Server config | Optional | ES futures symbol override |
| `FMP_VIX_SYMBOL` | Server config | Optional | VIX symbol override |
| `FMP_US_DOLLAR_INDEX_SYMBOL` | Server config | Optional | Dollar-index symbol override |
| `FMP_OIL_SYMBOL` | Server config | Optional | Oil proxy symbol override |
| `FMP_QQQ_SYMBOL` | Server config | Optional | QQQ symbol override |
| `FMP_NASDAQ_SYMBOL` | Server config | Optional | Nasdaq index symbol override |
| `BULLSEYE_CANDLE_FIXTURE_PATH` | Local test config | Optional; forbidden in hosted/production builds | Explicit non-live candle fixture for local acceptance only |

HTTP 402 responses remain fail closed as `access_restricted`. Provider entitlement and display/redistribution rights must be confirmed before production use.

## Generic HTTP provider

| Variable | Visibility | Requirement | Used for |
|---|---|---|---|
| `MARKET_DATA_API_URL` | Server only | Conditional mandatory | Normalized snapshot endpoint |
| `MARKET_DATA_API_TOKEN` | Secret, server only | Optional | Bearer authorization token |
| `MARKET_DATA_PROVIDER_NAME` | Server config | Optional | Provider attribution label |

Do not embed credentials in `MARKET_DATA_API_URL`.

## Build diagnostics

| Variable | Visibility | Requirement | Used for |
|---|---|---|---|
| `NODE_ENV` | Runtime config | Platform-managed | Runtime label |
| `APP_VERSION` | Build config | Mandatory for traceability | SemVer application version |
| `BUILD_TIMESTAMP` | Build config | Mandatory for traceability | ISO-8601 build timestamp |
| `GIT_COMMIT_SHA` | Build config | Mandatory unless platform alternative exists | Deployed Git commit |
| `VERCEL_GIT_COMMIT_SHA` | Build config | Platform alternative | Vercel commit |
| `VERCEL_GIT_COMMIT_REF` | Build config | Platform alternative | Vercel branch |
| `VERCEL_URL` | Runtime config | Platform alternative | Vercel deployment hostname |
| `VERCEL_ENV` | Runtime config | Platform alternative | Vercel environment classification |
| `VERCEL` | Runtime flag | Platform-managed | Hosted-runtime indicator |
| `BULLSEYE_TEST_TOTALS` | Build config | Recommended | Positive verified-test count |
| `BULLSEYE_ADMIN_EMAILS` | Server | Required for Founding reporting | Authenticated operator emails permitted for Founding reporting |

Diagnostics fall back safely when metadata is missing; that fallback is not sufficient for production release traceability.

## Dedicated Playwright audit

These variables are test-runner controls only. They must be populated locally or in a protected CI secret store for a dedicated, non-customer audit account. They must never be exposed with a `NEXT_PUBLIC_` prefix or copied into production runtime configuration.

| Variable | Visibility | Requirement | Used for |
|---|---|---|---|
| `AUDIT_BASE_URL` | Test config | Optional; required for authenticated hosted audit | Exact private preview/staging origin |
| `AUDIT_USER_EMAIL` | Secret, test only | Optional; required for credential-based audit setup | Dedicated non-customer audit account |
| `AUDIT_USER_PASSWORD` | Secret, test only | Optional; required for credential-based audit setup | Dedicated non-customer audit account password |

Authenticated staging evidence may instead use the project-standard gitignored storage-state workflow. These controls do not bypass authentication or weaken route guards.

## Build and local tooling

| Variable | Requirement | Used for |
|---|---|---|
| `SITES_RUNTIME_ROOT` | Optional | Project-local writable runtime location |
| `SITES_NPM_CACHE_SEED` | Optional | Dependency cache seed |
| `SITES_INSTALL_TIMEOUT` | Optional | Bounded dependency-install duration |
| `SITES_INSTALL_KILL_AFTER` | Optional | Install termination grace period |
| `SITES_BUILD_TIMEOUT` | Optional | Bounded production-build duration |
| `SITES_BUILD_KILL_AFTER` | Optional | Build termination grace period |

`SITES_ENV_READY` and `SITES_PROJECT_ROOT` are set internally by `scripts/sites-env.sh`; operators should not configure them as application variables.

## Rotation

Rotate immediately after suspected exposure. For planned rotation: create the replacement; update the hosting secret by name without recording the value; redeploy and smoke-test; revoke the old credential; verify no regression; record owner, time and secret version identifier only.
