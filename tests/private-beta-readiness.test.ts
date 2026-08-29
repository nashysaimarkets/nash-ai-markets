import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (path: string) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Free registration enters the existing passwordless login flow", async () => {
  const home = await source("app/page.tsx");
  assert.match(home, /href="\/login"[\s\S]*Start free/);
  assert.doesNotMatch(home, /subject=NASH%20AI%20Free%20access/);
});

test("public membership copy does not promise an unimplemented briefing email", async () => {
  const [home, welcome] = await Promise.all([source("app/page.tsx"), source("app/welcome/page.tsx")]);
  assert.doesNotMatch(home, /lands in your inbox/);
  assert.doesNotMatch(welcome, /first briefing will be delivered/);
  assert.match(welcome, /Access is granted only after Stripe securely confirms/);
});

test("protected and checkout-return routes are excluded from search indexing", async () => {
  for (const path of ["app/login/page.tsx", "app/dashboard/page.tsx", "app/terminal/page.tsx", "app/welcome/page.tsx"]) {
    assert.match(await source(path), /robots: \{ index: false, follow: false \}/, path);
  }
});

test("webhook logs a sanitized failure category instead of raw provider errors", async () => {
  const webhook = await source("app/api/stripe/webhook/route.ts");
  assert.match(webhook, /category: "membership_sync_failure"/);
  assert.doesNotMatch(webhook, /console\\.error\\([^\\n]*, error\\)/);
});

test("deployment worker applies baseline response security headers", async () => {
  const worker = await source("worker/index.ts");
  for (const header of ["x-content-type-options", "referrer-policy", "permissions-policy", "x-frame-options", "strict-transport-security"]) {
    assert.match(worker, new RegExp(header));
  }
});

test("environment template inventories billing, authentication and provider configuration without real secrets", async () => {
  const environment = await source(".env.example");
  for (const variable of [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "STRIPE_SECRET_KEY",
    "STRIPE_WEBHOOK_SECRET",
    "STRIPE_PRO_PRICE_ID",
    "STRIPE_FOUNDING_PRO_PRICE_ID",
    "STRIPE_ELITE_PRICE_ID",
    "NEXT_PUBLIC_STRIPE_PRO_CHECKOUT_URL",
    "NEXT_PUBLIC_STRIPE_ELITE_CHECKOUT_URL",
    "FMP_API_KEY",
    "FMP_API_BASE_URL",
  ]) assert.match(environment, new RegExp(`^${variable}=`, "m"));
  assert.doesNotMatch(environment, /sk_(live|test)_|whsec_[A-Za-z0-9]{8,}/);
});

test("default validation commands include the complete regression suite and a repository secret scan", async () => {
  const packageJson = JSON.parse(await source("package.json")) as {
    scripts: Record<string, string>;
  };
  assert.match(packageJson.scripts.test, /test:unit/);
  assert.match(packageJson.scripts.test, /test:rendered/);
  assert.equal(packageJson.scripts["test:unit"], "node --import tsx --test tests/*.test.ts");
  assert.equal(packageJson.scripts["security:scan"], "node scripts/check-secrets.mjs");
});
