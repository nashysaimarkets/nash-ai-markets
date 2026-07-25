import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  applyAIMorningBrief,
  createMorningBrief,
  MORNING_BRIEF_PLACEHOLDER_INPUT,
} from "../app/lib/morning-brief-engine.ts";

test("verified Morning Brief output is deterministic, bounded, and reusable", () => {
  const input = {
    source: "verified" as const,
    asOf: "2026-07-17T07:30:00.000Z",
    sessionLabel: "London market session",
    marketCondition: "bullish scenario · moderate risk",
    confidence: 74.6,
    directionalBias: "bullish",
    keyRisk: "event risk",
    nextAction: "recalculate after provider update",
  };
  const first = createMorningBrief(input);
  const second = createMorningBrief(input);
  assert.deepEqual(first, second);
  assert.equal(first.mode, "verified");
  assert.equal(first.generation, "deterministic");
  assert.equal(first.confidence, 75);
  assert.equal(first.actionable, true);
  assert.equal(JSON.stringify(first), JSON.stringify(second));
});

test("Morning Brief applies valid AI content without changing confidence or direction", () => {
  const brief = createMorningBrief({
    source: "verified",
    asOf: "2026-07-17T07:30:00.000Z",
    sessionLabel: "London market session",
    marketCondition: "neutral conditions",
    confidence: 65,
    directionalBias: "neutral",
    keyRisk: "event risk",
    nextAction: "wait for confirmation",
  });
  const enhanced = applyAIMorningBrief(brief, {
    status: "generated",
    content: {
      headline: "Uncertainty remains elevated",
      summary: "Verified evidence remains mixed.",
      priorities: [...brief.priorities].reverse(),
    },
  });
  assert.equal(enhanced.generation, "ai-assisted");
  assert.equal(enhanced.confidence, brief.confidence);
  assert.equal(enhanced.directionalBias, brief.directionalBias);
  assert.deepEqual(enhanced.checklist, brief.checklist);
});

test("Morning Brief placeholder is fixed, explicit, and non-actionable", () => {
  const brief = createMorningBrief(MORNING_BRIEF_PLACEHOLDER_INPUT);
  assert.equal(brief.mode, "preview");
  assert.equal(brief.asOf, "2024-01-02T08:00:00.000Z");
  assert.equal(brief.confidence, null);
  assert.equal(brief.directionalBias, null);
  assert.equal(brief.actionable, false);
  assert.match(brief.label, /NOT CURRENT MARKET DATA/);
  assert.doesNotMatch(JSON.stringify(brief), /\b(?:entry|stop|target|support|resistance)\s+\d/i);
});

test("Morning Brief fails closed for incomplete verified input", () => {
  const brief = createMorningBrief({
    source: "verified",
    asOf: "invalid",
    sessionLabel: "London market session",
    confidence: 80,
  });
  assert.equal(brief.mode, "unavailable");
  assert.equal(brief.confidence, null);
  assert.equal(brief.directionalBias, null);
  assert.equal(brief.actionable, false);
  assert.match(brief.warning ?? "", /No directional guidance/);
});

test("executive dashboard integrates verified summary, preview safety, and subscription status", async () => {
  const dashboard = await readFile(new URL("../app/dashboard/page.tsx", import.meta.url), "utf8");
  const brief = await readFile(new URL("../app/brief/page.tsx", import.meta.url), "utf8");
  const profile = await readFile(new URL("../app/profile/page.tsx", import.meta.url), "utf8");
  assert.match(dashboard, /redirect\("\/terminal"\)/);
  assert.match(dashboard, /resolveMembershipTier/);
  assert.doesNotMatch(dashboard, /MissionControl|persistAnalysisSnapshot|<SubscriptionStatusCard/);
  assert.match(profile, /<SubscriptionStatusCard/);
  assert.match(brief, /redirect\("\/terminal"\)/);
  assert.match(brief, /createProgressiveAccess/);
  assert.doesNotMatch(brief, /buildMarketBrief|LockedPremiumCard/);
});

test("member profile is protected, noindex, and exposes no Stripe identifiers", async () => {
  const [page, subscription] = await Promise.all([
    readFile(new URL("../app/profile/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/SubscriptionStatusCard.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(page, /redirect\("\/login"\)/);
  assert.match(page, /robots: \{ index: false, follow: false \}/);
  assert.match(page, /<SubscriptionStatusCard/);
  assert.match(page, /Payment-card information remains with Stripe/);
  assert.doesNotMatch(page, /stripe_customer_id|stripe_subscription_id/);
  assert.match(subscription, /tier === "free" && hasPaidRecord/);
  assert.match(subscription, /\? "expired"/);
  assert.match(subscription, /Manage in Stripe/);
});

test("profile updates require authentication, same origin, and validated display names", async () => {
  const route = await readFile(new URL("../app/api/profile/route.ts", import.meta.url), "utf8");
  assert.match(route, /suppliedOrigin !== requestOrigin/);
  assert.match(route, /auth\.getUser\(\)/);
  assert.match(route, /displayName\.length < 2/);
  assert.match(route, /displayName\.length > 60/);
  assert.match(route, /auth\.updateUser/);
  assert.doesNotMatch(route, /console\.|error\.message/);
});

test("Gamma loading, error, navigation, and mobile states remain accessible", async () => {
  const [dashboardLoading, profileLoading, profileError, shell, css] = await Promise.all([
    readFile(new URL("../app/dashboard/loading.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/profile/loading.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/profile/error.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/MemberShell.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/mission-control.css", import.meta.url), "utf8"),
  ]);
  assert.match(dashboardLoading, /aria-busy="true"/);
  assert.match(dashboardLoading, /MemberEmptyCanvas|aria-busy/);
  assert.match(profileLoading, /aria-live="polite"/);
  assert.match(profileError, /No account, billing, or provider error details have been exposed/);
  assert.match(shell, /href: "\/profile"/);
  assert.match(css, /\.profileForm input,.profileForm button\{min-height:48px\}/);
  assert.match(css, /\.executiveMorningBriefBody\{grid-template-columns:1fr\}/);
});
