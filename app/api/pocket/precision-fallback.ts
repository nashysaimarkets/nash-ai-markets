type JsonRecord = Record<string, unknown>;

function populatedLevels(value: unknown) {
  return value && typeof value === "object" && Array.isArray((value as JsonRecord).levels)
    ? (value as JsonRecord).levels as unknown[]
    : [];
}

function numericPrice(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const source = value.replace(/[−–—]/g, "-").replace(/[’'\s]/g, "");
  const commaDecimal = /^-?\d+,\d{1,2}(?:\D|$)/.test(source) && !source.includes(".");
  const normalized = commaDecimal ? source.replace(",", ".") : source.replaceAll(",", "");
  const parsed = Number(normalized.match(/-?\d+(?:\.\d+)?/)?.[0]);
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
    const y = numericPrice(record.y);
    return price === null || price <= 0 || y === null || y < 0 || y > 100 ? [] : [{ price, y }];
  });
  const unique = readable.filter((item, index, all) => all.findIndex((candidate) => candidate.price === item.price || candidate.y === item.y) === index);
  if (unique.length < 2) return false;
  const ordered = [...unique].sort((a, b) => a.price - b.price);
  if (!ordered.every((item, index) => index === 0 || item.y < ordered[index - 1].y)) return false;
  const low = ordered[0];
  const high = ordered.at(-1)!;
  if (Math.abs(high.y - low.y) < (ordered.length === 2 ? 20 : 12)) return false;
  const project = (price: number) => low.y + ((price - low.price) / (high.price - low.price)) * (high.y - low.y);
  return ordered.length === 2 || ordered.every((item) => Math.abs(project(item.price) - item.y) <= 2.5);
}

/** Merge independent passes without throwing away the best evidence from either. */
export function recoverPrecisionGeometry(report: JsonRecord, precision: JsonRecord | null) {
  // The dedicated geometry call can occasionally fail even though the main
  // structured pass returned a complete, internally verifiable scale. Keep
  // that evidence instead of turning a clear chart into an empty precision
  // hold. Two non-degenerate axis anchors are still mandatory, so this remains
  // fail-closed for cropped or unreadable price scales.
  if (!precision) {
    if (!hasVerifiedScale(report)) return null;
    return {
      plotBounds: report.plotBounds,
      priceScaleAnchors: report.priceScaleAnchors,
      currentPrice: report.currentPrice || "",
      levels: populatedLevels(report),
    };
  }
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
