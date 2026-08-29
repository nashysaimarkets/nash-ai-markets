import { numericPrice } from "./liquidity-precision.ts";

type JsonRecord = Record<string, unknown>;

function populatedLevels(value: unknown) {
  return value && typeof value === "object" && Array.isArray((value as JsonRecord).levels)
    ? (value as JsonRecord).levels as unknown[]
    : [];
}

function anchors(value: JsonRecord | null) {
  return value && Array.isArray(value.priceScaleAnchors) ? value.priceScaleAnchors : [];
}

function hasVerifiedScale(value: JsonRecord | null) {
  const rawBounds = value?.plotBounds && typeof value.plotBounds === "object" ? value.plotBounds as JsonRecord : null;
  const top = rawBounds ? numericPrice(rawBounds.top) : 0;
  const bottom = rawBounds ? numericPrice(rawBounds.bottom) : 100;
  if (top === null || bottom === null || top < 0 || bottom > 100 || bottom <= top) return false;
  const readable = anchors(value).flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const record = item as JsonRecord;
    const price = numericPrice(record.price);
    const y = numericPrice(record.y);
    return price === null || price <= 0 || y === null || y < top || y > bottom ? [] : [{ price, y }];
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
  if (!scaleSource) return null;

  // Keep the candidates measured against the selected scale ahead of candidates
  // from the other pass. Previously rescue candidates always won duplicate
  // prices, even when the rescue scale was rejected and the first-pass scale was
  // selected. That could replace a self-consistent row with crop-relative
  // geometry which calibration then (correctly) removed.
  const secondarySource = scaleSource === precision ? report : precision;
  const merged = [...populatedLevels(scaleSource), ...populatedLevels(secondarySource)].reduce<unknown[]>((levels, candidate) => {
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
    // Keep the current-price marker measured with the selected verified scale.
    // An unscaled reading crop must not move the reference price and turn two
    // same-sided levels into a false support/resistance bracket.
    currentPrice: scaleSource.currentPrice || "",
    levels: merged,
  };
}
