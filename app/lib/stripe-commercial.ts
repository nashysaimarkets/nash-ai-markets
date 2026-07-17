export type CommercialPlan = "pro" | "elite";
export type BillingInterval = "month" | "year";
export type StripeOffering = { plan: CommercialPlan; billingInterval: BillingInterval };

const offeringVariables = {
  pro_month: "STRIPE_PRO_PRICE_ID",
  pro_year: "STRIPE_PRO_ANNUAL_PRICE_ID",
  elite_month: "STRIPE_ELITE_PRICE_ID",
  elite_year: "STRIPE_ELITE_ANNUAL_PRICE_ID",
} as const;

export function checkoutPriceId(
  offering: string | null,
  environment: Record<string, string | undefined> = process.env,
): string | null {
  if (!offering || !(offering in offeringVariables)) return null;
  return environment[offeringVariables[offering as keyof typeof offeringVariables]]?.trim() || null;
}

export function configuredOffering(
  priceId: string | undefined,
  environment: Record<string, string | undefined> = process.env,
): StripeOffering | null {
  if (!priceId) return null;
  for (const [offering, variable] of Object.entries(offeringVariables)) {
    if (priceId !== environment[variable]) continue;
    const [plan, interval] = offering.split("_");
    return { plan: plan as CommercialPlan, billingInterval: interval as BillingInterval };
  }
  return null;
}
