import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("live legal and support copy separates Apple billing from Stripe web billing", async () => {
  const [terms, privacy, contact] = await Promise.all([
    readFile(new URL("app/terms/page.tsx", root), "utf8"),
    readFile(new URL("app/privacy/page.tsx", root), "utf8"),
    readFile(new URL("app/contact/page.tsx", root), "utf8"),
  ]);

  assert.match(terms, /Web memberships and Stripe billing/);
  assert.match(terms, /Pocket Bullseye subscriptions on iOS/);
  assert.match(terms, /Separate purchase channels/);
  assert.match(terms, /Web founding offers/);
  assert.match(privacy, /Stripe processes web membership/);
  assert.match(privacy, /Apple StoreKit processes iOS in-app purchases/);
  assert.match(contact, /Apple App Store subscriptions/);
  assert.match(contact, /Stripe web memberships/);
  assert.doesNotMatch(`${terms}\n${privacy}`, /Founding 100|Pocket Bullseye beta|private[- ]beta/i);
});
