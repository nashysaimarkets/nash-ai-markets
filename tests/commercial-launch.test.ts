import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { checkoutPriceId, configuredOffering } from "../app/lib/stripe-commercial.ts";
import { calculateCommercialMetrics } from "../app/lib/server/commercial.ts";
import {
  buildAnnualRenewalReminderEmail,
  buildFounding100ConfirmationEmail,
  buildMembershipWelcomeEmail,
  buildPaymentSuccessfulEmail,
  buildSubscriptionCancellationEmail,
} from "../app/lib/launch-email.ts";

const root = new URL("../", import.meta.url);
const read = (path: string) => readFile(new URL(path, root), "utf8");
const environment = {
  STRIPE_PRO_PRICE_ID: "price_pro_month",
  STRIPE_ELITE_PRICE_ID: "price_elite_month",
  STRIPE_PRO_ANNUAL_PRICE_ID: "price_pro_year",
  STRIPE_ELITE_ANNUAL_PRICE_ID: "price_elite_year",
  STRIPE_LEGACY_PRO_PRICE_ID: "price_legacy_pro_month",
  STRIPE_LEGACY_ELITE_PRICE_ID: "price_legacy_elite_month",
};

test("monthly and annual Stripe offerings map without changing legacy customers", () => {
  assert.deepEqual(configuredOffering("price_pro_month", environment), { plan: "pro", billingInterval: "month" });
  assert.deepEqual(configuredOffering("price_elite_year", environment), { plan: "elite", billingInterval: "year" });
  assert.deepEqual(configuredOffering("price_legacy_pro_month", environment), { plan: "pro", billingInterval: "month" });
  assert.deepEqual(configuredOffering("price_legacy_elite_month", environment), { plan: "elite", billingInterval: "month" });
  assert.equal(configuredOffering("unknown", environment), null);
});

test("checkout accepts only enumerated server-side Price IDs", () => {
  assert.equal(checkoutPriceId("pro_year", environment), "price_pro_year");
  assert.equal(checkoutPriceId("elite_month", environment), "price_elite_month");
  assert.equal(checkoutPriceId("legacy_pro_month", environment), null);
  assert.equal(checkoutPriceId("price_attacker", environment), null);
  assert.equal(checkoutPriceId(null, environment), null);
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

test("branded lifecycle email templates state billing and risk truthfully", () => {
  assert.match(buildMembershipWelcomeEmail("pro").text, /educational market commentary/);
  assert.match(buildPaymentSuccessfulEmail("elite", "1 August 2027").text, /confirmed by Stripe/);
  assert.match(buildAnnualRenewalReminderEmail("pro", "1 August 2027").text, /customer portal/);
  assert.match(buildSubscriptionCancellationEmail("elite", "1 August 2027", true).text, /price lock has been permanently lost/);
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
  const admin = await read("app/admin/commercial/page.tsx");
  assert.match(admin, /isFounding100Admin/);
  assert.match(admin, /active paid \/ registered accounts/);
  assert.match(admin, /No member or revenue value has been inferred/);
});
