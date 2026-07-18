import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { normalizeOnboardingPreferences } from "../app/lib/onboarding.ts";

const root = new URL("../", import.meta.url);
const read = (path: string) => readFile(new URL(path, root), "utf8");

test("first-run preferences accept only complete enumerated choices", () => {
  assert.deepEqual(normalizeOnboardingPreferences({ experience: "developing", interests: ["macro", "futures", "macro"], notifications: "essential" }), {
    experience: "developing", interests: ["macro", "futures"], notifications: "essential",
  });
  assert.equal(normalizeOnboardingPreferences({ experience: "expert", interests: ["futures"], notifications: "none" }), null);
  assert.equal(normalizeOnboardingPreferences({ experience: "new", interests: [], notifications: "none" }), null);
});

test("onboarding persistence is authenticated, same-origin and user-owned", async () => {
  const [route, migration] = await Promise.all([read("app/api/onboarding/route.ts"), read("supabase/migrations/202607170006_member_onboarding.sql")]);
  assert.match(route, /request\.headers\.get\("origin"\) !== origin/);
  assert.match(route, /supabase\.auth\.getUser/);
  assert.match(migration, /enable row level security/);
  assert.match(migration, /auth\.uid\(\) = user_id/g);
});

test("onboarding UI exposes progress, interests, notifications and recovery", async () => {
  const [form, page, dashboard] = await Promise.all([read("app/onboarding/OnboardingForm.tsx"), read("app/onboarding/page.tsx"), read("app/dashboard/page.tsx")]);
  assert.match(form, /of 3 steps complete/);
  assert.match(form, /Market interests/);
  assert.match(form, /Notification preferences/);
  assert.match(form, /Nothing was lost/);
  assert.match(form, /initialPreferences\?\.experience/);
  assert.match(form, /Save workspace preferences/);
  assert.match(page, /\.select\("experience, interests, notifications, completed_at"\)/);
  assert.match(page, /Refine your market workspace/);
  assert.match(dashboard, /redirect\("\/onboarding"\)/);
});

test("public trust routes contain substantive guidance", async () => {
  const paths = ["about", "privacy", "terms", "risk-disclaimer", "contact", "help"];
  const pages = await Promise.all(paths.map((path) => read(`app/${path}/page.tsx`)));
  assert.equal(pages.every((page) => page.length > 500), true);
  assert.match(pages.join("\n"), /personalised financial/);
  assert.match(pages.join("\n"), /hello@nashaimarkets\.com/);
});

test("member navigation exposes preferences with mobile overflow protection", async () => {
  const [shell, css] = await Promise.all([read("app/components/MemberShell.tsx"), read("app/enhancements.css")]);
  assert.match(shell, /href: "\/onboarding"/);
  assert.match(css, /memberDashboardNav nav\{overflow-x:auto/);
});

test("customer-facing error boundaries provide retry and safe navigation", async () => {
  const pages = await Promise.all(["dashboard", "profile", "brief", "terminal"].map((path) => read(`app/${path}/error.tsx`)));
  for (const page of pages) {
    assert.match(page, /reset/);
    assert.match(page, /role="alert"/);
    assert.doesNotMatch(page, /error\.message|error\.stack/);
  }
});

test("RC1 documentation records prioritised issues and post-launch work", async () => {
  const report = await read("docs/RC1_RELEASE_CANDIDATE_REPORT.md");
  assert.match(report, /Critical/);
  assert.match(report, /Technical debt/);
  assert.match(report, /Version 1\.1/);
  assert.match(report, /Launch readiness/);
});

test("release surfaces remain mobile-first and risk messaging stays visible", async () => {
  const [css, pricing, home] = await Promise.all([read("app/enhancements.css"), read("app/pricing/page.tsx"), read("app/page.tsx")]);
  assert.match(css, /@media\(max-width:760px\)/);
  assert.match(pricing, /Risk notice/);
  assert.match(home, /risk-disclaimer/);
});
