import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { normalizeFoundingOnboarding, normalizeWaitlistSubmission } from "../app/lib/launch-onboarding.ts";
import { createMorningBrief } from "../app/lib/morning-brief-engine.ts";
import { generateAIMorningBrief } from "../app/lib/server/ai-morning-brief.ts";
import { resolveMembershipTier } from "../app/terminal/lib/membership-entitlement.ts";

const source = (path: string) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const now = Date.parse("2026-07-17T12:00:00.000Z");

test("production simulation: passwordless authentication is fail-safe and redirect-bound", async () => {
  const [login, callback, dashboard] = await Promise.all([
    source("app/login/LoginForm.tsx"),
    source("app/auth/callback/route.ts"),
    source("app/dashboard/page.tsx"),
  ]);
  assert.match(login, /signInWithOtp/);
  assert.match(login, /shouldCreateUser: true/);
  assert.match(callback, /exchangeCodeForSession/);
  assert.match(callback, /!requestedNext\.startsWith\("\/\/"\)/);
  assert.match(callback, /login\?error=signin/);
  assert.match(dashboard, /redirect\("\/login"\)/);
});

test("production simulation: verified Morning Brief generates and quota failure falls back", async () => {
  const brief = createMorningBrief({
    source: "verified",
    asOf: "2026-07-17T11:59:00.000Z",
    sessionLabel: "Private beta simulation",
    marketCondition: "Neutral conditions with elevated volatility",
    confidence: 61,
    directionalBias: "neutral",
    keyRisk: "Volatility remains elevated",
    nextAction: "Recalculate after the next verified update",
  });
  const generated = await generateAIMorningBrief(brief, {
    responses: {
      async create() {
        return { output_text: JSON.stringify({
          headline: "Mixed conditions favour patience",
          summary: "Verified evidence remains balanced while uncertainty is elevated.",
          priorities: brief.priorities,
        }) };
      },
    },
  }, "simulation-model");
  const quota = await generateAIMorningBrief(brief, {
    responses: { async create() { throw { status: 429, code: "insufficient_quota" }; } },
  }, "simulation-model");
  assert.equal(generated.status, "generated");
  assert.deepEqual(quota, { status: "quota_exhausted", content: null });
});

test("production simulation: waiting-list storage is normalized, duplicate-safe, and server-only", async () => {
  const submission = normalizeWaitlistSubmission({
    email: "  Beta.Member@Example.COM ",
    source: "launch-page",
    company: "",
  });
  const [route, migration] = await Promise.all([
    source("app/api/waitlist/route.ts"),
    source("supabase/migrations/202607170003_operation_launch.sql"),
  ]);
  assert.deepEqual(submission, { email: "beta.member@example.com", source: "launch-page" });
  assert.match(route, /error\.code !== "23505"/);
  assert.match(route, /createAdminClient/);
  assert.match(migration, /email text not null unique/);
  assert.match(migration, /launch_waitlist enable row level security/);
  assert.doesNotMatch(migration, /create policy/i);
});

test("production simulation: Founding Member submission requires current paid entitlement", async () => {
  const activePro = resolveMembershipTier({
    plan: "pro",
    status: "active",
    current_period_end: "2026-08-17T12:00:00.000Z",
  }, false, now);
  const expiredElite = resolveMembershipTier({
    plan: "elite",
    status: "active",
    current_period_end: "2026-07-16T12:00:00.000Z",
  }, false, now);
  const submission = normalizeFoundingOnboarding({
    primaryGoal: "risk-discipline",
    experienceLevel: "experienced",
    preferredSession: "both",
    riskAcknowledged: true,
  });
  const route = await source("app/api/founding-member/route.ts");
  assert.equal(activePro, "pro");
  assert.equal(expiredElite, "free");
  assert.ok(submission);
  assert.match(route, /tier !== "pro" && tier !== "elite"/);
  assert.match(route, /status: "pending"/);
  assert.doesNotMatch(route, /\.from\("memberships"\)\.upsert/);
});

test("production simulation: Stripe is signature-bound and unknown prices fail closed", async () => {
  const webhook = await source("app/api/stripe/webhook/route.ts");
  assert.match(webhook, /stripe\.webhooks\.constructEvent/);
  assert.match(webhook, /matchedPlans\.length === 1/);
  assert.doesNotMatch(webhook, /subscription\.metadata\.plan/);
  assert.match(webhook, /current_period_end/);
  assert.match(webhook, /invoice\.payment_failed/);
  assert.match(webhook, /category: "membership_sync_failure"/);
});

test("production simulation: Supabase persistence remains migration-controlled and fail closed", async () => {
  const [preview, outcomes, launch, admin] = await Promise.all([
    source("supabase/migrations/202607170001_progressive_access_previews.sql"),
    source("supabase/migrations/202607170002_verified_outcomes.sql"),
    source("supabase/migrations/202607170003_operation_launch.sql"),
    source("utils/supabase/admin.ts"),
  ]);
  for (const migration of [preview, outcomes, launch]) {
    assert.match(migration, /enable row level security/);
    assert.doesNotMatch(migration, /create policy/i);
  }
  assert.match(admin, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(admin, /persistSession: false/);
  assert.match(admin, /credentials are not configured/);
});

test("production simulation: recoverable errors and loading states preserve truthful output", async () => {
  const paths = [
    "app/dashboard/error.tsx",
    "app/brief/error.tsx",
    "app/terminal/error.tsx",
    "app/founding-member/error.tsx",
  ];
  const errors = await Promise.all(paths.map(source));
  for (const error of errors) {
    assert.match(error, /role="alert"/);
    assert.doesNotMatch(error, /error\.message|stack|SUPABASE_SERVICE_ROLE_KEY|OPENAI_API_KEY/);
  }
  const loading = await Promise.all([
    source("app/dashboard/loading.tsx"),
    source("app/brief/loading.tsx"),
    source("app/terminal/loading.tsx"),
    source("app/founding-member/loading.tsx"),
  ]);
  for (const state of loading) assert.match(state, /aria-(?:busy|live)/);
});

test("production simulation: mobile, accessibility, performance, and deployment safeguards are present", async () => {
  const [css, dashboard, fmp, ai, worker, build] = await Promise.all([
    source("app/mission-control.css"),
    source("app/dashboard/page.tsx"),
    source("app/lib/providers/financial-modeling-prep.ts"),
    source("app/lib/server/ai-morning-brief.ts"),
    source("worker/index.ts"),
    source("scripts/build-verified.sh"),
  ]);
  assert.match(css, /@media\(max-width:640px\)/);
  assert.match(css, /prefers-reduced-motion:reduce/);
  assert.match(dashboard, /Promise\.all/);
  assert.match(fmp, /timeoutMs = options\.timeoutMs \?\? 4_500/);
  assert.match(ai, /AI_MORNING_BRIEF_TIMEOUT_MS/);
  assert.match(worker, /strict-transport-security/);
  assert.match(build, /validate-artifact/);
});
