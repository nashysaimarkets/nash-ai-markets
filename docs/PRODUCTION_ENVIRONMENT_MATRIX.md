# Production Environment Matrix

Values must be entered in the target hosting environment manager. Never paste
values into tickets, screenshots, Git, chat transcripts or build output.
“Both” means separate staging and production values unless the source is
release metadata.

## Application and integration variables

| Exact name | Purpose | Secret | Source | Target | Safe validation |
|---|---|---:|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Auth and database project URL | No | Supabase project settings/API URL | Both | Confirm HTTPS host equals the selected project; request login and verify diagnostics without printing the value |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Browser/server Supabase publishable access | No | Supabase project API keys/publishable key | Both | Confirm client initializes and anonymous RLS tests deny protected data |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only administrative database access | Yes | Supabase project API keys/service role | Both | Run a server-only waiting-list or report smoke test; confirm it is absent from browser bundles/logs |
| `STRIPE_SECRET_KEY` | Creates Checkout Sessions and retrieves subscriptions | Yes | Stripe Developers/API keys; test key for staging, live key only after approval | Both | Confirm staging dashboard says Test mode and one test Checkout Session is created; never display the key |
| `STRIPE_WEBHOOK_SECRET` | Verifies Stripe webhook signatures | Yes | Stripe webhook endpoint signing secret | Both | Deliver a signed test event and expect 2xx; an unsigned request must return 400 |
| `STRIPE_PRO_PRICE_ID` | Pro monthly Price mapping | No, server config | Stripe Pro £14.99 monthly Price | Both | Inspect Price currency/amount/interval in Stripe, then complete test checkout and verify stored `pro/month` |
| `STRIPE_ELITE_PRICE_ID` | Elite monthly Price mapping | No, server config | Stripe Elite £29.99 monthly Price | Both | Inspect Price and verify stored `elite/month` after test checkout |
| `STRIPE_PRO_ANNUAL_PRICE_ID` | Pro annual Price mapping | No, server config | Stripe Pro £149 annual Price | Both | Inspect Price and verify stored `pro/year` after test checkout |
| `STRIPE_ELITE_ANNUAL_PRICE_ID` | Elite annual Price mapping | No, server config | Stripe Elite £299 annual Price | Both | Inspect Price and verify stored `elite/year` after test checkout |
| `STRIPE_CUSTOMER_PORTAL_LINK` | Member billing-management destination | Treat as restricted config | Stripe customer portal configuration/link | Both | Open from a dedicated test customer and confirm the correct account/allowed changes |
| `BULLSEYE_ADMIN_EMAILS` | Exact allowlist for Founding/commercial admin pages | Personal restricted config | Approved operator identities | Both | Authorized account succeeds; ordinary member redirects; do not capture addresses in evidence |
| `OPENAI_API_KEY` | Server-side Responses API authentication | Yes | OpenAI project API key | Both if AI enhancement enabled | Authenticated health endpoint reports only `connected` or a sanitized category |
| `OPENAI_BRIEF_MODEL` | Approved AI Market Brief model override | No, server config | Deployment/model-access decision | Both if override used | Health check and mocked/fallback brief pass; never record model output as proof of key validity |
| `OPENAI_MORNING_BRIEF_MODEL` | Dashboard Morning Brief model override | No, server config | Deployment/model-access decision | Both if override used | Verified entitled brief generates or safely falls back |
| `LAUNCH_EMAIL_PROVIDER` | Template/readiness provider identifier | No | Approved transactional-email decision | Both only after provider selection | Diagnostics show configuration readiness; note that repository has no dispatch implementation |
| `LAUNCH_EMAIL_FROM` | Verified sender identity | Personal restricted config | Approved email provider/domain | Both only after provider selection | Provider dashboard confirms domain/sender; repository diagnostics alone do not prove delivery |
| `MARKET_DATA_PROVIDER` | Selects `fmp`, `preview` or generic provider | No | Deployment decision | Both | Diagnostics report expected provider; `preview` must remain non-actionable |
| `FMP_API_KEY` | FMP Stable API query authentication | Yes | Licensed FMP account | Both when provider is `fmp` | Diagnostics report accepted/fresh data or sanitized failure; inspect no URL/log for `apikey` |
| `FMP_API_BASE_URL` | Optional FMP Stable API base URL override; defaults to `https://financialmodelingprep.com/stable/` | No | Official FMP deployment configuration | Both when overriding the default | `npm run ops:check-env`; confirm HTTPS and no `apikey=` in value |
| `FMP_REQUEST_TIMEOUT_MS` | Per-request timeout | No | Operations policy; default is 4500 | Both optional | Simulated timeout fails closed within expected window |
| `FMP_SP500_FUTURES_SYMBOL` | Optional ES futures symbol override | No | Verified provider symbol catalogue | Both optional | Provider attribution and returned instrument match; do not guess a symbol |
| `FMP_VIX_SYMBOL` | Optional VIX symbol override | No | Verified provider symbol catalogue | Both optional | Returned instrument/timestamp validates |
| `FMP_US_DOLLAR_INDEX_SYMBOL` | Optional dollar-index override | No | Verified provider symbol catalogue | Both optional | Returned instrument/timestamp validates |
| `MARKET_DATA_MAX_RETRIES` | Gateway retry count | No | Operations policy; default is 1 | Both optional | Mocked retry test and provider request-rate observation |
| `MARKET_DATA_RETRY_DELAY_MS` | Gateway backoff delay | No | Operations policy; default is 250 ms | Both optional | Mocked retry timing and no refresh storm |
| `MARKET_DATA_API_URL` | Alternate normalized snapshot endpoint | Potentially | Approved alternate provider | Both only for generic provider | Confirm HTTPS/schema and that URL contains no credential |
| `MARKET_DATA_API_TOKEN` | Alternate provider bearer token | Yes | Approved alternate provider | Both only for generic provider | Server request succeeds; browser bundle and logs contain no token |
| `MARKET_DATA_PROVIDER_NAME` | Alternate provider attribution | No | Provider contract | Both only for generic provider | Terminal attribution matches contract |
| `APP_VERSION` | Release provenance | No | `package.json`/release decision | Both | Diagnostics exactly match approved SemVer |
| `BUILD_TIMESTAMP` | Immutable build provenance | No | CI build start in ISO-8601 UTC | Both | `npm run ops:check-env`; diagnostics parse and display expected timestamp |
| `GIT_COMMIT_SHA` | Immutable source provenance | No | CI checkout SHA | Both | Diagnostics show first 12 characters matching the approved commit |
| `VERCEL_GIT_COMMIT_SHA` | Alternative platform-provided commit | No | Vercel, if used | Both platform-only | Same comparison; do not configure alongside a contradictory SHA |
| `CF_PAGES_COMMIT_SHA` | Alternative platform-provided commit | No | Cloudflare Pages, if supplied | Both platform-only | Same comparison; current Sites artifact may instead use `GIT_COMMIT_SHA` |
| `BULLSEYE_TEST_TOTALS` | Verified regression-test count | No | Final CI test result | Both | Positive integer equals the exact final suite; diagnostics otherwise show Unavailable |
| `NODE_ENV` | Runtime mode | No | Hosting platform | Both | Must report `production` for deployed staging/production builds |

`NEXT_PUBLIC_STRIPE_PRO_CHECKOUT_URL` and
`NEXT_PUBLIC_STRIPE_ELITE_CHECKOUT_URL` are legacy optional names and are not
read by the current application. Do not configure them for the server-created
Checkout flow.

There is currently no environment variable for ES historical candles. The FMP
adapter supplies quote snapshots only; `chartDataForStatus` deliberately
returns an empty verified-candle state. Production OHLCV is therefore a release
gate requiring an approved provider endpoint, subscription entitlement, schema,
timeframe policy and regression tests. Do not point an undocumented URL at the
chart or infer candles from quote snapshots.

## Build/tool variables

These are not product runtime requirements. Use only where the selected build
runner requires them.

| Exact name | Purpose | Secret | Source | Target | Safe validation |
|---|---|---:|---|---|---|
| `SITES_RUNTIME_ROOT` | Writable Sites runtime location | No | Build platform | Staging and production build jobs if required | Build completes without writing outside the allowed runtime |
| `SITES_NPM_CACHE_SEED` | Verified dependency-cache seed | No | Build platform | Build jobs only | Locked install succeeds |
| `SITES_INSTALL_TIMEOUT` | Install deadline | No | CI policy | Build jobs optional | Deliberate bounded install behaves as documented |
| `SITES_INSTALL_KILL_AFTER` | Install termination grace | No | CI policy | Build jobs optional | CI records bounded termination |
| `SITES_BUILD_TIMEOUT` | Build deadline | No | CI policy | Build jobs optional | Build completes or exits cleanly at deadline |
| `SITES_BUILD_KILL_AFTER` | Build termination grace | No | CI policy | Build jobs optional | CI records bounded termination |
| `WRANGLER_WRITE_LOGS` | Wrangler local/build logging control | No | Tool default | Build/runtime tooling only | No secret-bearing log file is produced |
| `WRANGLER_LOG_PATH` | Wrangler log path | No | Tool default | Build/runtime tooling only | Path is writable and excluded from Git |
| `MINIFLARE_REGISTRY_PATH` | Local Miniflare registry | No | Tool default | Local/staging tooling only | Local runtime starts without global writes |
| `CODEX_SANDBOX` | Enables polling in Codex Seatbelt | No | Codex tooling | Local only | Never configure in production |
| `SITES_ENV_READY` | Internal script marker | No | `scripts/sites-env.sh` | Internal only | Operators do not set it |
| `SITES_PROJECT_ROOT` | Internal project-root marker | No | `scripts/sites-env.sh` | Internal only | Operators do not set it |

## Environment acceptance

1. Enter names and values directly in the hosting manager.
2. Scope staging values only to staging and production values only to
   production.
3. Trigger a staging build.
4. Run `npm run ops:check-env` inside that environment.
5. Record only pass/fail, variable names and secret version identifiers.
6. Complete service-specific smoke tests; presence does not prove validity.
