export type CommercialPlan = "pro" | "elite" | "pocket";
export type BillingInterval = "month" | "year";
export type StripeOffering = {
  plan: CommercialPlan;
  billingInterval: BillingInterval;
  foundingEligible: boolean;
};

const offeringVariables = {
  pocket_founding_month: "STRIPE_POCKET_FOUNDING_PRICE_ID",
  founding_pro_month: "STRIPE_FOUNDING_PRO_PRICE_ID",
  pro_month: "STRIPE_PRO_PRICE_ID",
  pro_year: "STRIPE_PRO_ANNUAL_PRICE_ID",
  elite_month: "STRIPE_ELITE_PRICE_ID",
  elite_year: "STRIPE_ELITE_ANNUAL_PRICE_ID",
} as const;

const legacyOfferingVariables = {
  pro_month: "STRIPE_LEGACY_PRO_PRICE_ID",
  elite_month: "STRIPE_LEGACY_ELITE_PRICE_ID",
} as const;

export function checkoutPriceId(
  offering: string | null,
  environment: Record<string, string | undefined> = process.env,
): string | null {
  if (!offering || !(offering in offeringVariables)) return null;
  return environment[offeringVariables[offering as keyof typeof offeringVariables]]?.trim() || null;
}

export function checkoutOffering(
  offering: string | null,
  environment: Record<string, string | undefined> = process.env,
): { priceId: string; offering: StripeOffering } | null {
  const priceId = checkoutPriceId(offering, environment);
  if (!priceId || !offering || !(offering in offeringVariables)) return null;
  const [plan, interval] = offering.replace("founding_", "").split("_");
  const selected = {
    plan: plan as CommercialPlan,
    billingInterval: interval as BillingInterval,
    foundingEligible: offering === "founding_pro_month" || offering === "pocket_founding_month",
  };
  const configured = configuredOffering(priceId, environment);
  return configured
    && configured.plan === selected.plan
    && configured.billingInterval === selected.billingInterval
    && configured.foundingEligible === selected.foundingEligible
    ? { priceId, offering: selected }
    : null;
}

export function validFoundingProPrice(price: {
  active: boolean;
  currency: string;
  type: string;
  unit_amount: number | null;
  recurring?: { interval: string } | null;
}): boolean {
  return price.active
    && price.currency.toLowerCase() === "gbp"
    && price.type === "recurring"
    && price.unit_amount === 1200
    && price.recurring?.interval === "month";
}

export function validPocketFoundingPrice(price: {
  active: boolean;
  currency: string;
  type: string;
  unit_amount: number | null;
  recurring?: { interval: string } | null;
}): boolean {
  return price.active
    && price.currency.toLowerCase() === "gbp"
    && price.type === "recurring"
    && price.unit_amount === 499
    && price.recurring?.interval === "month";
}

export function configuredOffering(
  priceId: string | undefined,
  environment: Record<string, string | undefined> = process.env,
): StripeOffering | null {
  if (!priceId) return null;
  const matches = [] as StripeOffering[];
  for (const [offering, variable] of [
    ...Object.entries(offeringVariables),
    ...Object.entries(legacyOfferingVariables),
  ]) {
    if (priceId !== environment[variable]) continue;
    const [plan, interval] = offering.replace("founding_", "").split("_");
    matches.push({
      plan: plan as CommercialPlan,
      billingInterval: interval as BillingInterval,
      foundingEligible: offering === "founding_pro_month" || offering === "pocket_founding_month",
    });
  }
  const unique = matches.filter((match, index) => matches.findIndex((candidate) => (
    candidate.plan === match.plan
    && candidate.billingInterval === match.billingInterval
    && candidate.foundingEligible === match.foundingEligible
  )) === index);
  return unique.length === 1 ? unique[0] : null;
}
