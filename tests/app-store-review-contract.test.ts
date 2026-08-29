import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("App Store review notes describe the real accountless native flow", async () => {
  const record = await readFile(new URL("docs/app-store/APP_STORE_CONNECT.md", root), "utf8");
  assert.match(record, /experience is accountless[\s\S]*No registration, login, reviewer credentials/i);
  assert.match(record, /account-deletion flow is not applicable/i);
  assert.doesNotMatch(record, /Create or use the supplied review account/);
  assert.doesNotMatch(record, /Email Address: account management/);
  assert.doesNotMatch(record, /User ID: authentication/);
  assert.match(record, /Marketing URL: `https:\/\/pocket\.nashaimarkets\.com\/pocket`/);
});

test("Apple information-request response covers exactly the eight requested items", async () => {
  const response = await readFile(new URL("docs/app-store/APP_REVIEW_RESPONSE_2026-08-29.md", root), "utf8");
  const headings = response.match(/^### \d+\./gm) ?? [];
  assert.equal(headings.length, 8);
  assert.match(response, /physical-device/i);
  assert.match(response, /Devices and operating-system versions tested/i);
  assert.match(response, /No special setup, organisation access, registration, login or credentials are required/i);
  assert.match(response, /OpenAI/);
  assert.match(response, /core app functionality is the same in every App Store territory/i);
  assert.match(response, /does not access a brokerage account/i);
  assert.match(response, /one auto-renewable subscription/i);
  assert.match(response, /Duration: one month/i);
  assert.match(response, /Restore Purchases/i);
  assert.match(response, /Recording script/i);
});

test("terms distinguish Apple billing from web Stripe billing", async () => {
  const terms = await readFile(new URL("app/terms/page.tsx", root), "utf8");
  assert.match(terms, /Web memberships are billed through Stripe/);
  assert.match(terms, /Pocket Bullseye subscriptions on iOS/);
  assert.match(terms, /one-month auto-renewable subscription/);
  assert.match(terms, /Restore Purchases/);
  assert.match(terms, /Apple Account subscription settings/);
});
