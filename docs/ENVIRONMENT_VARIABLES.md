# Environment Variable Reference

Values belong in the deployment secret/configuration manager. Never commit populated secrets. The application fails closed when optional providers are absent.

## AI
- `OPENAI_API_KEY` | Secret, server only.
- `OPENAI_BRIEF_MODEL` — optional server model override.
- `OPENAI_MORNING_BRIEF_MODEL` — optional Morning Brief model override.
- `OPENAI_SECOND_OPINION_MODEL` — optional standalone Second Opinion model override; falls back to the default OpenAI model when absent.
- `SECOND_OPINION_PRIVATE_PILOT` — server-side screenshot-analysis gate; only the exact value `enabled` permits AI image interpretation, otherwise the route returns plan-only output.
- `OPENAI_POCKET_MODEL` — optional Pocket Bullseye chart-analysis model override.
- `OPENAI_POCKET_ANNOTATION_MODEL` — optional Pocket Bullseye annotation model override.
- `POCKET_BUDGET_SALT` — optional server-only salt for Pocket request-budget keys.
- `POCKET_TORTURE_LIVE_ENABLED` — preview-only benchmark opt-in; only the exact string `true` allows attempting the billed route. Leave unset/false until the separate pilot ledger, exact project/model/tier/pricing bounds and independent gates are verified.
- `POCKET_TORTURE_LIVE_TOKEN` — server-only random secret of at least 32 characters. A preview live benchmark must supply the exact secret in `x-pocket-torture-token`. Never place it in client code, URLs or logs. Leave unset unless a billed test is explicitly authorised and cost-bounded.

## Apple server verification and native pin

- `POCKET_APPLE_ENVIRONMENT` — server only; exactly `Production` or `Sandbox`. Sandbox is rejected on Vercel production. No automatic environment fallback.
- `POCKET_APPLE_SIGNING_KEY` — server-only App Store In-App Purchase private signing key; never a public environment variable.
- `POCKET_APPLE_KEY_ID` — server-only key identifier matching the In-App Purchase key.
- `POCKET_APPLE_ISSUER_ID` — server-only App Store Connect issuer identifier.
- `POCKET_APPLE_ROOT_CERTIFICATES_BASE64` — server-only JSON array of base64 DER Apple root certificates obtained from Apple's PKI distribution and independently validated. Never accept certificate roots from a client.
- `POCKET_APPLE_APP_ID` — numeric App Store application ID for the verified bundle (existing Pocket listing: 6806004581).
- `CAPACITOR_SERVER_URL` — immutable verified HTTPS deployment URL ending in `/pocket`; production and mutable branch aliases are rejected.
- `CAPACITOR_SERVER_REVISION` — exact 40-character commit served by that immutable URL. Native verification must match it before sync/build.

Apple configuration is not activated by source integration. Missing configuration or failed signature/status checks deny access. Purchases lacking an account token must not be silently reassigned; verified legacy ownership migration and server-controlled first-free consumption remain release blockers.

## Supabase credentials
- `NEXT_PUBLIC_SUPABASE_URL` — public project URL.
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — public publishable key.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — temporary legacy public fallback.
- `SUPABASE_SERVICE_ROLE_KEY` — server-only secret.

## Stripe
- `STRIPE_SECRET_KEY` — server secret.
- `STRIPE_WEBHOOK_SECRET` — server webhook secret.
- `STRIPE_PRO_PRICE_ID` — Pro monthly Price ID.
- `STRIPE_FOUNDING_PRO_PRICE_ID` — conditional Founding Pro Price ID.
- `STRIPE_POCKET_FOUNDING_PRICE_ID` — Pocket Bullseye founding monthly Price ID.
- `POCKET_CHECKOUT_STRIPE_ACCOUNT_ID` — proposed server-only expected Stripe Account ID; unconfigured on all hosts. Same-SDK account/Price observations must match. Not a credential or baseline override.
- `POCKET_CHECKOUT_STRIPE_MODE` — proposed server-only exact `test` or `live` scope; unconfigured on all hosts. Missing/invalid values keep proposed Checkout on HOLD. Requires uninstalled schema and separately governed baseline authority; never enables first-customer or resubscription reconciliation.
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
- `CF_PAGES_COMMIT_SHA` — Cloudflare Pages commit identifier; runtime metadata only.
- `CODEX_SANDBOX` — CI/development sandbox runtime marker; never a customer credential.
- `MINIFLARE_REGISTRY_PATH` — local/CI Miniflare registry path; never a customer credential.
- `WRANGLER_LOG_PATH` — local/CI Wrangler log path; never a customer credential.
- `WRANGLER_WRITE_LOGS` — local/CI Wrangler logging toggle; never a customer credential.
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
# Pending scanner-test ledger configuration

The cumulative spending hold remains unconditional. None of these settings
authorises a billable call or replaces reconciled historical dollar evidence.
Do not enable a real ledger until the owner separately approves exact spending.

- `POCKET_TEST_SPEND_LEDGER_KEY`: reconciled shared ledger, never per-process allowance.
- `POCKET_TEST_OPENAI_PROJECT_ID`: verified billing project, supplied to the provider SDK and checked by the ledger.
- `POCKET_TEST_SPEND_APPROVAL_REF`: separate exact owner approval recorded in that ledger.
- `POCKET_TEST_MODEL_COST_BOUNDS`: JSON object by exact model with `maxOutputTokens`, `maxCostMicroUsd`, and `fullContextCostBoundEvidenceRef`. Bounds must conservatively cover the full allowed model input context plus maximum output, using verified current prices, including image input. No guessed dollar estimates.

Each main/precision/rescue/context provider call reserves its own amount and
claims dispatch atomically. Receipts persist request/response IDs, model and
usage without chart content. Unsettled or failed calls stay counted; token
usage is not substituted for authoritative charged dollars.

## Separate six-case benchmark pilot (approved ceiling: USD $5)

These variables belong only to the new owner-approved pilot recorded in PR
comment `6165012632`. They do not modify, settle or infer headroom in the
historical $2 ledger above. The pilot is denied unless every value is present,
the private ledger is independently enabled, and the exact candidate matches.

- `POCKET_BENCHMARK_PILOT_ENABLED`: exact `true` only after independent gates pass; default false.
- `POCKET_BENCHMARK_LEDGER_KEY`: one durable pilot ledger shared by all six named cases.
- `POCKET_BENCHMARK_OPENAI_PROJECT_ID`: exact verified provider project passed to the SDK and checked by SQL.
- `POCKET_BENCHMARK_APPROVAL_REF`: immutable reference to the approved $5 scope.
- `POCKET_BENCHMARK_CANDIDATE_SHA`: full 40-character candidate commit.
- `POCKET_BENCHMARK_MODEL_COST_BOUNDS`: JSON keyed by exact model. Every entry pins `serviceTier=default`, maximum output, text characters, complete response-format bytes, decoded image count/bytes/width/height/pixels, worst-case micro-USD and pricing-evidence reference.
- `POCKET_BENCHMARK_CALL_PLAN`: exactly three deterministic slots—`main`, `primary_precision`, `rescue_precision`—each pinning model/tier, output, text, complete response format, decoded image count/bytes/width/height/pixels, worst-case micro-USD and evidence reference. This supports distinct main/precision bounds even when both use the same model. The complete worst-case total is reserved before dispatch.
- `POCKET_BENCHMARK_ACCOUNTING_MODE`: the reviewed isolated configuration pins `full-reservation-v2`. Any other nonempty value is rejected; an absent value retains the historical accounting path and is not authorisation for a benchmark. Full reservations remain distinct from independently evidenced actual settlement.
- `POCKET_BENCHMARK_RUNTIME_METADATA_ENABLED`: metadata-only verifier opt-in; exactly `true` permits fixed-origin GET checks using the existing authorised isolated executor. This flag does not enable inference, configure a ledger or attest live Sites.
- `OPENAI_ADMIN_KEY`: existing server-only read-only administrator metadata credential required by the reviewed schema1 verifier; never supplied to a client, printed, exported or created for a probe.
- `OPENAI_ORG_ID` and `OPENAI_PROJECT_ID`: when supplied to the isolated verifier, must match its reviewed intended organisation and project. A project setting is not proof of the process's actual key identity.
- `OPENAI_BASE_URL`: alternate origins are rejected by the isolated runtime verifier.
- `POCKET_REAL_BENCHMARK_DISPATCH`: separate real-image runner gate; left false until the exact source, corpus, financial and runtime gates are accepted. Metadata-only verification forces it false.

The existing wrapper pins historical implementation `93f3fe282c6cab0196812aec989dddaa915bb986`; do not label a newer checkout with that SHA. An isolated executor and concealed live Sites runtime have separate identity acceptance. See `docs/monaco-126/runtime-separation-independent-review.md`.

Named cases cannot be reclaimed, concurrent retransmits cannot dispatch the
same slot twice, the private ledger allowlists no more than six exact case IDs,
and a previous unresolved charge blocks the next case.
Unused conditional rescue is voided only while still reserved. Submitted calls
remain committed through crashes/timeouts until an immutable provider receipt
and authoritative dollar settlement exist. Provisional synthetic-case output
is stored with a SHA-256 digest but the endpoint returns only
`PENDING_AUTHORITATIVE_SETTLEMENT`; TP/FP/FN and acceptance are released only
through the result path after every required call settles and the final
cumulative-cap veto passes. A conflicting provisional measurement is rejected.

Pocket scan entitlement rollout requires the `pocket_scan_entitlements` migration and authoritative Stripe backfill. Founding awards and terminal Pro/Elite tiers are not Pocket access. Native Apple subscriptions and the advertised first free iPhone analysis require their own verified server entitlement integration before distribution. Do not deploy this guard to production as a stand-alone migration-free change.

- `POCKET_FIRST_FREE_ENABLED` — server-only trial routing switch, default off. Also requires the private durable policy to be enabled in the same verified environment. Release hold prevents production activation. Allows at most three preflights and one analysis per verified account/email; no client/native flag grants access.
