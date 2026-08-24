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

function anchors(value: JsonRecord | null) {
  return value && Array.isArray(value.priceScaleAnchors) ? value.priceScaleAnchors : [];
}

function hasVerifiedScale(value: JsonRecord | null) {
  const readable = anchors(value).flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const record = item as JsonRecord;
    const price = numericPrice(record.price);
    const y = typeof record.y === "number" && Number.isFinite(record.y) ? record.y : null;
    return price === null || y === null ? [] : [{ price, y }];
  });
  return readable.length >= 2 && readable.some((first, index) => readable.slice(index + 1).some((second) => first.price !== second.price && first.y !== second.y));
}

/** Merge independent passes without throwing away the best evidence from either. */
export function recoverPrecisionGeometry(report: JsonRecord, precision: JsonRecord | null) {
  if (!precision) return null;
  const scaleSource = hasVerifiedScale(precision) ? precision : hasVerifiedScale(report) ? report : null;
  if (!scaleSource) return precision;

  const merged = [...populatedLevels(precision), ...populatedLevels(report)].reduce<unknown[]>((levels, candidate) => {
    if (!candidate || typeof candidate !== "object") return levels;
    const record = candidate as JsonRecord;
    const price = numericPrice(record.price);
    if (price === null || !["support", "resistance", "pivot"].includes(String(record.kind))) return levels;
    const duplicate = levels.some((item) => {
      if (!item || typeof item !== "object") return false;
      const existingPrice = numericPrice((item as JsonRecord).price);
      return existingPrice !== null && Math.abs(existingPrice - price) <= Math.max(Math.abs(price) * 0.0005, 0.01);
    });
    return duplicate ? levels : [...levels, candidate];
  }, []);

  return {
    ...precision,
    plotBounds: scaleSource.plotBounds ?? precision.plotBounds,
    priceScaleAnchors: scaleSource.priceScaleAnchors,
    currentPrice: precision.currentPrice || report.currentPrice || "",
    levels: merged,
  };
}
