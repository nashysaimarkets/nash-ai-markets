import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  checkoutOffering,
  checkoutPriceId,
  configuredOffering,
  validFoundingProPrice,
  validPocketFoundingPrice,
} from "../app/lib/stripe-commercial.ts";
import { calculateCommercialMetrics } from "../app/lib/server/commercial.ts";
import {
  buildAnnualRenewalReminderEmail,
  buildFounding100ConfirmationEmail,
  buildMembershipWelcomeEmail,
  buildPocketFoundingWelcomeEmail,
  buildPocketSubscriptionAlertEmail,
  buildPaymentSuccessfulEmail,
  buildSubscriptionCancellationEmail,
} from "../app/lib/launch-email.ts";

const root = new URL("../", import.meta.url);
const read = (path: string) => readFile(new URL(path, root), "utf8");
const environment = {
  STRIPE_POCKET_FOUNDING_PRICE_ID: "price_pocket_founding_month",
  STRIPE_PRO_PRICE_ID: "price_pro_month",
  STRIPE_FOUNDING_PRO_PRICE_ID: "price_founding_pro_month",
  STRIPE_ELITE_PRICE_ID: "price_elite_month",
  STRIPE_PRO_ANNUAL_PRICE_ID: "price_pro_year",
  STRIPE_ELITE_ANNUAL_PRICE_ID: "price_elite_year",
  STRIPE_LEGACY_PRO_PRICE_ID: "price_legacy_pro_month",
  STRIPE_LEGACY_ELITE_PRICE_ID: "price_legacy_elite_month",
};

test("monthly and annual Stripe offerings map without changing legacy customers", () => {
  assert.deepEqual(configuredOffering("price_pro_month", environment), { plan: "pro", billingInterval: "month", foundingEligible: false });
  assert.deepEqual(configuredOffering("price_founding_pro_month", environment), { plan: "pro", billingInterval: "month", foundingEligible: true });
  assert.deepEqual(configuredOffering("price_pocket_founding_month", environment), { plan: "pocket", billingInterval: "month", foundingEligible: true });
  assert.deepEqual(configuredOffering("price_elite_year", environment), { plan: "elite", billingInterval: "year", foundingEligible: false });
  assert.deepEqual(configuredOffering("price_legacy_pro_month", environment), { plan: "pro", billingInterval: "month", foundingEligible: false });
  assert.deepEqual(configuredOffering("price_legacy_elite_month", environment), { plan: "elite", billingInterval: "month", foundingEligible: false });
  assert.equal(configuredOffering("unknown", environment), null);
});

test("checkout accepts only enumerated server-side Price IDs", () => {
  assert.equal(checkoutPriceId("pro_year", environment), "price_pro_year");
  assert.equal(checkoutPriceId("founding_pro_month", environment), "price_founding_pro_month");
  assert.equal(checkoutPriceId("pocket_founding_month", environment), "price_pocket_founding_month");
  assert.equal(checkoutPriceId("elite_month", environment), "price_elite_month");
  assert.equal(checkoutPriceId("legacy_pro_month", environment), null);
  assert.equal(checkoutPriceId("price_attacker", environment), null);
  assert.equal(checkoutPriceId(null, environment), null);
});

test("Pocket Founding 650 checkout requires the exact £4.99 monthly Price", () => {
  assert.deepEqual(checkoutOffering("pocket_founding_month", environment), {
    priceId: "price_pocket_founding_month",
    offering: { plan: "pocket", billingInterval: "month", foundingEligible: true },
  });
  assert.equal(validPocketFoundingPrice({ active:true,currency:"gbp",type:"recurring",unit_amount:499,recurring:{interval:"month"} }), true);
  assert.equal(validPocketFoundingPrice({ active:true,currency:"gbp",type:"recurring",unit_amount:500,recurring:{interval:"month"} }), false);
  assert.equal(validPocketFoundingPrice({ active:true,currency:"gbp",type:"recurring",unit_amount:499,recurring:{interval:"year"} }), false);
});

test("Pocket Founding 650 page submits the server-enumerated Stripe offering", async () => {
  const page = await read("app/pocket/founding/page.tsx");
  assert.match(page, /action="\/api\/stripe\/checkout"/);
  assert.match(page, /name="offering" value="pocket_founding_month"/);
  assert.match(page, /CONTINUE TO SECURE CHECKOUT/);
  assert.doesNotMatch(page, /WaitlistForm/);
});

test("Stripe price configuration tolerates pasted surrounding whitespace", () => {
  assert.deepEqual(checkoutOffering("pocket_founding_month", {
    ...environment,
    STRIPE_POCKET_FOUNDING_PRICE_ID: "  price_pocket_founding_month\n",
  }), {
    priceId: "price_pocket_founding_month",
    offering: { plan: "pocket", billingInterval: "month", foundingEligible: true },
  });
});

test("Founding Pro checkout requires an exact, unambiguous £12 monthly Price", () => {
  assert.deepEqual(checkoutOffering("founding_pro_month", environment), {
    priceId: "price_founding_pro_month",
    offering: { plan: "pro", billingInterval: "month", foundingEligible: true },
  });
  assert.equal(checkoutOffering("founding_pro_month", {
    ...environment,
    STRIPE_FOUNDING_PRO_PRICE_ID: environment.STRIPE_PRO_PRICE_ID,
  }), null);
  assert.equal(validFoundingProPrice({
    active: true,
    currency: "gbp",
    type: "recurring",
    unit_amount: 1200,
    recurring: { interval: "month" },
  }), true);
  for (const invalid of [
    { active: false, currency: "gbp", type: "recurring", unit_amount: 1200, recurring: { interval: "month" } },
    { active: true, currency: "usd", type: "recurring", unit_amount: 1200, recurring: { interval: "month" } },
    { active: true, currency: "gbp", type: "recurring", unit_amount: 1499, recurring: { interval: "month" } },
    { active: true, currency: "gbp", type: "recurring", unit_amount: 1200, recurring: { interval: "year" } },
  ]) assert.equal(validFoundingProPrice(invalid), false);
});

test("checkout binds signed-in members without exposing the session id in return URLs", async () => {
  const checkout = await read("app/api/stripe/checkout/route.ts");
  assert.match(checkout, /supabase\.auth\.getUser\(\)/);
  assert.match(checkout, /customer_email: verifiedEmail/);
  assert.match(checkout, /client_reference_id: user\?\.id/);
  assert.match(checkout, /stripe\.prices\.retrieve\(selected\.priceId\)/);
  assert.match(checkout, /validPocketFoundingPrice\(price\)/);
  assert.match(checkout, /pocket\/founding\/welcome/);
  assert.doesNotMatch(checkout, /CHECKOUT_SESSION_ID/);
});

test("authenticated billing portal uses the member's stored Stripe customer", async () => {
  const portal = await read("app/api/stripe/portal/route.ts");
  assert.match(portal, /supabase\.auth\.getUser\(\)/);
  assert.match(portal, /\.select\("stripe_customer_id"\)/);
  assert.match(portal, /billingPortal\.sessions\.create/);
  assert.ok(portal.includes("return_url: `${origin}/profile`"));
  assert.doesNotMatch(portal, /STRIPE_CUSTOMER_PORTAL_LINK/);
});

test("commercial metrics use active stored subscriptions and normalize recurring revenue", () => {
  const metrics = calculateCommercialMetrics([
    { email: "free@example.com", plan: "free", status: "active", billingInterval: null, unitAmount: null, periodEnd: null },
    { email: "pro@example.com", plan: "pro", status: "active", billingInterval: "month", unitAmount: 1499, periodEnd: null },
    { email: "elite@example.com", plan: "elite", status: "trialing", billingInterval: "year", unitAmount: 29900, periodEnd: null },
    { email: "old@example.com", plan: "pro", status: "canceled", billingInterval: "month", unitAmount: 1499, periodEnd: null },
  ]);
  assert.deepEqual(metrics, { free: 1, pro: 1, elite: 1, monthly: 1, annual: 1, mrrPence: 3991, arrPence: 47888, conversionPercent: 66.7 });
});

test("commercial metrics do not invent conversion or revenue without records", () => {
  assert.deepEqual(calculateCommercialMetrics([]), { free: 0, pro: 0, elite: 0, monthly: 0, annual: 0, mrrPence: 0, arrPence: 0, conversionPercent: null });
});

test("member account billing lookup queries only the normalized member email", async () => {
  const server = await read("app/lib/server/commercial.ts");
  assert.match(server, /const normalizedEmail = email\.trim\(\)\.toLowerCase\(\)/);
  assert.match(server, /\.eq\("email", normalizedEmail\)/);
  assert.match(server, /\.maybeSingle\(\)/);
  assert.doesNotMatch(server, /loadCommercialMembership\(email: string\) \{\s*const rows = await loadCommercialRows/);
});

test("branded lifecycle email templates state billing and risk truthfully", () => {
  assert.match(buildMembershipWelcomeEmail("pro").text, /educational market commentary/);
  assert.match(buildPaymentSuccessfulEmail("elite", "1 August 2027").text, /confirmed by Stripe/);
  assert.match(buildAnnualRenewalReminderEmail("pro", "1 August 2027").text, /customer portal/);
  assert.match(buildSubscriptionCancellationEmail("elite", "1 August 2027", true).text, /price lock has been permanently lost/);
});

test("Pocket welcome email explains installation, first upload and feedback", () => {
  const email = buildPocketFoundingWelcomeEmail("https://example.test/pocket");
  assert.equal(email.template, "pocket-founding-welcome");
  assert.match(email.text, /https:\/\/example\.test\/pocket/);
  assert.match(email.text, /Add to Home Screen/);
  assert.match(email.text, /Tap LOAD CHART/);
  assert.match(email.text, /green FEEDBACK button/);
  assert.match(email.text, /does not provide personalised financial advice/);
});

test("Pocket subscription alert identifies a verified sale without card data", () => {
  const email = buildPocketSubscriptionAlertEmail("member@example.com", "https://example.test/admin/commercial");
  assert.equal(email.template, "pocket-subscription-alert");
  assert.match(email.subject, /New Pocket Bullseye subscription/);
  assert.match(email.text, /member@example\.com/);
  assert.match(email.text, /\u00A34\.99 per month/);
  assert.match(email.text, /https:\/\/example\.test\/admin\/commercial/);
  assert.doesNotMatch(email.text, /card number|CVC/i);
});

test("Pocket checkout welcome page exposes the complete quick-start journey", async () => {
  const page = await read("app/pocket/founding/welcome/page.tsx");
  assert.match(page, /SAVE POCKET/);
  assert.match(page, /UPLOAD YOUR FIRST CHART/);
  assert.match(page, /HELP SHAPE POCKET/);
  assert.match(page, /\/pocket#pocket-chart-upload/);
});

test("universal advertising link routes directly to the Founding 650 offer", async () => {
  const page = await read("app/join/page.tsx");
  assert.match(page, /redirect\("\/pocket\/founding#founding"\)/);
  assert.match(page, /index: false/);
});

test("Founding confirmation validates position and continuous-subscription wording", () => {
  assert.equal(buildFounding100ConfirmationEmail("pro", 0), null);
  const email = buildFounding100ConfirmationEmail("elite", 100);
  assert.match(email?.text ?? "", /same subscription stays continuously active/);
  assert.match(email?.text ?? "", /Cancellation or lapse permanently ends/);
});

test("pricing page exposes approved prices, toggle, comparison, FAQ and secure forms", async () => {
  const [page, plans] = await Promise.all([read("app/pricing/page.tsx"), read("app/pricing/PricingPlans.tsx")]);
  assert.match(plans, /£14\.99\/month/);
  assert.match(plans, /£29\.99\/month/);
  assert.match(plans, /£149\/year/);
  assert.match(plans, /£299\/year/);
  assert.match(plans, /Feature comparison/);
  assert.match(page, /Frequently asked questions/);
  assert.match(plans, /action="\/api\/stripe\/checkout"/);
});

test("commercial schema and webhook store interval and unit amount server-side", async () => {
  const [migration, webhook] = await Promise.all([
    read("supabase/migrations/202607170005_commercial_billing.sql"),
    read("app/api/stripe/webhook/route.ts"),
  ]);
  assert.match(migration, /billing_interval/);
  assert.match(migration, /unit_amount/);
  assert.match(webhook, /billing_interval: billingInterval/);
  assert.match(webhook, /unit_amount: unitAmount/);
});

test("commercial admin is allowlisted and labels conversion denominator", async () => {
  const [admin, server] = await Promise.all([
    read("app/admin/commercial/page.tsx"),
    read("app/lib/server/commercial.ts"),
  ]);
  assert.match(admin, /isFounding100Admin/);
  assert.match(admin, /active paid \/ registered accounts/);
  assert.match(admin, /No member or revenue value has been inferred/);
  assert.match(admin, /FOUNDING PRO INTEREST/);
  assert.match(admin, /TOTAL WAITING LIST/);
  assert.match(admin, /waitlist\.metrics\?\.foundingProInterest/);
  assert.match(server, /loadWaitlistMetrics/);
  assert.match(server, /count: "exact", head: true/);
  assert.match(server, /\.eq\("source", "homepage"\)/);
  assert.doesNotMatch(admin, /waitlist.*email|email.*waitlist/i);
});

test("owner launch dashboard is server-only, allowlisted and fail-closed", async () => {
  const [admin, server, css] = await Promise.all([
    read("app/admin/commercial/page.tsx"),
    read("app/lib/server/commercial.ts"),
    read("app/admin/commercial/launch-dashboard.css"),
  ]);
  assert.match(admin, /isFounding100Admin/);
  assert.match(admin, /loadPocketLaunchReport/);
  assert.match(admin, /ACTIVE POCKET SUBSCRIBERS/);
  assert.match(admin, /PAYMENT PROBLEMS/);
  assert.match(admin, /Recent Pocket subscriptions/);
  assert.match(server, /process\.env\.STRIPE_SECRET_KEY/);
  assert.match(server, /stripe\.subscriptions\.list/);
  assert.match(server, /stripe\.invoices\.list/);
  assert.match(server, /status: "unavailable" as const/);
  assert.doesNotMatch(admin, /STRIPE_SECRET_KEY/);
  assert.match(css, /launchMetrics/);
});
