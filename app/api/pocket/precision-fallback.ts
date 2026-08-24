type JsonRecord = Record<string, unknown>;

function populatedLevels(value: unknown) {
  return value && typeof value === "object" && Array.isArray((value as JsonRecord).levels)
    ? (value as JsonRecord).levels as unknown[]
    : [];
}

function numericPrice(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const parsed = Number(value.replaceAll(",", "").match(/-?\d+(?:\.\d+)?/)?.[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * The report and geometry passes inspect the same chart independently. If the
 * precision pass reads the scale but omits all structures, retain report-pass
 * candidates and let the calibration layer reject anything off-scale.
 */
export function recoverPrecisionGeometry(report: JsonRecord, precision: JsonRecord | null) {
  if (!precision) return null;
  const anchors = Array.isArray(precision.priceScaleAnchors) ? precision.priceScaleAnchors : [];
  const precisionLevels = populatedLevels(precision);
  const reportLevels = populatedLevels(report);
  if (anchors.length < 2 || !reportLevels.length) return precision;

  // The geometry pass is deliberately sparse. Do not let one level found there
  // erase a different, scale-verifiable structure found by the full chart pass.
  // Calibration below still rejects off-scale or malformed candidates.
  const merged = reportLevels.reduce<unknown[]>((levels, candidate) => {
    if (!candidate || typeof candidate !== "object") return levels;
    const record = candidate as JsonRecord;
    const price = numericPrice(record.price);
    const kind = record.kind;
    if (price === null || !["support", "resistance", "pivot"].includes(String(kind))) return levels;
    const duplicate = levels.some((item) => {
      if (!item || typeof item !== "object") return false;
      const existingPrice = numericPrice((item as JsonRecord).price);
      return existingPrice !== null && Math.abs(existingPrice - price) <= Math.max(Math.abs(price) * 0.0005, 0.01);
    });
    return duplicate ? levels : [...levels, candidate];
  }, [...precisionLevels]);

  return { ...precision, levels: merged };
}
