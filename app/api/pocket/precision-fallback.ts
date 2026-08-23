type JsonRecord = Record<string, unknown>;

function populatedLevels(value: unknown) {
  return value && typeof value === "object" && Array.isArray((value as JsonRecord).levels)
    ? (value as JsonRecord).levels as unknown[]
    : [];
}

/**
 * The report and geometry passes inspect the same chart independently. If the
 * precision pass reads the scale but omits all structures, retain report-pass
 * candidates and let the calibration layer reject anything off-scale.
 */
export function recoverPrecisionGeometry(report: JsonRecord, precision: JsonRecord | null) {
  if (!precision) return null;
  if (populatedLevels(precision).length || !populatedLevels(report).length) return precision;
  const anchors = Array.isArray(precision.priceScaleAnchors) ? precision.priceScaleAnchors : [];
  if (anchors.length < 2) return precision;
  return { ...precision, levels: report.levels };
}
