import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path: string) => readFile(new URL(path, root), "utf8");

test("public membership copy qualifies licensed intraday intelligence and keeps free tools concrete", async () => {
  const [home, pricing, plans, waitlist] = await Promise.all([
    read("app/page.tsx"),
    read("app/pricing/page.tsx"),
    read("app/pricing/PricingPlans.tsx"),
    read("app/waitlist/page.tsx"),
  ]);

  assert.match(home, /only when licensed data is available/i);
  assert.match(pricing, /require a verified licensed provider and fail closed/i);
  assert.match(plans, /only when a verified licensed feed is available/i);
  assert.match(waitlist, /Licensed intraday status when available/);
  assert.match(home, /Official macro and event context/);
  assert.match(home, /Personal level planner/);
  assert.doesNotMatch(home, /Live Data Labels|Start Your Membership|unlock the full daily intelligence workflow/);
  assert.doesNotMatch(plans, /Pro unlocks the complete daily intelligence layer|Full intelligence, planning and diagnostic access/);
  assert.match(plans, /STANDARD ANNUAL PRO/);
  assert.match(plans, /Annual Pro is not part of the monthly Founding 100 price-lock programme/);
});

test("temporary membership verification never encourages a duplicate purchase", async () => {
  const page = await read("app/membership-required/page.tsx");
  assert.match(page, /This does not mean your subscription ended/);
  assert.match(page, /you should not purchase again/);
  assert.match(page, /primaryHref: "\/terminal"/);
  assert.match(page, /primaryLabel: "Retry access check"/);
  assert.match(page, /secondaryHref: "\/dashboard"/);
  assert.doesNotMatch(page, /href="\/#membership">Choose your membership/);
});

test("onboarding records future email preference without claiming delivery is active", async () => {
  const form = await read("app/onboarding/OnboardingForm.tsx");
  assert.match(form, /when delivery launches/);
  assert.match(form, /Optional Morning Brief email delivery remains off until the sender is verified/);
  assert.match(form, /does not subscribe you to an active daily email/);
});

test("install metadata describes the useful launch scope without promising a paid feed", async () => {
  const manifest = await read("app/manifest.ts");
  assert.match(manifest, /Verified market context, personal preparation tools and fail-closed risk controls/);
  assert.doesNotMatch(manifest, /Provider-backed market intelligence/);
});
