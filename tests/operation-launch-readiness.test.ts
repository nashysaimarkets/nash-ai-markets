import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  buildFoundingMemberWelcomeEmail,
  buildWaitlistConfirmationEmail,
  getLaunchEmailReadiness,
} from "../app/lib/launch-email.ts";

const source = (path: string) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("launch email readiness fails closed until provider and sender are configured", () => {
  assert.deepEqual(getLaunchEmailReadiness({}), {
    providerConfigured: false,
    senderConfigured: false,
    credentialConfigured: false,
    ready: false,
  });
  assert.deepEqual(getLaunchEmailReadiness({
    LAUNCH_EMAIL_PROVIDER: "resend",
    LAUNCH_EMAIL_FROM: "NASH AI Markets <launch@example.invalid>",
    RESEND_API_KEY: "re_example",
  }), {
    providerConfigured: true,
    senderConfigured: true,
    credentialConfigured: true,
    ready: true,
  });
});

test("waiting-list confirmation template is transparent and contains no fabricated access promise", () => {
  const template = buildWaitlistConfirmationEmail();
  assert.equal(template.template, "waitlist-confirmation");
  assert.match(template.text, /does not guarantee an invitation/);
  assert.match(template.text, /does not create a paid subscription/);
  assert.doesNotMatch(template.text, /your place is confirmed|limited spots|act now/i);
});

test("Founding Member welcome is created only after accepted review", () => {
  assert.equal(buildFoundingMemberWelcomeEmail("pending"), null);
  assert.equal(buildFoundingMemberWelcomeEmail("declined"), null);
  const accepted = buildFoundingMemberWelcomeEmail("accepted");
  assert.equal(accepted?.template, "founding-member-welcome");
  assert.match(accepted?.text ?? "", /Stripe-backed membership remains the source of feature entitlement/);
  assert.match(accepted?.text ?? "", /does not change billing/);
});

test("Stripe webhook rejects metadata-only and ambiguous plan mapping", async () => {
  const [webhook, edgeWebhook] = await Promise.all([
    source("app/api/stripe/webhook/route.ts"),
    source("supabase/functions/stripe-webhook/index.ts"),
  ]);
  assert.match(webhook, /matchedPlans\.length === 1/);
  assert.doesNotMatch(webhook, /subscription\.metadata\.plan/);
  assert.match(webhook, /Cannot safely map Stripe subscription to membership/);
  assert.match(webhook, /stripe\.webhooks\.constructEvent/);
  assert.match(webhook, /current_period_end/);
  assert.match(webhook, /cancel_at_period_end/);
  assert.match(webhook, /sync_membership_cancellation_from_stripe/);
  assert.match(edgeWebhook, /stripe\.webhooks\.constructEventAsync/);
  assert.match(edgeWebhook, /sync_membership_cancellation_from_stripe/);
  assert.match(edgeWebhook, /cancel_at_period_end/);
});

test("homepage contains no fixed market values and routes pricing through server checkout", async () => {
  const [home, pricing, checkout] = await Promise.all([
    source("app/page.tsx"),
    source("app/pricing/PricingPlans.tsx"),
    source("app/api/stripe/checkout/route.ts"),
  ]);
  assert.doesNotMatch(home, /6,318\.25|6,350|6,332|6,310|6,288|16\.42|4\.31%|97\.84/);
  assert.match(home, /NO LIVE VALUE/);
  assert.match(pricing, /\/api\/stripe\/checkout/);
  assert.match(checkout, /checkout\.sessions\.create/);
  assert.doesNotMatch(home, /buy\.stripe\.com/);
});

test("launch diagnostics cover OpenAI and email readiness without exposing secrets", async () => {
  const [page, panel, diagnostics] = await Promise.all([
    source("app/terminal/diagnostics/page.tsx"),
    source("app/terminal/components/LaunchDiagnosticsPanel.tsx"),
    source("app/terminal/lib/launch-diagnostics.ts"),
  ]);
  assert.match(page, /checkOpenAIConnection/);
  assert.match(page, /getLaunchEmailReadiness/);
  assert.match(panel, /OpenAI health/);
  assert.match(panel, /Launch email/);
  assert.match(panel, /OPENAI_API_KEY/);
  assert.match(diagnostics, /integrations:/);
  assert.doesNotMatch(panel, /process\.env|LAUNCH_EMAIL_FROM|error\.message/);
});
