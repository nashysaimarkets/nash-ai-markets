import { calibratePocketAnalysis, verifiedLinearScale } from "./analysis-calibration.ts";
import { isPlainNumericPrice, numericPrice } from "./liquidity-precision.ts";
import { instrumentIdentitiesMatch, structuralSideCoverage } from "./precision-structure.ts";

type JsonRecord = Record<string, unknown>;

type ScaleAnchor = { price: number; y: number };

export type LevelLabPrimaryProvenance = {
  instrument: string;
  ticker: string;
  timeframe: string;
  currentPrice: string;
  identityLocked: true;
  plotBounds?: { left: number; top: number; right: number; bottom: number };
  priceScaleAnchors?: ScaleAnchor[];
};

export type LevelLabRejection =
  | "PRIMARY_PROVENANCE_UNVERIFIED"
  | "INSTRUMENT_UNREADABLE"
  | "INSTRUMENT_MISMATCH"
  | "CURRENT_PRICE_UNREADABLE"
  | "CURRENT_PRICE_MISMATCH"
  | "CANDLES_UNREADABLE"
  | "PRICE_SCALE_UNVERIFIED"
  | "GEOMETRY_UNVERIFIED"
  | "ONE_SIDED_STRUCTURE";

export type LevelLabValidation =
  | { ok: true; levels: JsonRecord }
  | { ok: false; reason: LevelLabRejection };

function text(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function parsePrimaryScale(record: JsonRecord) {
  const bounds = strictBounds(record.plotBounds);
  const anchors = strictAnchors(record.priceScaleAnchors, bounds);
  if (!bounds || !verifiedLinearScale(anchors)) return null;
  return { plotBounds: bounds, priceScaleAnchors: anchors };
}

export function validateLevelLabPrimaryProvenance(value: unknown): LevelLabPrimaryProvenance | null {
  if (!value || typeof value !== "object") return null;
  const record = value as JsonRecord;
  const instrument = text(record.instrument, 80);
  const ticker = text(record.ticker, 30);
  const timeframe = text(record.timeframe, 30);
  const currentPrice = text(record.currentPrice, 30);
  if (record.identityLocked !== true || !instrument || instrument === "UNKNOWN" || !timeframe || timeframe === "UNKNOWN") return null;
  if (!isPlainNumericPrice(currentPrice) || (numericPrice(currentPrice) ?? 0) <= 0) return null;
  const scale = parsePrimaryScale(record);
  return {
    instrument,
    ticker,
    timeframe,
    currentPrice,
    identityLocked: true,
    ...(scale ?? {}),
  };
}

/** Level Lab accepts slightly tighter mobile axis reads before falling back to the primary scale. */
function levelLabLinearScale(items: ScaleAnchor[]) {
  const strict = verifiedLinearScale(items);
  if (strict) return strict;
  const unique = items.filter((item, index, all) => all.findIndex((candidate) => candidate.price === item.price || candidate.y === item.y) === index);
  if (unique.length < 2) return null;
  const ordered = [...unique].sort((a, b) => a.price - b.price);
  if (!ordered.every((item, index) => index === 0 || item.y <= ordered[index - 1].y)) return null;
  const low = ordered[0];
  const high = ordered.at(-1)!;
  if (Math.abs(high.y - low.y) < 14) return null;
  const project = (price: number) => low.y + ((price - low.price) / (high.price - low.price)) * (high.y - low.y);
  if (ordered.length >= 3 && ordered.some((item) => Math.abs(project(item.price) - item.y) > 3.5)) return null;
  return { low, high, project, count: ordered.length };
}

function resolveLevelLabScale(raw: JsonRecord, primary: LevelLabPrimaryProvenance) {
  const labBounds = strictBounds(raw.plotBounds);
  const labAnchors = strictAnchors(raw.priceScaleAnchors, labBounds);
  const labScale = labBounds && levelLabLinearScale(labAnchors) ? { bounds: labBounds, anchors: labAnchors } : null;
  if (labScale && raw.priceScaleReadable === true) return labScale;
  if (primary.plotBounds && primary.priceScaleAnchors?.length) {
    return { bounds: primary.plotBounds, anchors: primary.priceScaleAnchors };
  }
  return labScale;
}

function strictBounds(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const record = value as JsonRecord;
  const left = typeof record.left === "number" && Number.isFinite(record.left) ? record.left : null;
  const top = typeof record.top === "number" && Number.isFinite(record.top) ? record.top : null;
  const right = typeof record.right === "number" && Number.isFinite(record.right) ? record.right : null;
  const bottom = typeof record.bottom === "number" && Number.isFinite(record.bottom) ? record.bottom : null;
  if (left === null || top === null || right === null || bottom === null) return null;
  if ([left, top, right, bottom].some((item) => item < 0 || item > 100)) return null;
  if (right - left < 20 || bottom - top < 20) return null;
  return { left, top, right, bottom };
}

function strictAnchors(value: unknown, bounds: ReturnType<typeof strictBounds>) {
  if (!bounds || !Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const record = item as JsonRecord;
    const price = numericPrice(record.price);
    const y = typeof record.y === "number" && Number.isFinite(record.y) ? record.y : null;
    return price !== null && price > 0 && y !== null && y >= bounds.top && y <= bounds.bottom ? [{ price, y }] : [];
  });
}

function currentPricesCompatible(primaryValue: unknown, levelLabValue: unknown) {
  const primary = numericPrice(primaryValue);
  const levelLab = numericPrice(levelLabValue);
  if (primary === null || levelLab === null || primary <= 0 || levelLab <= 0) return false;
  const denominator = Math.max(Math.abs(primary), Math.abs(levelLab), 1);
  return Math.abs(primary - levelLab) / denominator <= 0.02;
}

/**
 * Level Lab may replace only the structural map. Identity and current price
 * remain bound to the already verified primary analysis.
 */
export function validateLevelLabScan(rawValue: unknown, primaryValue: unknown): LevelLabValidation {
  const primary = validateLevelLabPrimaryProvenance(primaryValue);
  if (!primary) return { ok: false, reason: "PRIMARY_PROVENANCE_UNVERIFIED" };
  if (!rawValue || typeof rawValue !== "object") return { ok: false, reason: "GEOMETRY_UNVERIFIED" };
  const raw = rawValue as JsonRecord;

  if (raw.instrumentConfidence !== "HIGH" || !text(raw.instrumentIdentifier, 80)) return { ok: false, reason: "INSTRUMENT_UNREADABLE" };
  const identityMatch = instrumentIdentitiesMatch([primary.instrument, primary.ticker], raw.instrumentIdentifier);
  if (identityMatch !== true) return { ok: false, reason: identityMatch === null ? "INSTRUMENT_UNREADABLE" : "INSTRUMENT_MISMATCH" };
  if (!isPlainNumericPrice(text(raw.currentPrice, 30))) return { ok: false, reason: "CURRENT_PRICE_UNREADABLE" };
  if (!currentPricesCompatible(primary.currentPrice, raw.currentPrice)) return { ok: false, reason: "CURRENT_PRICE_MISMATCH" };
  if (raw.candlesReadable !== true || raw.confidence === "LOW") return { ok: false, reason: "CANDLES_UNREADABLE" };

  const scaleFrame = resolveLevelLabScale(raw, primary);
  if (!scaleFrame) return { ok: false, reason: "PRICE_SCALE_UNVERIFIED" };
  const { bounds, anchors } = scaleFrame;

  const calibrated = calibratePocketAnalysis({
    ...raw,
    currentPrice: primary.currentPrice,
    plotBounds: bounds,
    priceScaleAnchors: anchors,
    evidenceQuality: {
      chartReadability: "CLEAR",
      instrumentConfidence: "HIGH",
      timeframeConfidence: "HIGH",
      scaleReadable: true,
      candlesReadable: true,
      limitations: [],
    },
    instrument: primary.instrument,
    ticker: primary.ticker,
    timeframe: primary.timeframe,
    contradictions: [],
    missingInputs: [],
    setupScore: { overall: 0, grade: "F" },
  }, levelLabLinearScale) as JsonRecord;
  const levels = Array.isArray(calibrated.levels)
    ? calibrated.levels.filter((level): level is JsonRecord => Boolean(level && typeof level === "object")
      && ["support", "resistance"].includes(String((level as JsonRecord).kind))
      && numericPrice((level as JsonRecord).price) !== null)
    : [];
  if (levels.length < 2) return { ok: false, reason: "GEOMETRY_UNVERIFIED" };
  const coverage = structuralSideCoverage(levels, primary.currentPrice);
  if (!coverage.twoSided) return { ok: false, reason: "ONE_SIDED_STRUCTURE" };
  const trustGate = calibrated.trustGate && typeof calibrated.trustGate === "object"
    ? calibrated.trustGate as JsonRecord
    : null;
  if (trustGate?.status !== "LOCKED" || trustGate.scaleLocked !== true || trustGate.identityLocked !== true || trustGate.chartLocked !== true) {
    return { ok: false, reason: "GEOMETRY_UNVERIFIED" };
  }

  return {
    ok: true,
    levels: {
      plotBounds: bounds,
      priceScaleAnchors: anchors,
      levels: levels.map((level) => ({ ...level, source: "LEVEL_LAB" })),
      // The Level Lab marker is used only as a compatibility check. It never
      // replaces the primary chart's verified current-price provenance.
      currentPrice: primary.currentPrice,
      // This gate is calculated from the same validated Level Lab structure
      // and must be applied atomically with it. Reusing the primary chart's
      // earlier HOLD/PARTIAL gate would leave the map and its trust state in
      // contradiction.
      trustGate,
      levelStory: text(raw.levelStory, 260) || "Two-sided support and resistance passed Level Lab verification.",
      confidence: raw.confidence === "HIGH" ? "HIGH" : "MEDIUM",
      limitation: text(raw.limitation, 160),
      provenance: {
        source: "LEVEL_LAB",
        primaryInstrument: primary.instrument,
        primaryTimeframe: primary.timeframe,
        primaryCurrentPrice: primary.currentPrice,
        levelLabInstrument: text(raw.instrumentIdentifier, 80),
      },
    },
  };
}

export function levelLabRejectionMessage(reason: LevelLabRejection) {
  if (reason === "PRIMARY_PROVENANCE_UNVERIFIED") return "Level Lab needs a verified primary instrument, timeframe and current price before it can replace the map.";
  if (reason === "INSTRUMENT_UNREADABLE") return "The Level Lab chart instrument could not be verified. Use a screenshot with the full instrument title visible.";
  if (reason === "INSTRUMENT_MISMATCH") return "The Level Lab chart does not match the verified primary instrument, so no levels were applied.";
  if (reason === "CURRENT_PRICE_UNREADABLE") return "The Level Lab chart current-price marker is not readable. Use a clearer price-scale screenshot.";
  if (reason === "CURRENT_PRICE_MISMATCH") return "The Level Lab chart price does not match the verified primary chart closely enough, so no levels were applied.";
  if (reason === "CANDLES_UNREADABLE") return "The Level Lab candle reactions are not clear enough to verify structure.";
  if (reason === "PRICE_SCALE_UNVERIFIED") return "The Level Lab price scale could not be verified. Use a screenshot with at least two clear price labels on the right-hand axis, or reuse the same chart that already passed the main read.";
  if (reason === "ONE_SIDED_STRUCTURE") return "Level Lab could not verify both support below and resistance above the current price.";
  return "Level Lab could not verify the level prices against the visible scale and candle rows.";
}
