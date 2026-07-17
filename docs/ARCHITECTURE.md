# Architecture and Deployment

## Product boundary

Project Bullseye is a Next-compatible React application built by Vinext and
deployed as a Cloudflare Worker-style artifact. It provides:

- a public NASH AI Markets membership site;
- Supabase passwordless authentication;
- Free, Pro and Elite feature entitlement;
- Stripe subscription-to-membership synchronization;
- a provider-backed market gateway;
- deterministic intelligence, reasoning, decision and trade-planning engines;
- authenticated dashboard, terminal and launch diagnostics.

The application does not place trades, send daily briefing emails, generate
personalized financial advice or fabricate unavailable market values.

## Request and data flow

```text
Browser
  ├─ public marketing/legal pages
  ├─ Supabase magic-link login
  └─ authenticated dashboard/terminal request
       ├─ Supabase: user, membership, preview claims, verified outcomes
       ├─ Market gateway
       │    └─ FMP adapter or generic HTTP snapshot provider
       ├─ deterministic market intelligence
       ├─ deterministic decision engine
       ├─ deterministic structured trade planner
       └─ server-rendered entitlement-filtered UI

Stripe Checkout
  └─ signed webhook → membership upsert in Supabase
```

Premium output is conditionally server-rendered. Locked output is not placed in
the DOM. The service-role key is used only in server modules.

## Application layers

| Layer | Implementation | Responsibility |
|---|---|---|
| Public site | `app/page.tsx`, legal and outcome routes | Product information, pricing links, risk wording |
| Authentication | `app/login`, `app/auth`, `utils/supabase` | Magic-link sign-in, session cookies, sign-out |
| Membership | `membership-entitlement.ts`, preview API | Tier resolution, period expiry, progressive previews |
| Billing | `app/api/stripe/webhook/route.ts` | Verify Stripe signatures and synchronize memberships |
| OpenAI health | `app/api/openai/health/route.ts` | Authenticated, sanitized server-side API connectivity check |
| Provider adapters | `app/lib/providers`, `market-data.ts` | Fetch, validate and normalize provider responses |
| Gateway | `live-market-gateway.ts` | Retry, timeout state, health and safe fallback |
| Analysis | intelligence, decision and planner modules | Deterministic JSON-serializable outputs |
| Member UI | `app/dashboard`, `app/terminal` | Truthful status, warnings, progressive access |
| Diagnostics | `app/terminal/diagnostics` | Sanitized release, provider and engine readiness |
| Runtime | `worker/index.ts`, Vinext/Vite | Worker request handling and baseline security headers |

## Routes

| Route | Access | Purpose |
|---|---|---|
| `/` | Public | Marketing, pricing and legal risk summary |
| `/login` | Public, `noindex` | Passwordless registration and login |
| `/auth/callback` | Public callback | Exchange Supabase code for a session |
| `/auth/signout` | Authenticated action | End the current session |
| `/dashboard` | Authenticated, `noindex` | Daily mission, event state, verified history and access |
| `/terminal` | Authenticated, `noindex` | Market terminal and entitled engine output |
| `/terminal/diagnostics` | Elite/effective Elite, `noindex` | Sanitized launch diagnostics |
| `/brief` | Authenticated, `noindex` | Deterministic market brief with optional constrained AI evidence prioritisation |
| `/api/membership/preview` | Authenticated POST | Claim a tier preview for the current UTC period |
| `/api/stripe/webhook` | Stripe-signed POST | Synchronize subscription state |
| `/api/openai/health` | Authenticated GET | Verify server-side OpenAI connectivity without exposing credentials |
| `/welcome` | Public, `noindex` | Checkout return instructions; not entitlement proof |
| `/cancelled` | Public | Checkout cancellation result |
| `/privacy`, `/terms` | Public | Current privacy and service terms |

## Data stores

Supabase Auth owns users and sessions. Application code expects a
`public.memberships` table, but its canonical creation migration is not present
in this repository and must be established before reproducible launch.

Repository migrations create:

- `membership_previews`: server-managed preview claims with a unique
  user/tier/period constraint and RLS enabled;
- `bullseye_verified_outcomes`: server-managed verified directional outcomes
  with RLS enabled.

No client policy is created for either table; access is through trusted
server-side service-role calls.

The `.openai/hosting.json` manifest declares no D1 or R2 binding. The included
Drizzle/D1 files are starter infrastructure and are not part of the current
Bullseye production data path.

## External services

| Service | Use | Failure behavior |
|---|---|---|
| Hosting/Cloudflare runtime | Application and assets | Application unavailable; roll back deployment |
| Supabase | Auth, memberships, previews, outcomes | Auth/access may fail; no sensitive error disclosure |
| Stripe | Checkout, billing, portal, webhooks | Existing access follows stored state; investigate/replay webhooks |
| OpenAI | Server-side SDK connectivity | Authenticated health route returns only connected, unavailable or not configured |
| Financial Modeling Prep | Initial live market adapter | Gateway retries then fails closed |
| Generic HTTP provider | Optional alternative normalized snapshot | Gateway retries then fails closed |

FMP currently supplies the five configured market inputs. The economic calendar
is not implemented through FMP; the UI displays an unavailable state unless a
provider supplies a complete future timestamp.

## Dependencies and runtime

- Node.js `>=22.13.0`
- Next `16.2.6`, React `19.2.6`
- Vinext `0.0.50`, Vite `8.0.13`
- Supabase JS/SSR
- Stripe Node SDK
- OpenAI Node SDK
- Lightweight Charts `5.2.0`
- TypeScript, ESLint and Node's test runner

The Linux build helpers require `flock`, `curl`, `sha256sum` and GNU `timeout`.
On macOS, the underlying `node_modules/.bin/vinext build` can be used for local
diagnosis, followed by artifact validation.

## Security boundaries

- Stripe webhooks require a valid signature.
- Supabase service-role and provider credentials are server-only.
- Provider errors and credential-bearing URLs are sanitized.
- HSTS, frame denial, MIME sniffing protection, a restrictive permissions
  policy and strict referrer policy are added by the Worker for application
  responses.
- A production Content Security Policy is not yet implemented.
- Protected and transactional routes are excluded from indexing.

## Deployment process

The intended deployment pipeline is:

1. install exactly the locked dependencies with `npm run install:ci`;
2. run implementation and operations validation;
3. build with `npm run build`;
4. validate `dist/server/index.js` and `dist/.openai/hosting.json`;
5. deploy the exact reviewed commit and immutable artifact;
6. run [production smoke tests](PRODUCTION_SMOKE_TESTS.md);
7. record release, environment version and operator.

Application deployment does not apply Supabase migrations.
