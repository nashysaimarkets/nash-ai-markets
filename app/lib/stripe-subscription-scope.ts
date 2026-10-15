import { configuredOffering, type StripeOffering } from "./stripe-commercial.ts";

/**
 * Fail closed on mixed, extra, missing or unrecognised Stripe subscription items.
 * A recognised price in one item must never hide an unrecognised second item.
 */
export function singleConfiguredSubscriptionItem<T extends { price: { id: string } }>(
  items: readonly T[],
  environment: Record<string, string | undefined> = process.env,
): { item: T; offering: StripeOffering } | null {
  if (items.length !== 1) return null;
  const item = items[0];
  if (!item) return null;
  const offering = configuredOffering(item.price.id, environment);
  return offering ? { item, offering } : null;
}

/** Checkout identity checks must be imposed on actual Pocket-priced subscriptions,
 * not on anonymous legacy Pro/Elite customer flows. */
export function containsPocketPrice<T extends { price: { id: string } }>(
  items: readonly T[],
  environment: Record<string, string | undefined> = process.env,
): boolean {
  return items.some(item => configuredOffering(item.price.id, environment)?.plan === "pocket");
}
