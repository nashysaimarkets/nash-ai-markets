# Environment Variable Reference

Values belong in the deployment secret/configuration manager. Never commit populated secrets. The application fails closed when optional providers are absent.

## AI
- `OPENAI_API_KEY` — server secret for OpenAI.
- `OPENAI_BRIEF_MODEL` — optional server model override.
- `OPENAI_MORNING_BRIEF_MODEL` — optional Morning Brief model override.
- `OPENAI_POCKET_MODEL` — optional Pocket Bullseye chart-analysis model override.

## Supabase
- `NEXT_PUBLIC_SUPABASE_URL` — public project URL.
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — public publishable key.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — temporary legacy public fallback.
- `SUPABASE_SERVICE_ROLE_KEY` — server-only secret.

## Stripe
- `STRIPE_SECRET_KEY` — server secret.
- `STRIPE_WEBHOOK_SECRET` — server webhook secret.
- `STRIPE_PRO_PRICE_ID` — Pro monthly Price ID.
- `STRIPE_FOUNDING_PRO_PRICE_ID` — conditional Founding Pro Price ID.
- `STRIPE_ELITE_PRICE_ID` — Elite monthly Price ID.
- `STRIPE_PRO_ANNUAL_PRICE_ID` — Pro annual Price ID.
- `STRIPE_ELITE_ANNUAL_PRICE_ID` — Elite annual Price ID.
- `STRIPE_CUSTOMER_PORTAL_LINK` — billing portal link.
- `NEXT_PUBLIC_STRIPE_PRO_CHECKOUT_URL` — public legacy checkout configuration.
- `NEXT_PUBLIC_STRIPE_ELITE_CHECKOUT_URL` — public legacy checkout configuration.

## Launch email
- `LAUNCH_EMAIL_PROVIDER` — optional approved transport selector.
- `LAUNCH_EMAIL_FROM` — conditional verified sender.
- `RESEND_API_KEY` — conditional server secret for Resend.

## Official macro providers
- `BEA_API_KEY` — optional server key for the official BEA API; feed fails closed when absent.
- `CENSUS_API_KEY` — optional server key for the official Census API; feed fails closed when absent.

## Market provider
- `MARKET_DATA_PROVIDER` — provider selector.
- `MARKET_DATA_MAX_RETRIES` — optional retry count.
- `MARKET_DATA_RETRY_DELAY_MS` — optional retry delay.
- `FMP_API_KEY` — server secret for FMP.
- `FMP_API_BASE_URL` — optional FMP base URL.
- `FMP_REQUEST_TIMEOUT_MS` — optional request timeout.
- `FMP_SP500_FUTURES_SYMBOL` — optional ES symbol override.
- `FMP_VIX_SYMBOL` — optional VIX symbol override.
- `FMP_US_DOLLAR_INDEX_SYMBOL` — optional dollar-index symbol override.
- `FMP_OIL_SYMBOL` — optional oil symbol override.
- `FMP_QQQ_SYMBOL` — optional QQQ symbol override.
- `FMP_NASDAQ_SYMBOL` — optional Nasdaq symbol override.
- `BULLSEYE_CANDLE_FIXTURE_PATH` — local-only non-live candle fixture; forbidden in hosted/production builds.
- `MARKET_DATA_API_URL` — optional alternative normalized provider endpoint.
- `MARKET_DATA_API_TOKEN` — optional server bearer token.
- `MARKET_DATA_PROVIDER_NAME` — optional provider label.

## Build/runtime diagnostics
- `NODE_ENV`
- `APP_VERSION`
- `BUILD_TIMESTAMP`
- `GIT_COMMIT_SHA`
- `VERCEL_GIT_COMMIT_SHA`
- `VERCEL_GIT_COMMIT_REF`
- `VERCEL_URL`
- `VERCEL_ENV`
- `VERCEL`
- `BULLSEYE_TEST_TOTALS`
- `BULLSEYE_ADMIN_EMAILS`

## Dedicated audit
- `AUDIT_BASE_URL` — test-only hosted audit origin.
- `AUDIT_USER_EMAIL` — dedicated test account secret.
- `AUDIT_USER_PASSWORD` — dedicated test account secret.

## Build/local tooling
- `SITES_RUNTIME_ROOT`
- `SITES_NPM_CACHE_SEED`
- `SITES_INSTALL_TIMEOUT`
- `SITES_INSTALL_KILL_AFTER`
- `SITES_BUILD_TIMEOUT`
- `SITES_BUILD_KILL_AFTER`

Never expose server secrets with `NEXT_PUBLIC_` or `VITE_` prefixes. Rotate credentials immediately after suspected exposure. OpenAI Responses requests explicitly use `store: false`; Pocket Bullseye retains deterministic fallback output when AI is unavailable.

<!-- Pocket Bullseye launch-gate verification marker: documentation validated on 2026-08-20. -->
