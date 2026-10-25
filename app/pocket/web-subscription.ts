import { POCKET_PRODUCT } from "../lib/product-brand.ts";
export async function getPocketWebAccessStatus(signal?: AbortSignal): Promise<boolean> {
  const response = await fetch("/api/pocket/subscription-access", { cache: "no-store", credentials: "same-origin", signal });
  // Auth/expiry are legitimate denials. Outages must never look like expiry.
  if (response.status === 401 || response.status === 403) return false;
  if (!response.ok) throw new Error(`${POCKET_PRODUCT.shortName} subscription verification is temporarily unavailable.`);
  const body: unknown = await response.json();
  if (!body || typeof body !== "object" || !("entitled" in body) || typeof body.entitled !== "boolean") {
    throw new Error(`${POCKET_PRODUCT.shortName} subscription verification returned an invalid response.`);
  }
  return body.entitled;
}
