# Environment Variable Reference

Values belong in the deployment secret/configuration manager. Never commit a
populated `.env` file. “Mandatory” means required for the stated production
capability; the application may deliberately fail closed when a provider is
absent.

## Supabase

| Variable | Visibility | Requirement | Used for |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Public | Mandatory | Browser/server Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Public | Mandatory | Browser/server Supabase publishable access |
| `SUPABASE_SERVICE_ROLE_KEY` | Secret, server only | Mandatory | Membership preview and verified-outcome server operations; Stripe membership synchronization |

## Stripe

| Variable | Visibility | Requirement | Used for |
|---|---|---|---|
| `STRIPE_SECRET_KEY` | Secret, server only | Mandatory for paid beta | Stripe API access from the webhook |
| `STRIPE_WEBHOOK_SECRET` | Secret, server only | Mandatory for paid beta | Webhook signature verification |
| `STRIPE_PRO_PRICE_ID` | Server config | Mandatory for Pro | Maps a Stripe Price to Pro |
| `STRIPE_ELITE_PRICE_ID` | Server config | Mandatory for Elite | Maps a Stripe Price to Elite |
| `NEXT_PUBLIC_STRIPE_PRO_CHECKOUT_URL` | Public | Mandatory for paid beta | Verified hosted checkout for the Pro product |
| `NEXT_PUBLIC_STRIPE_ELITE_CHECKOUT_URL` | Public | Mandatory for paid beta | Verified hosted checkout for the Elite product |
| `STRIPE_CUSTOMER_PORTAL_LINK` | Server-rendered config | Mandatory operationally | Member billing-management link; otherwise UI falls back to support email |

If a checkout URL is absent, the homepage routes the corresponding call to
action to the waiting list. Price IDs and checkout URLs must be verified as the
same products before paid beta.

## OpenAI

| Variable | Visibility | Requirement | Used for |
|---|---|---|---|
| `OPENAI_API_KEY` | Secret, server only | Optional; required when AI brief prioritisation is enabled | Authenticates the official server-side OpenAI client used by `/api/openai/health` and the market brief |
| `OPENAI_BRIEF_MODEL` | Server only | Optional; requires `OPENAI_API_KEY` when set | Selects the deployment-approved Responses API model for constrained market-brief prioritisation |
| `OPENAI_MORNING_BRIEF_MODEL` | Server only | Optional | Overrides the live dashboard Morning Brief model; falls back to `OPENAI_BRIEF_MODEL`, then the server default `gpt-5-mini` |

The key is read only from `process.env`, is never returned by the health route,
and must not use a `NEXT_PUBLIC_` or `VITE_` prefix. When either credential or
model access is unavailable, `/brief` retains its deterministic engine output
and labels the AI enhancement as inactive.

The dashboard Morning Brief calls OpenAI only for a complete verified brief and
an entitled Pro/Elite experience. It uses strict structured output, supplies
only deterministic Bullseye evidence, and rejects invented priorities, price
levels, instructions, certainty and malformed responses. Missing credentials,
rate limits, timeouts and provider failures retain the deterministic brief.

The internal Elite diagnostics page performs a sanitized minimal Responses API
generation check. It distinguishes authentication, exhausted quota, request
rate, model access, permission, timeout and provider failures without returning
a key, model output, raw exception, request URL or account detail.

## Launch email readiness

No email provider is connected by default. Provider-neutral waiting-list and
accepted Founding Member templates are implemented, but the application does
not dispatch them yet.

| Variable | Visibility | Requirement | Used for |
|---|---|---|---|
| `LAUNCH_EMAIL_PROVIDER` | Server config | Optional until dispatch is implemented | Approved transactional provider identifier |
| `LAUNCH_EMAIL_FROM` | Server config | Optional until dispatch is implemented | Verified sender identity |

Both values make diagnostics report template/configuration readiness only; they
do not enable sending. Provider credentials must be introduced as separately
documented server-only variables when a provider is selected.

## Market provider selection

| Variable | Visibility | Requirement | Used for |
|---|---|---|---|
| `MARKET_DATA_PROVIDER` | Server config | Mandatory for actionable private beta | `fmp` selects FMP; `preview` forces safe unavailable mode; other/empty may use generic URL |
| `MARKET_DATA_MAX_RETRIES` | Server config | Optional; default `1` | Gateway retry count |
| `MARKET_DATA_RETRY_DELAY_MS` | Server config | Optional; default `250` | Delay between retries |

## Financial Modeling Prep

Required together when `MARKET_DATA_PROVIDER=fmp`.

| Variable | Visibility | Requirement | Used for |
|---|---|---|---|
| `FMP_API_KEY` | Secret, server only | Conditional mandatory | FMP `apikey` query authentication |
| `FMP_API_BASE_URL` | Server config | Conditional mandatory | FMP Stable API base URL; must not contain the key |
| `FMP_REQUEST_TIMEOUT_MS` | Server config | Optional | Per-request timeout |
| `FMP_SP500_FUTURES_SYMBOL` | Server config | Optional | Override ES futures symbol |
| `FMP_VIX_SYMBOL` | Server config | Optional | Override VIX symbol |
| `FMP_US_DOLLAR_INDEX_SYMBOL` | Server config | Optional | Override dollar-index symbol |

The FMP adapter obtains US 2Y and 10Y Treasury rates from its Treasury endpoint;
there are no Treasury symbol variables. The current adapter does not implement
an economic calendar.

## Generic HTTP provider

Used as the alternate provider path when an FMP configuration is not selected.
The endpoint must return the application's normalized market snapshot schema.

| Variable | Visibility | Requirement | Used for |
|---|---|---|---|
| `MARKET_DATA_API_URL` | Secret if authenticated query is embedded; server only | Conditional mandatory | Normalized snapshot endpoint |
| `MARKET_DATA_API_TOKEN` | Secret, server only | Optional | Bearer authorization token |
| `MARKET_DATA_PROVIDER_NAME` | Server config | Optional | Provider attribution label |

Do not embed a credential in `MARKET_DATA_API_URL`.

## Build diagnostics

| Variable | Visibility | Requirement | Used for |
|---|---|---|---|
| `NODE_ENV` | Runtime config | Set by platform | Production/development/test label |
| `APP_VERSION` | Build config | Mandatory for traceability | SemVer application version |
| `BUILD_TIMESTAMP` | Build config | Mandatory for traceability | ISO-8601 build timestamp |
| `GIT_COMMIT_SHA` | Build config | Mandatory unless platform alternative exists | Deployed Git commit |
| `VERCEL_GIT_COMMIT_SHA` | Build config | Platform alternative | Vercel-provided commit |
| `CF_PAGES_COMMIT_SHA` | Build config | Platform alternative | Cloudflare-provided commit |
| `BULLSEYE_TEST_TOTALS` | Build config | Recommended | Positive verified-test count displayed by diagnostics |
| `BULLSEYE_ADMIN_EMAILS` | Server | Required for Founding reporting | Comma-separated authenticated operator emails permitted to open `/admin/founding-100`; never expose with `NEXT_PUBLIC_` |

Diagnostics fall back safely when metadata is missing; that fallback is not
sufficient for production release traceability.

## Build and local tooling

These variables are operational controls, not application secrets:

| Variable | Requirement | Used for |
|---|---|---|
| `SITES_RUNTIME_ROOT` | Optional | Project-local writable runtime location |
| `SITES_NPM_CACHE_SEED` | Optional | Verified dependency cache seed |
| `SITES_INSTALL_TIMEOUT` | Optional | Bounded dependency-install duration |
| `SITES_INSTALL_KILL_AFTER` | Optional | Install termination grace period |
| `SITES_BUILD_TIMEOUT` | Optional | Bounded production-build duration |
| `SITES_BUILD_KILL_AFTER` | Optional | Build termination grace period |
| `CODEX_SANDBOX` | Tool-managed | Enables polling for local HMR under Seatbelt |
| `WRANGLER_WRITE_LOGS` | Tool-managed/defaulted | Wrangler logging control |
| `WRANGLER_LOG_PATH` | Tool-managed/defaulted | Wrangler log path |
| `MINIFLARE_REGISTRY_PATH` | Tool-managed/defaulted | Miniflare registry path |

`SITES_ENV_READY` and `SITES_PROJECT_ROOT` are set internally by
`scripts/sites-env.sh`; operators should not configure them as application
variables.

## Rotation

Rotate immediately after suspected exposure. For planned rotation:

1. create the replacement in the external service;
2. update the hosting secret by name without recording the value;
3. redeploy and smoke-test;
4. revoke the old credential;
5. verify no webhook/provider/auth regression;
6. record owner, time and secret version identifier only.
