/** Preserve the supplied numeric value; formatting must not collapse narrow ranges. */
export function evidencePrice(value: number) {
  if (!Number.isFinite(value)) return "Unverified";
  return value.toLocaleString("en-GB", { maximumSignificantDigits: 21 });
}

export function evidencePriceRange(low: number, high: number) {
  return low === high ? evidencePrice(low) : `${evidencePrice(low)}–${evidencePrice(high)}`;
}
