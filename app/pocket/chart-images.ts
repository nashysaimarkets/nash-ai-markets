/** Transport roles identify source images, never prove a timeframe. */
export const POCKET_IMAGE_SLOTS = [
  ["image", "PRIMARY", "Primary chart"],
  ["contextImage", "HIGHER_TIMEFRAME", "Supporting chart 2"],
  ["detailImage", "PRICE_DETAIL", "Supporting chart 3"],
  ["fourHourImage", "FOUR_HOUR", "Supporting chart 4"],
  ["indicatorImage", "INDICATOR_VOLUME", "Indicator or volume chart"],
] as const;
type ImageField = typeof POCKET_IMAGE_SLOTS[number][0];
type Images = Partial<Record<ImageField, unknown>>;

export function validatePocketImages(images: Images, maxLength = 11_000_000): string | null {
  for (const [field, , label] of POCKET_IMAGE_SLOTS) {
    const value = images[field];
    if (field !== "image" && (value === undefined || value === null || value === "")) continue;
    if (typeof value !== "string" || !/^data:image\/(jpeg|png|webp);base64,/.test(value) || value.length > maxLength) {
      return `${label}: please upload a valid JPEG, PNG or WebP chart under 8 MB.`;
    }
  }
  return null;
}

export function pocketImageContent(images: Images, supportingDetail: "low" | "high" = "high") {
  return POCKET_IMAGE_SLOTS.flatMap<
    { type: "input_text"; text: string } | { type: "input_image"; image_url: string; detail: "low" | "high" }
  >(([field, role, label]) => {
    const value = images[field];
    if (typeof value !== "string" || !value) return [];
    return [
      { type: "input_text" as const, text: `ROLE: ${role} · ${label}. Read the actual visible timeframe; the role does not imply one.${field === "image" ? " Primary geometry must use this image's coordinates." : " Keep evidence tied to this source image."}` },
      { type: "input_image" as const, image_url: value, detail: field === "image" ? "high" as const : supportingDetail },
    ];
  });
}

/** Never display a model's pattern from an image that was not uploaded. */
export function scopePocketImageEvidence(analysis: Record<string, unknown>, images: Images) {
  const suppliedRoles = new Set<string>(POCKET_IMAGE_SLOTS.filter(([field]) => Boolean(images[field])).map(([, role]) => role));
  if (Array.isArray(analysis.patterns)) {
    analysis.patterns = analysis.patterns.filter((pattern) => pattern && typeof pattern === "object" && suppliedRoles.has(pattern.sourceRole ?? "PRIMARY"));
  }
  if (!images.contextImage && !images.detailImage && !images.fourHourImage) {
    analysis.higherTimeframe = {
      provided: false, timeframe: "UNKNOWN", direction: "UNKNOWN", alignment: "NOT_PROVIDED",
      summary: "This analysis covers your primary chart. An optional higher-timeframe chart can add broader context.",
    };
  }
  if (!images.contextImage) {
    analysis.contextContribution = { used: false, materialChange: false, resolvedInputs: [], summary: "No second chart was supplied." };
  }
  return analysis;
}

export function normalizePatternFrame(value: string | undefined): string | null {
  const compact = (value ?? "").trim().toUpperCase()
    .replace(/MINUTES?|MINS?/g, "M").replace(/HOURS?|HRS?/g, "H")
    .replace(/DAILY/g, "1D").replace(/WEEKLY/g, "1W").replace(/DAYS?/g, "D").replace(/WEEKS?/g, "W").replace(/\s+/g, "");
  if (/^\d+[SMHDW]$/.test(compact)) return compact;
  const reversed = compact.match(/^([SMHDW])(\d+)$/);
  if (reversed) return `${reversed[2]}${reversed[1]}`;
  if (["D", "DAILY"].includes(compact)) return "1D";
  if (["W", "WEEKLY"].includes(compact)) return "1W";
  return null;
}
