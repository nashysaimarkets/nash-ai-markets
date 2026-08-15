# Environment Variable Reference

Values belong in the deployment secret/configuration manager. Never commit a
populated `.env` file. “Mandatory” means required for the stated production
capability; the application may deliberately fail closed when a provider is
absent.

## Supabase

| Variable | Visibility | Requirement | Used for |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Public | Mandatory | Browser/server Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Public | Mandatory (preferred) | Browser/server publishable key (`sb_publishable_…`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public | Temporary fallback only | Legacy JWT `anon` key if publishable is unset; resolved centrally in `utils/supabase/config.ts` |
| `SUPABASE_SERVICE_ROLE_KEY` | Secret, server only | Mandatory | Membership preview and verified-outcome server operations; Stripe membership synchronization |

Public clients prefer `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, then fall back to `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Values are trimmed and wrapping quotes stripped. New-format keys are sent on the `apikey` header and are not duplicated into `Authorization: Bearer` (which causes Auth `401` for non-JWT keys).

## Stripe

| Variable | Visibility | Requirement | Used for |
|---|---|---|---|
| `STRIPE_SECRET_KEY` | Secret, server only | Mandatory for paid beta | Stripe API access from the webhook |
| `STRIPE_WEBHOOK_SECRET` | Secret, server only | Mandatory for paid beta | Webhook signature verification |
| `STRIPE_PRO_PRICE_ID` | Server config | Mandatory | Pro monthly (£14.99) Price ID; legacy variable retained for existing customers |
| `STRIPE_FOUNDING_PRO_PRICE_ID` | Server config | Mandatory only when activating Founding Pro checkout | Separate Pro monthly (£12) launch Price ID; must not equal the standard Pro Price |
| `STRIPE_ELITE_PRICE_ID` | Server config | Mandatory | Elite monthly (£29.99) Price ID; legacy variable retained for existing customers |
| `STRIPE_PRO_ANNUAL_PRICE_ID` | Server config | Mandatory | Pro annual (£149) Price ID |
| `STRIPE_ELITE_ANNUAL_PRICE_ID` | Server config | Mandatory | Elite annual (£299) Price ID |
| `NEXT_PUBLIC_STRIPE_PRO_CHECKOUT_URL` | Public | Legacy/optional | Previous hosted monthly checkout link |
| `NEXT_PUBLIC_STRIPE_ELITE_CHECKOUT_URL` | Public | Legacy/optional | Previous hosted monthly checkout link |
| `STRIPE_CUSTOMER_PORTAL_LINK` | Server-rendered config | Mandatory operationally | Member billing-management link; otherwise UI falls back to support email |

The pricing page posts an enumerated offering to the server. The server selects
the corresponding Price ID and creates Stripe Checkout; Price IDs and the
secret key are never returned to browser code. Configure products and prices
manually in Stripe test mode before production verification.
Founding Pro checkout remains unavailable when its dedicated variable is absent.
The server retrieves that Price before creating Checkout and requires it to be
active, recurring monthly, GBP and exactly 1200 pence. Only a signed subscription
event carrying that exact valid Price is eligible for a new Founding Pro place.

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

Provider-neutral launch templates and a fail-closed Resend transport are
implemented. Dispatch remains dormant unless the supported provider, a verified
sender and the server-only API key are all configured. Configuration alone does
not clear the operational launch gate: sender-domain authentication, suppression
handling, idempotency, delivery monitoring and ownership still require evidence.

| Variable | Visibility | Requirement | Used for |
|---|---|---|---|
| `LAUNCH_EMAIL_PROVIDER` | Server config | Optional until launch dispatch is approved; supported value `resend` | Selects the approved transactional transport; blank or unsupported values keep dispatch disabled |
| `LAUNCH_EMAIL_FROM` | Server config | Conditional mandatory with `resend` | Verified sender identity used for launch and membership email templates |
| `RESEND_API_KEY` | Secret, server only | Conditional mandatory when `LAUNCH_EMAIL_PROVIDER=resend` | Authenticates the dormant Resend transactional-email transport; never expose with `NEXT_PUBLIC_` |

The transport validates recipients and idempotency before network dispatch,
sends branded plain-text templates, and fails closed on provider errors. Missing
or incomplete configuration leaves sending disabled. Never use repeated magic
links or customer mail as a readiness probe; exercise delivery only through the
approved staging matrix and record suppression and monitoring evidence.

## Market provider selection

## Free official macro context

The Treasury, Federal Reserve Board, New York Fed funding-rate and BLS feeds
require no key. BEA and Census observations are enabled only when their free
server-side API keys are present. The complete official macro bundle is cached
for 15 minutes per server instance to prevent repeated upstream calls across
Dashboard, Morning Brief and Trading Desk. These slow-moving observations never
replace ES/VIX and never enter the intraday decision engine.

| Variable | Visibility | Requirement | Used for |
|---|---|---|---|
| `BEA_API_KEY` | Secret, server only | Optional | GDP, PCE and personal-income observations from BEA |
| `CENSUS_API_KEY` | Secret, server only | Optional | Retail sales, housing, durable-goods and trade observations from Census EITS |


| Variable | Visibility | Requirement | Used for |
|---|---|---|---|
| `MARKET_DATA_PROVIDER` | Server config | Mandatory for actionable production data | `fmp` selects FMP; `preview` forces safe unavailable mode; other/empty may use generic URL |
| `MARKET_DATA_MAX_RETRIES` | Server config | Optional; default `1` | Gateway retry count |
| `MARKET_DATA_RETRY_DELAY_MS` | Server config | Optional; default `250` | Delay between retries |

Verified live/delayed snapshots use a fixed 15-second, per-instance in-memory
cache. Concurrent requests share one provider load; unavailable results are not
retained. This is intentionally not an environment variable: operators cannot
silently widen the freshness window. Elite diagnostics report cache hits,
coalesced requests, provider loads and an estimate of upstream calls avoided.
Counters reset on instance restart and are operational indicators, not billing
records.

## Financial Modeling Prep

`MARKET_DATA_PROVIDER=fmp` and `FMP_API_KEY` are required together. The base URL
is optional and defaults to the official FMP Stable endpoint.

| Variable | Visibility | Requirement | Used for |
|---|---|---|---|
| `FMP_API_KEY` | Secret, server only | Conditional mandatory | FMP `apikey` query authentication |
| `FMP_API_BASE_URL` | Server config | Optional; defaults to `https://financialmodelingprep.com/stable/` | FMP Stable API base URL override; must use HTTPS and must not contain the key |
| `FMP_REQUEST_TIMEOUT_MS` | Server config | Optional | Per-request timeout |
| `FMP_SP500_FUTURES_SYMBOL` | Server config | Optional | Override ES futures symbol |
| `FMP_VIX_SYMBOL` | Server config | Optional | Override VIX symbol |
| `FMP_US_DOLLAR_INDEX_SYMBOL` | Server config | Optional | Override dollar-index symbol |
| `FMP_OIL_SYMBOL` | Server config | Optional | Override oil proxy symbol (default `USO`) |
| `FMP_QQQ_SYMBOL` | Server config | Optional | Override QQQ symbol (default `QQQ`) |
| `FMP_NASDAQ_SYMBOL` | Server config | Optional | Override Nasdaq index symbol (default `^IXIC`) |
| `BULLSEYE_CANDLE_FIXTURE_PATH` | Local test config | Optional; forbidden in hosted/production builds | Absolute path to the explicitly labelled, non-live candle fixture used only for local layout and automated test acceptance |

The default candle symbol `ESUSD` is FMP's commodity-series identifier named
`E-Mini S&P 500`, with currency `USD` and exchange classification `CME`. It is
not a dated contract code, and the candle response does not establish the exact
underlying contract, rollover method, exchange-native provenance or real-time
entitlement. Bullseye therefore displays the provider symbol and classification
and labels fresh candles as delayed unless stronger provider metadata is added.

The FMP adapter obtains US 2Y and 10Y Treasury rates from its Treasury endpoint;
there are no Treasury symbol variables. The primary quote adapter does not
implement an economic calendar; the separate dashboard candle path loads
verified 5-minute OHLCV history. FMP may canonicalize a
requested continuous-contract or index alias in a single-record quote response;
the adapter accepts that canonical alias only when the response contains
exactly one structurally valid record from the symbol-scoped request.

FMP's authenticated Stable index catalogue identifies `DX-Y.NYB` as the
`US Dollar Index`. Bullseye additionally requires the returned quote to use
that exact provider symbol, the name `US Dollar Index`, exchange classification
`INDEX`, a finite price, and a valid provider timestamp. `USDXUSD` is not an
index alias: FMP identifies it as the unrelated `USDX [Lighthouse] USD` crypto
asset, so it must not be configured as the Dollar Index.

HTTP 402 responses remain fail closed and are reported as `access_restricted`.
That status does not, by itself, prove that a particular paid plan will resolve
the request. The account owner must confirm the endpoint, instrument, account
entitlement, and any display or redistribution licence with the provider before
changing the symbol or subscription.

`BULLSEYE_CANDLE_FIXTURE_PATH` is a local acceptance aid, not a market-data
provider. The application ignores it whenever an FMP key is configured and
blocks it on hosted previews and production Node builds. Fixture output is
explicitly labelled non-production and must never be used as launch evidence,
trading context, or a substitute for provider entitlement.

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
| `VERCEL_GIT_COMMIT_REF` | Build config | Platform alternative | Vercel-provided source branch reference |
| `VERCEL_URL` | Runtime config | Platform alternative | Vercel deployment hostname used for same-origin diagnostics |
| `VERCEL_ENV` | Runtime config | Platform alternative | Vercel environment classification such as preview or production |
| `VERCEL` | Runtime flag | Platform-managed | Indicates that the application is running in Vercel's hosted runtime |
| `CF_PAGES_COMMIT_SHA` | Build config | Platform alternative | Cloudflare-provided commit |
| `BULLSEYE_TEST_TOTALS` | Build config | Recommended | Positive verified-test count displayed by diagnostics |
| `BULLSEYE_ADMIN_EMAILS` | Server | Required for Founding reporting | Comma-separated authenticated operator emails permitted to open `/admin/founding-100`; never expose with `NEXT_PUBLIC_` |

Diagnostics fall back safely when metadata is missing; that fallback is not
sufficient for production release traceability.

## Dedicated Playwright audit

These variables are test-runner controls only. They must be populated locally or
in a protected CI secret store for a dedicated, non-customer audit account. They
must never be exposed with a `NEXT_PUBLIC_` prefix or copied into production
runtime configuration.

| Variable | Visibility | Requirement | Used for |
|---|---|---|---|
| `AUDIT_BASE_URL` | Test config | Optional; required for authenticated hosted audit | Exact private preview/staging origin targeted by Playwright evidence runs |
| `AUDIT_USER_EMAIL` | Secret, test only | Optional; required for credential-based audit setup | Dedicated non-customer audit account email |
| `AUDIT_USER_PASSWORD` | Secret, test only | Optional; required for credential-based audit setup | Dedicated non-customer audit account password; never use a real member credential |

Authenticated staging evidence may instead use the project-standard, gitignored
storage-state workflow. These controls do not bypass authentication, create a
member, weaken route guards, or make physical-device/accessibility evidence
appear complete.

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