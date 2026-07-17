# NASH AI Markets — Project Bullseye

A private-beta trading-intelligence application running on
[vinext](https://github.com/cloudflare/vinext), with Supabase authentication
and membership storage, Stripe subscription synchronization, and a
fail-closed market-data gateway.

## Prerequisites

- Node.js `>=22.13.0`
- Linux with `flock`, `curl`, and GNU `timeout`

## Sites Lifecycle

The Sites lifecycle CLI runs the locked dependency install before returning this checkout. Edit the source under `app/`, then checkpoint when a coherent milestone is ready to inspect or share. The remote Sites builder runs `npm run build` against the pushed commit. Do not repeat install or build as a normal pre-checkpoint step.

This starter does not use `wrangler.jsonc`.

`install:ci` is intentionally a single, non-retrying `npm ci`. It refuses a concurrent install for the same project, consumes a matching image-seeded npm cache with `--prefer-offline` while retaining registry fallback for a missing cache object, otherwise downloads and verifies the complete vinext tarball recorded in `package-lock.json`, limits npm to one socket, and terminates a stalled install. `build` applies a short timeout and then validates the Sites artifact. These helpers target Linux and use GNU `timeout`; they are not native macOS scripts.

Scripts that need writable project-scoped home, npm, XDG, and temporary paths use `scripts/sites-env.sh`. The `dev` and `start` scripts honor the caller's runtime environment and keep Wrangler logs inside the checkout. The generated `.sites-runtime/` directory is disposable and ignored by Git.

## Included Shape

- edit site code under `app/`
- `app/chatgpt-auth.ts` provides optional dispatch-owned ChatGPT sign-in helpers
- `.openai/hosting.json` declares optional Sites D1 and R2 bindings
- `vite.config.ts` simulates declared bindings for local development
- `db/index.ts` reads the D1 binding from the Cloudflare Worker environment
- `db/schema.ts` starts intentionally empty
- `examples/d1/` contains an optional D1 example surface
- `drizzle.config.ts` supports local migration generation when needed

## Workspace Auth Headers

OpenAI workspace sites can read the current user's email from
`oai-authenticated-user-email`.

SIWC-authenticated workspace sites may also receive
`oai-authenticated-user-full-name` when the user's SIWC profile has a non-empty
`name` claim. The full-name value is percent-encoded UTF-8 and is accompanied by
`oai-authenticated-user-full-name-encoding: percent-encoded-utf-8`.

Treat the full name as optional and fall back to email when it is absent:

```tsx
import { headers } from "next/headers";

export default async function Home() {
  const requestHeaders = await headers();
  const email = requestHeaders.get("oai-authenticated-user-email");
  const encodedFullName = requestHeaders.get("oai-authenticated-user-full-name");
  const fullName =
    encodedFullName &&
    requestHeaders.get("oai-authenticated-user-full-name-encoding") ===
      "percent-encoded-utf-8"
      ? decodeURIComponent(encodedFullName)
      : null;

  const displayName = fullName ?? email;
  // ...
}
```

## Optional Dispatch-Owned ChatGPT Sign-In

Import the ready-to-use helpers from `app/chatgpt-auth.ts` when the site needs
optional or required ChatGPT sign-in:

- Use `getChatGPTUser()` for optional signed-in UI.
- Use `requireChatGPTUser(returnTo)` for server-rendered pages that should send
  anonymous visitors through Sign in with ChatGPT.
- Use `chatGPTSignInPath(returnTo)` and `chatGPTSignOutPath(returnTo)` for
  browser links or actions.
- Pass a same-origin relative `returnTo` path for the destination after sign-in
  or sign-out. The helper validates and safely encodes it.
- Mark protected pages with `export const dynamic = "force-dynamic"` because
  they depend on per-request identity headers.

Dispatch owns `/signin-with-chatgpt`, `/signout-with-chatgpt`, `/callback`, the
OAuth cookies, and identity header injection. Do not implement app routes for
those reserved paths. Routes that do not import and call the helper remain
anonymous-compatible.

SIWC establishes identity only; it does not prove workspace membership. Use the
Sites hosting platform's access policy controls for workspace-wide restrictions,
or enforce explicit server-side membership or allowlist checks.

Use SIWC for account pages, user-specific dashboards, saved records, and write
actions tied to the current ChatGPT user. Leave public content anonymous.

## Diagnostic Commands

- `npm run install:ci`: perform the one bounded lockfile install
- `npm run dev`: start the Vite/Vinext development server
- `npm run build`: build and validate the deployable Sites artifact
- `npm run start`: start the built Vinext application
- `npm test`: build, validate, and verify the rendered development-preview metadata
- `npm run validate:artifact`: recheck an existing artifact's manifest and ESM `default.fetch` export
- `npm run db:generate`: generate Drizzle migrations after schema changes

Use build and validation commands for targeted diagnosis after a remote failure, not as part of the normal checkpoint path.

The timeout defaults can be overridden for a controlled canary with `SITES_INSTALL_TIMEOUT`, `SITES_INSTALL_KILL_AFTER`, `SITES_BUILD_TIMEOUT`, and `SITES_BUILD_KILL_AFTER`. A timeout fails the command; the helpers never retry an unchanged install or build.

## Financial Modeling Prep market adapter

The first live-provider adapter is enabled only when all required variables are present:

- `MARKET_DATA_PROVIDER=fmp`
- `FMP_API_KEY` — an FMP account API key
- `FMP_API_BASE_URL` — the FMP stable API base URL supplied for the account

Optional operational and symbol settings are `FMP_REQUEST_TIMEOUT_MS`, `FMP_SP500_FUTURES_SYMBOL`, `FMP_VIX_SYMBOL`, and `FMP_US_DOLLAR_INDEX_SYMBOL`. Defaults are `ESUSD`, `^VIX`, and `DX-Y.NYB`; override them when the account's FMP symbol directory uses different identifiers.

The adapter appends the credential as FMP's documented `apikey` query parameter at request time. Do not place a credential in `FMP_API_BASE_URL`, source code, or committed environment files. The deployment base URL should be FMP's Stable API base URL, while the credential remains exclusively in `FMP_API_KEY`. If the provider selection, key, or base URL is absent, the terminal remains in its safe unconfigured fallback. FMP Treasury Rates are date-stamped rather than intraday; the gateway therefore rejects them once the existing delayed-data window has elapsed rather than presenting them as live.

## Private-beta production checklist

Use `.env.example` as the complete variable inventory; never commit populated
credentials. Before inviting beta members:

1. Apply the Supabase schema used by `memberships`, then apply migrations
   `202607170001_progressive_access_previews.sql` and
   `202607170002_verified_outcomes.sql`.
2. Confirm RLS is enabled and no browser role can read either server-managed
   migration table.
3. Configure the Supabase production site URL and allow only the deployed
   `/auth/callback` redirect origin.
4. Configure Stripe Pro and Elite Price IDs, the customer portal, and the
   production webhook endpoint `/api/stripe/webhook`.
5. Subscribe the webhook to checkout completion, subscription created,
   updated and deleted, and invoice payment failure events.
6. Configure the checkout success URL to `/welcome` and cancellation URL to
   `/cancelled`, then complete one real low-value test purchase and
   cancellation using a dedicated beta account.
7. Configure the FMP variables and verify that diagnostics report fresh,
   timestamped provider data. Missing credentials intentionally leave the
   terminal offline and non-actionable.
8. Set build provenance variables and run tests, strict TypeScript, ESLint,
   the production build, and artifact validation against the exact commit to
   be deployed.

The repository does not send daily briefing emails. Supabase sends the
passwordless authentication email and Stripe sends configured billing emails;
any additional lifecycle or briefing email flow requires a separate,
consent-aware delivery service.

## Learn More

- [vinext Documentation](https://github.com/cloudflare/vinext)
- [Drizzle D1 Guide](https://orm.drizzle.team/docs/get-started/d1-new)
