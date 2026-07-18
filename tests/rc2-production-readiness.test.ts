import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path: string) => readFile(new URL(path, root), "utf8");

test("canonical membership migration is server-managed and member-readable only by verified email", async () => {
  const migration = await read("supabase/migrations/202607170000_memberships.sql");
  assert.match(migration, /create table if not exists public\.memberships/);
  assert.match(migration, /plan in \('free', 'pro', 'elite'\)/);
  assert.match(migration, /memberships enable row level security/);
  assert.match(migration, /revoke all on table public\.memberships from anon, authenticated/);
  assert.match(migration, /grant select on table public\.memberships to authenticated/);
  assert.match(migration, /auth\.jwt\(\) ->> 'email'/);
  assert.doesNotMatch(migration, /grant (?:insert|update|delete|all).*authenticated/i);
});

test("cookie-authenticated and public writes require an exact same-origin request", async () => {
  const routes = await Promise.all([
    read("app/api/profile/route.ts"),
    read("app/api/onboarding/route.ts"),
    read("app/api/membership/preview/route.ts"),
    read("app/api/founding-member/route.ts"),
    read("app/api/waitlist/route.ts"),
    read("app/api/stripe/checkout/route.ts"),
  ]);
  for (const route of routes) {
    assert.match(route, /headers\.get\("origin"\)/);
    assert.match(route, /!== (?:requestOrigin|origin)/);
    assert.match(route, /INVALID_ORIGIN|Checkout request rejected/);
  }
});

test("public launch surfaces and email templates do not claim private-beta status", async () => {
  const [home, waitlist, email] = await Promise.all([
    read("app/page.tsx"),
    read("app/waitlist/page.tsx"),
    read("app/lib/launch-email.ts"),
  ]);
  for (const source of [home, waitlist, email]) assert.doesNotMatch(source, /private beta/i);
  assert.match(home, /Launch waiting list/);
});

test("production environment validation follows server-created Stripe checkout", async () => {
  const validator = await read("scripts/check-production-env.sh");
  for (const name of [
    "STRIPE_PRO_PRICE_ID",
    "STRIPE_ELITE_PRICE_ID",
    "STRIPE_PRO_ANNUAL_PRICE_ID",
    "STRIPE_ELITE_ANNUAL_PRICE_ID",
    "STRIPE_LEGACY_PRO_PRICE_ID",
    "STRIPE_LEGACY_ELITE_PRICE_ID",
  ]) assert.match(validator, new RegExp(`require_var ${name}`));
  assert.doesNotMatch(validator, /require_https_url NEXT_PUBLIC_STRIPE_(?:PRO|ELITE)_CHECKOUT_URL/);
});

test("Vercel receives the Worker runtime baseline security headers", async () => {
  const config = await read("next.config.ts");
  for (const header of [
    "X-Content-Type-Options",
    "Referrer-Policy",
    "Permissions-Policy",
    "X-Frame-Options",
    "X-DNS-Prefetch-Control",
    "Cross-Origin-Opener-Policy",
  ]) {
    assert.match(config, new RegExp(header));
  }
  assert.match(config, /source:\s*"\/:path\*"/);
  assert.match(config, /poweredByHeader:\s*false/);
});
