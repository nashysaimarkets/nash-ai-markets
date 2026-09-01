import { canonicalizePocketGeometry } from "../lib/pocket-geometry";

export type LiquidityZoneSide = "ABOVE_PRICE" | "BELOW_PRICE";
export type LiquidityZoneConfidence = "HIGH" | "MEDIUM" | "LOW";
export type LiquidityZonePattern = "EQUAL_HIGHS" | "EQUAL_LOWS" | "SWING_CLUSTER" | "RANGE_EDGE" | "SESSION_EXTREME" | "ROUND_NUMBER";

export type LiquidityTouchPoint = { x: number; y: number };

export type LiquidityZone = {
  side: LiquidityZoneSide;
  pattern: LiquidityZonePattern;
  label: string;
  priceLow: number;
  priceHigh: number;
  touchPoints: LiquidityTouchPoint[];
  confidence: LiquidityZoneConfidence;
  evidence: string;
};

export type LiquidityShield = {
  status: "VISIBLE_RISK_ZONES" | "NO_VISIBLE_RISK_ZONES" | "INSUFFICIENT_EVIDENCE";
  summary: string;
  zones: LiquidityZone[];
  stopGuidance: string;
};

export type LiquidityPlotBounds = { left: number; top: number; right: number; bottom: number };
export type LiquidityScaleAnchor = { price: number; y: number };
export type LiquidityReadability = { chartReadability?: string; candlesReadable?: boolean };

export type ProjectedLiquidityZone = LiquidityZone & {
  lineY: number;
  top: number;
  height: number;
  left: number;
  right: number;
};

const FULL_IMAGE_BOUNDS: LiquidityPlotBounds = { left: 0, top: 0, right: 100, bottom: 100 };
const SCALE_RESIDUAL_TOLERANCE = 1.5;
const MAX_BAND_PLOT_RATIO = .08;
const TOUCH_TOLERANCE_PLOT_RATIO = .02;
const MIN_TOUCH_X_SEPARATION = .75;

function finitePercent(value: number) {
  return Number.isFinite(value) && value >= 0 && value <= 100;
}

function validBounds(bounds: LiquidityPlotBounds | undefined) {
  return bounds && finitePercent(bounds.left) && finitePercent(bounds.top) && finitePercent(bounds.right) && finitePercent(bounds.bottom)
    && bounds.right > bounds.left && bounds.bottom > bounds.top ? bounds : null;
}

const GROUPED_INTEGER = String.raw`(?:\d+|\d{1,3}(?:[,\s'’]\d{3})+)`;
const EXACT_PRICE = new RegExp(String.raw`^[\$£€¥]?\s*(${GROUPED_INTEGER}(?:\.\d+)?)$`);
const DECIMAL_COMMA_PRICE = /^[\$£€¥]?\s*(\d+,\d{1,2})$/;

/** Parse one exact, positive price. Prose, compact suffixes and ambiguous decimal commas fail closed. */
export function parseLiquidityCurrentPrice(value: string | undefined) {
  const source = value?.trim() ?? "";
  const decimalComma = source.match(DECIMAL_COMMA_PRICE);
  const match = source.match(EXACT_PRICE);
  if (!match && !decimalComma) return null;
  const numeric = Number(decimalComma ? decimalComma[1].replace(",", ".") : match![1].replace(/[,\s'’]/g, ""));
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}

/** Display helper for exact scalar values or a strictly formatted two-price range. */
export function parseLiquidityPriceRange(value: string | undefined) {
  const source = value?.trim();
  if (!source) return [];
  const scalar = parseLiquidityCurrentPrice(source);
  if (scalar !== null) return [scalar];
  const parts = source.split(/\s*(?:[–—-]|\bTO\b)\s*/i);
  if (parts.length !== 2 || parts.some((part) => !part)) return [];
  const values = parts.map((part) => parseLiquidityCurrentPrice(part));
  return values.every((price): price is number => price !== null) ? values : [];
}

function verifiedPercentLiquidityScale(anchors: LiquidityScaleAnchor[], bounds?: LiquidityPlotBounds) {
  const plot = validBounds(bounds) ?? (bounds === undefined ? FULL_IMAGE_BOUNDS : null);
  if (!plot) return null;
  const valid = anchors.filter((anchor) =>
    Number.isFinite(anchor.price) && anchor.price > 0 && finitePercent(anchor.y)
    && anchor.y >= plot.top && anchor.y <= plot.bottom,
  );
  const unique = valid.filter((anchor, index, all) =>
    all.findIndex((candidate) => candidate.price === anchor.price || candidate.y === anchor.y) === index,
  );
  // Three points are the minimum that can distinguish a linear axis from a
  // log/non-linear scale or a pair of coincidentally plausible OCR labels.
  if (unique.length < 3) return null;
  const ordered = [...unique].sort((left, right) => left.price - right.price);
  if (!ordered.every((anchor, index) => index === 0 || anchor.y < ordered[index - 1].y)) return null;
  const low = ordered[0];
  const high = ordered.at(-1)!;
  if (Math.abs(high.y - low.y) < 12) return null;
  const project = (price: number) => low.y + ((price - low.price) / (high.price - low.price)) * (high.y - low.y);
  if (ordered.some((anchor) => Math.abs(project(anchor.price) - anchor.y) > SCALE_RESIDUAL_TOLERANCE)) return null;
  return { project, low, high };
}

export function verifiedLiquidityScale(anchors: LiquidityScaleAnchor[], bounds?: LiquidityPlotBounds) {
  const geometry = canonicalizePocketGeometry({ plotBounds: bounds, priceScaleAnchors: anchors }) as {
    plotBounds?: LiquidityPlotBounds;
    priceScaleAnchors: LiquidityScaleAnchor[];
  };
  return verifiedPercentLiquidityScale(geometry.priceScaleAnchors, geometry.plotBounds);
}

export function projectLiquidityPrice(price: number, anchors: LiquidityScaleAnchor[], bounds: LiquidityPlotBounds | undefined) {
  const geometry = canonicalizePocketGeometry({ plotBounds: bounds, priceScaleAnchors: anchors }) as {
    plotBounds?: LiquidityPlotBounds;
    priceScaleAnchors: LiquidityScaleAnchor[];
  };
  const plot = validBounds(geometry.plotBounds);
  const scale = plot ? verifiedPercentLiquidityScale(geometry.priceScaleAnchors, plot) : null;
  if (!scale || !plot || !Number.isFinite(price) || price <= 0) return null;
  const y = scale.project(price);
  return y >= plot.top && y <= plot.bottom ? y : null;
}

function verifiedTouchPoints(points: LiquidityTouchPoint[], plot: LiquidityPlotBounds) {
  if (!Array.isArray(points)) return [];
  const valid = points.filter((point) =>
    point && finitePercent(point.x) && finitePercent(point.y)
    && point.x >= plot.left && point.x <= plot.right && point.y >= plot.top && point.y <= plot.bottom,
  );
  return valid.filter((point, index, all) =>
    all.findIndex((candidate) => Math.abs(candidate.x - point.x) < MIN_TOUCH_X_SEPARATION) === index,
  );
}

export function projectLiquidityZones(
  shield: LiquidityShield | null | undefined,
  currentPrice: string | undefined,
  anchors: LiquidityScaleAnchor[] = [],
  bounds?: LiquidityPlotBounds,
  readability?: LiquidityReadability,
) {
  if (!shield || shield.status !== "VISIBLE_RISK_ZONES" || !Array.isArray(shield.zones)) return [];
  if (readability?.chartReadability === "POOR" || readability?.candlesReadable === false) return [];
  const geometry = canonicalizePocketGeometry({ plotBounds: bounds, priceScaleAnchors: anchors, liquidityShield: shield }) as {
    plotBounds?: LiquidityPlotBounds;
    priceScaleAnchors: LiquidityScaleAnchor[];
    liquidityShield: LiquidityShield;
  };
  const normalizedShield = geometry.liquidityShield;
  const plot = validBounds(geometry.plotBounds);
  const scale = plot ? verifiedPercentLiquidityScale(geometry.priceScaleAnchors, plot) : null;
  const current = parseLiquidityCurrentPrice(currentPrice);
  if (!plot || !scale || current === null) return [];
  // A numeric-looking badge is not enough. It must belong to the calibrated
  // visible chart range before it can classify pools as above or below price.
  const currentY = scale.project(current);
  if (currentY < plot.top || currentY > plot.bottom) return [];
  const plotHeight = plot.bottom - plot.top;
  const maxBandHeight = plotHeight * MAX_BAND_PLOT_RATIO;
  const touchTolerance = Math.min(1.5, Math.max(.6, plotHeight * TOUCH_TOLERANCE_PLOT_RATIO));
  const confidenceRank: Record<LiquidityZoneConfidence, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };
  const seen = new Set<number>();

  return [...normalizedShield.zones]
    .sort((left, right) => confidenceRank[left.confidence] - confidenceRank[right.confidence])
    .flatMap((zone): ProjectedLiquidityZone[] => {
      // LOW-confidence pools remain textual evidence only. They are never drawn
      // over a customer's chart as if their position were verified.
      if (zone.confidence === "LOW") return [];
      const { priceLow, priceHigh } = zone;
      if (![priceLow, priceHigh].every((price) => Number.isFinite(price) && price > 0) || priceHigh < priceLow) return [];
      // A range that touches or straddles current price cannot truthfully be
      // classified on either side and is withheld rather than clipped.
      if (zone.side === "ABOVE_PRICE" && priceLow <= current) return [];
      if (zone.side === "BELOW_PRICE" && priceHigh >= current) return [];
      const lowY = scale.project(priceLow);
      const highY = scale.project(priceHigh);
      if (![lowY, highY].every((y) => y >= plot.top && y <= plot.bottom)) return [];
      const exactHeight = Math.abs(lowY - highY);
      if (exactHeight > maxBandHeight) return [];
      const bandTop = Math.min(lowY, highY);
      const bandBottom = Math.max(lowY, highY);
      const touches = verifiedTouchPoints(zone.touchPoints, plot);
      if (touches.length < 2) return [];
      if (touches.some((point) => point.y < bandTop - touchTolerance || point.y > bandBottom + touchTolerance)) return [];
      const lineY = (lowY + highY) / 2;
      const key = Math.round(lineY * 2);
      if (seen.has(key)) return [];
      seen.add(key);
      const visibleHeight = Math.max(.7, exactHeight);
      const top = Math.max(plot.top, lineY - visibleHeight / 2);
      return [{
        ...zone,
        touchPoints: touches,
        lineY,
        top,
        height: Math.min(visibleHeight, plot.bottom - top),
        left: plot.left,
        right: plot.right,
      }];
    })
    .sort((left, right) => Math.abs((left.priceLow + left.priceHigh) / 2 - current) - Math.abs((right.priceLow + right.priceHigh) / 2 - current));
}
