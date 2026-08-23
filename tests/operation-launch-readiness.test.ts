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

test("waitlist campaign destination is self-canonical and uses launch-specific social metadata", async () => {
  const [waitlist, socialImage, socialImageSource] = await Promise.all([
    source("app/waitlist/page.tsx"),
    readFile(new URL("../public/waitlist-og.png", import.meta.url)),
    source("public/waitlist-og.svg"),
  ]);
  assert.ok(waitlist.includes('alternates: {'));
  assert.ok(waitlist.includes('canonical: "/waitlist"'));
  assert.ok(waitlist.includes('openGraph: {'));
  assert.ok(waitlist.includes('url: "/waitlist"'));
  assert.ok(waitlist.includes("Join the NASH AI Markets Launch Waiting List"));
  assert.equal(waitlist.match(/\/waitlist-og\.png/g)?.length, 2);
  assert.deepEqual([...socialImage.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  assert.equal(socialImage.readUInt32BE(16), 1200);
  assert.equal(socialImage.readUInt32BE(20), 630);
  assert.match(socialImageSource, /EDUCATIONAL DECISION SUPPORT/);
  assert.match(socialImageSource, /EXAMPLE PRODUCT VISUAL/);
  assert.match(socialImageSource, /NOT LIVE MARKET DATA/);
});

test("approved waitlist film is first-party, accessible and economical by default", async () => {
  const [waitlist, styles, film, poster] = await Promise.all([
    source("app/waitlist/page.tsx"),
    source("app/mission-control.css"),
    readFile(new URL("../public/launch/video/bullseye-v16-reveal-25s-web.mp4", import.meta.url)),
    readFile(new URL("../public/launch/video/bullseye-v16-reveal-poster.webp", import.meta.url)),
  ]);

  assert.equal(waitlist.match(/<video\b/g)?.length, 1);
  assert.match(waitlist, /<video[\s\S]*?controls[\s\S]*?playsInline[\s\S]*?preload="metadata"/);
  assert.match(waitlist, /EXAMPLE PRODUCT VISUAL · NOT LIVE MARKET DATA/);
  assert.match(waitlist, /NO THIRD-PARTY TRACKING/);
  assert.match(waitlist, /Read the on-screen-caption transcript/);
  assert.match(waitlist, /bullseye-v16-reveal-25s-web\.mp4/);
  assert.match(waitlist, /bullseye-v16-reveal-poster\.webp/);
  assert.doesNotMatch(waitlist, /\bautoPlay\b|<iframe/);
  assert.doesNotMatch(waitlist, /youtube\.com|youtu\.be|vimeo\.com/i);
  assert.match(styles, /\.launchFilmFrame video\{[^}]*aspect-ratio:16\/9/);

  assert.equal(film.subarray(4, 8).toString("ascii"), "ftyp");
  assert.ok(film.indexOf(Buffer.from("moov")) < film.indexOf(Buffer.from("mdat")), "MP4 metadata should be fast-started");
  assert.ok(film.byteLength < 3_500_000, "720p web film should remain under 3.5 MB");
  assert.equal(poster.subarray(0, 4).toString("ascii"), "RIFF");
  assert.equal(poster.subarray(8, 12).toString("ascii"), "WEBP");
  assert.ok(poster.byteLength < 100_000, "poster should remain under 100 KB");
});

test("waitlist is a complete truthful prelaunch destination with no fabricated live-data promise", async () => {
  const [waitlist, styles] = await Promise.all([
    source("app/waitlist/page.tsx"),
    source("app/mission-control.css"),
  ]);

  for (const disclosure of [
    "EXAMPLE-ONLY PRODUCT MAP",
    "NO LIVE MARKET DATA",
    "AVAILABLE WITHOUT A PREMIUM FEED",
    "LICENSE REQUIRED",
    "It does not execute trades",
    "No advertising trackers",
    "Trading and investing involve risk",
  ]) assert.match(waitlist, new RegExp(disclosure, "i"));

  assert.match(waitlist, /features remain unavailable or clearly delayed until a verified licence/i);
  assert.match(waitlist, /<Link href="\/privacy">Privacy<\/Link>/);
  assert.match(waitlist, /<Link href="\/terms">Terms<\/Link>/);
  assert.match(waitlist, /<Link href="\/contact">Contact<\/Link>/);
  assert.equal(waitlist.match(/<WaitlistForm\b/g)?.length, 1);
  assert.doesNotMatch(waitlist, /google-analytics|googletagmanager|facebook\.com\/tr|connect\.facebook\.net|doubleclick|posthog\.capture/i);
  assert.match(styles, /@media\(max-width:700px\)/);
  assert.match(styles, /@media\(prefers-reduced-motion:reduce\)/);
  assert.match(styles, /\.launchWaitlist .*:focus-visible/);
});

test("waitlist form is phone-safe and announces asynchronous outcomes coherently", async () => {
  const [form, styles] = await Promise.all([
    source("app/waitlist/WaitlistForm.tsx"),
    source("app/mission-control.css"),
  ]);
  assert.match(form, /name="email"/);
  assert.match(form, /inputMode="email"/);
  assert.match(form, /enterKeyHint="send"/);
  assert.match(form, /autoCapitalize="none"/);
  assert.match(form, /spellCheck=\{false\}/);
  assert.match(form, /aria-busy=\{submitting\}/);
  assert.match(form, /aria-live=\{messageTone === "error" \? "assertive" : "polite"\}/);
  assert.match(form, /aria-atomic="true"/);
  assert.match(styles, /\.launchWaitlist \.waitlistForm input\{font-size:16px\}/);
  assert.match(styles, /\.launchWaitlist \.waitlistForm button:focus-visible/);
  assert.match(styles, /@media\(forced-colors:active\)/);
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
