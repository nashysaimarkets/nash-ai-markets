type JsonRecord = Record<string, unknown>;

const SIDES = new Set(["ABOVE_PRICE", "BELOW_PRICE"]);
const PATTERNS = new Set(["EQUAL_HIGHS", "EQUAL_LOWS", "SWING_CLUSTER", "RANGE_EDGE", "SESSION_EXTREME", "ROUND_NUMBER"]);
const CONFIDENCE = new Set(["HIGH", "MEDIUM"]);

type Bounds = { left: number; top: number; right: number; bottom: number };
type Anchor = { price: number; y: number };

function finiteNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function boundedText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

export function numericPrice(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const source = value.trim().replace(/[−–—]/g, "-").replace(/[’'\s]/g, "");
  if (!source) return null;
  const commaDecimal = /^-?\d+,\d{1,2}$/.test(source) && !source.includes(".");
  const normalized = commaDecimal ? source.replace(",", ".") : source.replaceAll(",", "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function isPlainNumericPrice(value: string) {
  return /^-?(?:\d+(?:\.\d+)?|\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+,\d{1,2})$/.test(value) && numericPrice(value) !== null;
}

export function correctedCurrentPrice(correction: { categories: string[]; correction: string } | null) {
  if (!correction?.categories.includes("CURRENT_PRICE")) return null;
  const candidate = correction.correction.replace(/[−–—]/g, "-").match(/-?\d[\d,.]*/)?.[0] ?? "";
  return isPlainNumericPrice(candidate) ? candidate : null;
}

export function insufficientLiquidityShield(summary = "Liquidity candidates could not be verified against the visible price scale and candle rows.") {
  return {
    status: "INSUFFICIENT_EVIDENCE",
    summary,
    zones: [],
    stopGuidance: "Use the invalidation defined by your setup; no stop-risk zone is precise enough to mark on this chart.",
  };
}

function verifiedBounds(value: unknown): Bounds | null {
  if (!value || typeof value !== "object") return null;
  const record = value as JsonRecord;
  const left = finiteNumber(record.left);
  const top = finiteNumber(record.top);
  const right = finiteNumber(record.right);
  const bottom = finiteNumber(record.bottom);
  if (left === null || top === null || right === null || bottom === null) return null;
  if ([left, top, right, bottom].some((item) => item < 0 || item > 100)) return null;
  return right > left && bottom > top ? { left, top, right, bottom } : null;
}

function verifiedScale(value: unknown, bounds: Bounds) {
  if (!Array.isArray(value)) return null;
  const anchors = value.flatMap((item): Anchor[] => {
    if (!item || typeof item !== "object") return [];
    const record = item as JsonRecord;
    const price = finiteNumber(record.price);
    const y = finiteNumber(record.y);
    return price !== null && price > 0 && y !== null && y >= bounds.top && y <= bounds.bottom ? [{ price, y }] : [];
  });
  const unique = anchors.filter((anchor, index, all) =>
    all.findIndex((candidate) => candidate.price === anchor.price || candidate.y === anchor.y) === index,
  );
  // Liquidity markup is held to a higher standard than prose levels: three
  // anchors are required so a bad two-point or logarithmic fit cannot pass.
  if (unique.length < 3) return null;
  const ordered = [...unique].sort((left, right) => left.price - right.price);
  if (!ordered.every((anchor, index) => index === 0 || anchor.y < ordered[index - 1].y)) return null;
  const low = ordered[0];
  const high = ordered.at(-1)!;
  if (Math.abs(high.y - low.y) < 12 || high.price === low.price) return null;
  const project = (price: number) => low.y + ((price - low.price) / (high.price - low.price)) * (high.y - low.y);
  if (ordered.some((anchor) => Math.abs(project(anchor.price) - anchor.y) > 1.5)) return null;
  return { project };
}

function rawShieldRank(value: unknown) {
  if (!value || typeof value !== "object") return 0;
  const shield = value as JsonRecord;
  if (shield.status === "VISIBLE_RISK_ZONES" && Array.isArray(shield.zones)) {
    return 20 + shield.zones.reduce<number>((total, zone) => {
      const touchPoints = zone && typeof zone === "object" ? (zone as JsonRecord).touchPoints : null;
      return total + (Array.isArray(touchPoints) ? touchPoints.length : 0);
    }, 0);
  }
  return shield.status === "NO_VISIBLE_RISK_ZONES" ? 10 : 1;
}

export function choosePrecisionLiquidityShield(first: unknown, rescue: unknown) {
  return rawShieldRank(rescue) > rawShieldRank(first) ? rescue : first;
}

export function normalizePrecisionLiquidityShield(precision: JsonRecord | null, currentPriceText: string | null) {
  if (!precision) return insufficientLiquidityShield("The precision chart-reading pass did not complete, so no liquidity zone was drawn.");
  const shield = precision.liquidityShield;
  if (!shield || typeof shield !== "object") return insufficientLiquidityShield();
  const raw = shield as JsonRecord;
  const bounds = verifiedBounds(precision.plotBounds);
  const scale = bounds ? verifiedScale(precision.priceScaleAnchors, bounds) : null;
  const currentPrice = numericPrice(currentPriceText ?? precision.currentPrice);
  if (!bounds || !scale || currentPrice === null || currentPrice <= 0) return insufficientLiquidityShield();
  const currentY = scale.project(currentPrice);
  if (currentY < bounds.top || currentY > bounds.bottom) return insufficientLiquidityShield();

  if (raw.status === "INSUFFICIENT_EVIDENCE") {
    return insufficientLiquidityShield(boundedText(raw.summary, 220) || undefined);
  }
  if (raw.status === "NO_VISIBLE_RISK_ZONES") {
    return {
      status: "NO_VISIBLE_RISK_ZONES",
      summary: boundedText(raw.summary, 220) || "No defensible stop-risk cluster is visible on this chart.",
      zones: [],
      stopGuidance: boundedText(raw.stopGuidance, 220) || "Use the invalidation defined by your setup; no chart-derived stop-risk zone was verified.",
    };
  }
  if (raw.status !== "VISIBLE_RISK_ZONES" || !Array.isArray(raw.zones)) return insufficientLiquidityShield();

  const seen = new Set<number>();
  const plotHeight = bounds.bottom - bounds.top;
  const maxBandHeight = plotHeight * .08;
  const rowTolerance = Math.min(1.5, Math.max(.6, plotHeight * .02));
  const confidenceRank: Record<string, number> = { HIGH: 0, MEDIUM: 1 };
  const zones = [...raw.zones].sort((left, right) => {
    const leftConfidence = left && typeof left === "object" ? String((left as JsonRecord).confidence) : "";
    const rightConfidence = right && typeof right === "object" ? String((right as JsonRecord).confidence) : "";
    return (confidenceRank[leftConfidence] ?? 2) - (confidenceRank[rightConfidence] ?? 2);
  }).flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const zone = item as JsonRecord;
    const side = typeof zone.side === "string" && SIDES.has(zone.side) ? zone.side : null;
    const pattern = typeof zone.pattern === "string" && PATTERNS.has(zone.pattern) ? zone.pattern : null;
    const rawConfidence = typeof zone.confidence === "string" && CONFIDENCE.has(zone.confidence) ? zone.confidence : null;
    const priceLow = finiteNumber(zone.priceLow);
    const priceHigh = finiteNumber(zone.priceHigh);
    if (!side || !pattern || !rawConfidence || priceLow === null || priceHigh === null || priceLow <= 0 || priceHigh <= 0 || priceHigh < priceLow) return [];
    // The complete range must be on the declared side of current price. A
    // midpoint check could otherwise draw a band that straddles live price.
    if (side === "ABOVE_PRICE" && priceLow <= currentPrice) return [];
    if (side === "BELOW_PRICE" && priceHigh >= currentPrice) return [];

    const projectedLow = scale.project(priceLow);
    const projectedHigh = scale.project(priceHigh);
    const bandTop = Math.min(projectedLow, projectedHigh);
    const bandBottom = Math.max(projectedLow, projectedHigh);
    if (bandTop < bounds.top || bandBottom > bounds.bottom) return [];
    if (bandBottom - bandTop > maxBandHeight) return [];

    const touchPoints = Array.isArray(zone.touchPoints) ? zone.touchPoints.flatMap((point) => {
      if (!point || typeof point !== "object") return [];
      const record = point as JsonRecord;
      const x = finiteNumber(record.x);
      const y = finiteNumber(record.y);
      return x !== null && y !== null && x >= bounds.left && x <= bounds.right && y >= bounds.top && y <= bounds.bottom ? [{ x, y }] : [];
    }).filter((point, index, all) => all.findIndex((candidate) => Math.abs(candidate.x - point.x) < .75) === index) : [];
    if (touchPoints.length < 2) return [];
    if (!touchPoints.every((point) => point.y >= bandTop - rowTolerance && point.y <= bandBottom + rowTolerance)) return [];
    const confidence = rawConfidence === "HIGH" && touchPoints.length < 3 ? "MEDIUM" : rawConfidence;

    const key = Math.round(((bandTop + bandBottom) / 2) * 2);
    if (seen.has(key)) return [];
    seen.add(key);
    return [{
      side,
      pattern,
      label: boundedText(zone.label, 48) || pattern.replaceAll("_", " "),
      priceLow,
      priceHigh,
      confidence,
      evidence: boundedText(zone.evidence, 160) || `${touchPoints.length} visible reactions align with the verified price band.`,
      touchPoints: touchPoints.slice(0, 6),
    }];
  }).slice(0, 4);

  if (!zones.length) return insufficientLiquidityShield("No candidate liquidity zone survived price-scale, side and candle-row verification.");
  return {
    status: "VISIBLE_RISK_ZONES",
    summary: `${zones.length} visually inferred stop-risk zone${zones.length === 1 ? "" : "s"} passed scale, side and candle-row checks.`,
    zones,
    stopGuidance: boundedText(raw.stopGuidance, 220) || "Keep invalidation structurally decisive and verify the marked risk area on the original chart.",
  };
}
