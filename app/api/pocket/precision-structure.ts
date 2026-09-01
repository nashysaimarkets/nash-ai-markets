import { normalizePrecisionLiquidityShield, numericPrice } from "./liquidity-precision.ts";
import { canonicalizePocketGeometry } from "../../lib/pocket-geometry.ts";

type JsonRecord = Record<string, unknown>;

export type PrecisionSideCoverage = {
  currentPrice: number | null;
  supportBelow: boolean;
  resistanceAbove: boolean;
  exactHorizontalLevels: number;
  twoSided: boolean;
};

export type PrecisionProviderCallBudget = {
  deadlineAt: number;
  remainingCalls: number;
  signal?: AbortSignal;
};

export type PrecisionProviderCallReservation =
  | { allowed: true; timeoutMs: number; remainingCalls: number }
  | { allowed: false; reason: "CALL_BUDGET" | "TIME_BUDGET" | "REQUEST_ABORTED"; remainingCalls: number };

export type ContextCompatibility = {
  compatible: boolean;
  reason: "NO_CONTEXT" | "IDENTITY_MISSING" | "IDENTITY_MISMATCH" | "PRICE_MISMATCH" | "EXPLICIT_MATCH" | "REPORT_AND_PRICE_MATCH" | "NOT_CONFIRMED";
};

export type CombinedBattlefieldLevel = {
  kind: "support" | "resistance" | "pivot";
  label: string;
  price: string;
  source: "PRIMARY" | "CONTEXT" | "USER_VERIFIED";
};

export type UserVerifiedStructuralLevel = {
  kind: "support" | "resistance";
  price: string;
};

const levelTolerance = (price: number) => Math.max(Math.abs(price) * 0.0015, 0.01);

/** Atomically reserves one bounded precision-provider call. */
export function reservePrecisionProviderCall(
  budget: PrecisionProviderCallBudget,
  now: number,
  minimumRemainingMs: number,
): PrecisionProviderCallReservation {
  if (budget.signal?.aborted) {
    return { allowed: false, reason: "REQUEST_ABORTED", remainingCalls: budget.remainingCalls };
  }
  if (budget.remainingCalls <= 0) return { allowed: false, reason: "CALL_BUDGET", remainingCalls: 0 };
  const remainingMs = Math.max(0, Math.floor(budget.deadlineAt - now));
  if (remainingMs < minimumRemainingMs) {
    return { allowed: false, reason: "TIME_BUDGET", remainingCalls: budget.remainingCalls };
  }
  budget.remainingCalls -= 1;
  return { allowed: true, timeoutMs: Math.max(1, remainingMs), remainingCalls: budget.remainingCalls };
}

/** Operational diagnostics intentionally exclude exact chart prices. */
export function precisionCoverageDiagnostics(coverage: PrecisionSideCoverage) {
  return {
    supportBelow: coverage.supportBelow,
    resistanceAbove: coverage.resistanceAbove,
    exactHorizontalLevels: coverage.exactHorizontalLevels,
    twoSided: coverage.twoSided,
  };
}

function records(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is JsonRecord => Boolean(item && typeof item === "object")) : [];
}

const UNKNOWN_IDENTITIES = new Set(["", "UNKNOWN", "UNREADABLE", "NOTVISIBLE", "NOTPROVIDED", "NA", "NONE"]);

/** Normalize only display noise; do not equate merely correlated instruments. */
export function normalizeInstrumentIdentifier(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    // Mobile headers are often cropped midway through the trailing DFB tag.
    // Treat only that known terminal qualifier as display noise.
    .replace(/\(\s*D(?:F(?:B)?)?\s*$/g, " ")
    .replace(/\([^)]{0,12}$/, " ")
    .replace(/\((?:24\s*HOURS?|DFB|CASH|ROLLING)\)/g, " ")
    .replace(/\b(?:24\s*HOURS?|DFB|CASH|ROLLING|CHART)\b/g, " ")
    .replace(/\b(?:INCORPORATED|INC|CORPORATION|CORP|PLC|LTD|LIMITED)\b/g, " ")
    .replace(/[^A-Z0-9]+/g, "");
  return UNKNOWN_IDENTITIES.has(normalized) ? null : normalized;
}

/** Keep the complete visible title only when the independent precision read is high confidence. */
export function verifiedPrecisionInstrumentIdentifier(value: unknown, confidence: unknown) {
  if (confidence !== "HIGH" || typeof value !== "string") return null;
  const candidate = value.trim().slice(0, 80);
  return normalizeInstrumentIdentifier(candidate) ? candidate : null;
}

function normalizedInstrumentSet(value: unknown): Set<string> {
  const candidates = Array.isArray(value) ? value : [value];
  return new Set(candidates.flatMap((candidate) => {
    const normalized = normalizeInstrumentIdentifier(candidate);
    return normalized ? [normalized] : [];
  }));
}

export function instrumentIdentitiesMatch(primaryValue: unknown, contextValue: unknown) {
  const primary = normalizedInstrumentSet(primaryValue);
  const context = normalizedInstrumentSet(contextValue);
  if (!primary.size || !context.size) return null;
  return [...primary].some((identity) => context.has(identity));
}

export function contextBattlefieldFromPrecision(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const precision = value as JsonRecord;
  const exactCurrentPrice = numericPrice(precision.currentPrice);
  return {
    levels: Array.isArray(precision.levels) ? precision.levels : [],
    instrumentIdentifier: verifiedPrecisionInstrumentIdentifier(precision.instrumentIdentifier, precision.confidence) ?? "",
    currentPrice: exactCurrentPrice === null ? "" : typeof precision.currentPrice === "string" ? precision.currentPrice : String(exactCurrentPrice),
    priceScaleAnchors: Array.isArray(precision.priceScaleAnchors) ? precision.priceScaleAnchors : [],
    plotBounds: precision.plotBounds && typeof precision.plotBounds === "object" ? precision.plotBounds : undefined,
  };
}

function exactLevels(value: unknown, currentPrice: number | null) {
  return records(value).flatMap((level) => {
    const price = numericPrice(level.price);
    const rawKind = String(level.kind);
    const userVerified = level.source === "USER_VERIFIED";
    if (price === null || price <= 0 || !["support", "resistance", "pivot"].includes(rawKind)) return [];
    if (!userVerified && currentPrice !== null && Math.abs(price - currentPrice) / Math.max(Math.abs(currentPrice), 1) > 0.2) return [];
    if (rawKind !== "pivot" && currentPrice !== null && Math.abs(price - currentPrice) <= Math.max(Math.abs(currentPrice) * .00015, .01)) return [];
    const kind = userVerified || rawKind === "pivot" || currentPrice === null
      ? rawKind
      : price < currentPrice
        ? "support"
        : price > currentPrice
          ? "resistance"
          : rawKind;
    return [{
      kind: kind as CombinedBattlefieldLevel["kind"],
      label: typeof level.label === "string" ? level.label : "Verified chart structure",
      price: typeof level.price === "string" ? level.price : String(price),
      numericPrice: price,
      source: userVerified ? "USER_VERIFIED" as const : undefined,
    }];
  });
}

/**
 * Bind exactly one trader correction after model geometry calibration. A
 * corrected price is list/ladder evidence unless identical verified geometry
 * already exists; no synthetic chart row is created.
 */
export function bindUserVerifiedStructuralLevel(value: unknown, correction: UserVerifiedStructuralLevel | null) {
  const levels = records(value);
  if (!correction) return levels;
  const price = numericPrice(correction.price);
  if (price === null || price <= 0) return levels;
  const exactGeometry = levels.find((level) =>
    ["support", "resistance"].includes(String(level.kind))
    && numericPrice(level.price) === price
    && [level.x, level.y, level.x2, level.y2].every((coordinate) => typeof coordinate === "number" && Number.isFinite(coordinate)),
  );
  const coordinates = exactGeometry
    ? { x: exactGeometry.x, y: exactGeometry.y, x2: exactGeometry.x2, y2: exactGeometry.y2 }
    : { x: null, y: null, x2: null, y2: null };
  const verified = {
    kind: correction.kind,
    label: `USER VERIFIED ${correction.kind.toUpperCase()}`,
    price: correction.price,
    source: "USER_VERIFIED" as const,
    ...coordinates,
  };
  const remaining = levels.filter((level) => {
    if (!["support", "resistance"].includes(String(level.kind))) return true;
    const candidatePrice = numericPrice(level.price);
    return candidatePrice === null || Math.abs(candidatePrice - price) > levelTolerance(price);
  });
  return [verified, ...remaining];
}

/** Pivots and levels equal to current price never satisfy two-sided coverage. */
export function structuralSideCoverage(levels: unknown, currentPriceValue: unknown): PrecisionSideCoverage {
  const currentPrice = numericPrice(currentPriceValue);
  const exact = exactLevels(levels, currentPrice).filter((level) => level.kind !== "pivot");
  const supportBelow = currentPrice !== null && exact.some((level) => level.kind === "support" && level.numericPrice < currentPrice);
  const resistanceAbove = currentPrice !== null && exact.some((level) => level.kind === "resistance" && level.numericPrice > currentPrice);
  return {
    currentPrice,
    supportBelow,
    resistanceAbove,
    exactHorizontalLevels: exact.length,
    twoSided: supportBelow && resistanceAbove,
  };
}

/** A raw two-sided claim is useful only when both rows survive the same scale checks as calibration. */
export function hasViablePrecisionGeometry(value: JsonRecord, trustedCurrentPrice: unknown = null) {
  const normalized = canonicalizePocketGeometry(value) as JsonRecord;
  const bounds = normalized.plotBounds && typeof normalized.plotBounds === "object" ? normalized.plotBounds as JsonRecord : null;
  const left = numericPrice(bounds?.left);
  const top = numericPrice(bounds?.top);
  const right = numericPrice(bounds?.right);
  const bottom = numericPrice(bounds?.bottom);
  if (left === null || top === null || right === null || bottom === null
    || left < 0 || top < 0 || right > 100 || bottom > 100 || right <= left || bottom <= top) return false;
  const anchors = records(normalized.priceScaleAnchors).flatMap((anchor) => {
    const price = numericPrice(anchor.price);
    const y = numericPrice(anchor.y);
    return price !== null && price > 0 && y !== null && y >= top && y <= bottom ? [{ price, y }] : [];
  });
  const unique = anchors.filter((anchor, index, all) =>
    all.findIndex((candidate) => candidate.price === anchor.price || candidate.y === anchor.y) === index,
  );
  if (unique.length < 2) return false;
  const ordered = [...unique].sort((a, b) => a.price - b.price);
  if (!ordered.every((anchor, index) => index === 0 || anchor.y < ordered[index - 1].y)) return false;
  const low = ordered[0];
  const high = ordered.at(-1)!;
  if (high.price === low.price || Math.abs(high.y - low.y) < (ordered.length === 2 ? 20 : 12)) return false;
  const project = (price: number) => low.y + ((price - low.price) / (high.price - low.price)) * (high.y - low.y);
  if (ordered.length >= 3 && ordered.some((anchor) => Math.abs(project(anchor.price) - anchor.y) > 2.5)) return false;
  const currentPrice = numericPrice(trustedCurrentPrice ?? normalized.currentPrice);
  if (currentPrice === null || currentPrice <= 0) return false;
  const currentY = project(currentPrice);
  if (currentY < top || currentY > bottom) return false;
  const rowTolerance = Math.max(4.5, (bottom - top) * .09);
  const sideTolerance = Math.max(Math.abs(currentPrice) * .00015, .01);
  const rows = records(normalized.levels).flatMap((level) => {
    const price = numericPrice(level.price);
    const y = numericPrice(level.y);
    if (price === null || price <= 0 || y === null || !["support", "resistance"].includes(String(level.kind))) return [];
    const projectedY = project(price);
    if (projectedY < top || projectedY > bottom || Math.abs(y - projectedY) > rowTolerance) return [];
    if (price < currentPrice - sideTolerance) return ["support" as const];
    if (price > currentPrice + sideTolerance) return ["resistance" as const];
    return [];
  });
  return rows.includes("support") && rows.includes("resistance");
}

export function precisionRescueReasons(value: JsonRecord | null, trustedCurrentPrice: unknown = null) {
  if (!value) return ["UNUSABLE_OUTPUT"];
  const coverage = structuralSideCoverage(value.levels, trustedCurrentPrice ?? value.currentPrice);
  const shield = value.liquidityShield && typeof value.liquidityShield === "object" ? value.liquidityShield as JsonRecord : null;
  const rawLiquidityIncomplete = !shield
    || shield.status === "INSUFFICIENT_EVIDENCE"
    || (shield.status === "VISIBLE_RISK_ZONES" && (!Array.isArray(shield.zones) || shield.zones.length === 0));
  const geometryViable = coverage.twoSided && hasViablePrecisionGeometry(value, trustedCurrentPrice);
  const normalizedShield = normalizePrecisionLiquidityShield(value, typeof trustedCurrentPrice === "string" ? trustedCurrentPrice : null);
  const liquidityUnusable = geometryViable
    && !rawLiquidityIncomplete
    && shield?.status !== "INSUFFICIENT_EVIDENCE"
    && normalizedShield.status === "INSUFFICIENT_EVIDENCE";
  return [
    !Array.isArray(value.levels) || value.levels.length === 0 ? "NO_LEVELS" : "",
    !coverage.twoSided ? "MISSING_STRUCTURAL_SIDE" : "",
    coverage.twoSided && !geometryViable ? "GEOMETRY_UNUSABLE" : "",
    rawLiquidityIncomplete ? "LIQUIDITY_INCOMPLETE" : "",
    liquidityUnusable ? "LIQUIDITY_UNUSABLE" : "",
  ].filter(Boolean);
}

export function rescueShouldLeadGeometry(reasons: string[]) {
  return reasons.some((reason) => ["UNUSABLE_OUTPUT", "NO_LEVELS", "MISSING_STRUCTURAL_SIDE", "GEOMETRY_UNUSABLE"].includes(reason));
}

function pricesCompatible(primaryCurrentPrice: unknown, contextCurrentPrice: unknown) {
  const primary = numericPrice(primaryCurrentPrice);
  const context = numericPrice(contextCurrentPrice);
  if (primary === null || context === null) return null;
  const denominator = Math.max(Math.abs(primary), Math.abs(context), 1);
  return Math.abs(primary - context) / denominator <= 0.05;
}

/** Context is merged only after an explicit match or independent report + price agreement. */
export function confirmContextCompatibility(
  report: JsonRecord,
  explicitMatch: boolean,
  primaryCurrentPrice: unknown,
  contextCurrentPrice: unknown,
  hasContext: boolean,
  primaryInstrumentIdentifiers: unknown,
  contextInstrumentIdentifiers: unknown,
): ContextCompatibility {
  if (!hasContext) return { compatible: false, reason: "NO_CONTEXT" };
  const higher = report.higherTimeframe && typeof report.higherTimeframe === "object" ? report.higherTimeframe as JsonRecord : null;
  const contribution = report.contextContribution && typeof report.contextContribution === "object" ? report.contextContribution as JsonRecord : null;
  const alignment = String(higher?.alignment ?? "NOT_PROVIDED");
  if (alignment === "CONFLICTING") return { compatible: false, reason: "NOT_CONFIRMED" };
  const identityMatch = instrumentIdentitiesMatch(primaryInstrumentIdentifiers, contextInstrumentIdentifiers);
  if (identityMatch === null) return { compatible: false, reason: "IDENTITY_MISSING" };
  if (!identityMatch) return { compatible: false, reason: "IDENTITY_MISMATCH" };
  const priceMatch = pricesCompatible(primaryCurrentPrice, contextCurrentPrice);
  if (priceMatch === false) return { compatible: false, reason: "PRICE_MISMATCH" };
  const reportMatch = higher?.provided === true
    && contribution?.used === true
    && ["ALIGNED", "MIXED"].includes(alignment);
  // The current client confirmation flag says that a context image was
  // supplied; it is not, by itself, proof that both images match. Require a
  // compatible visible price or the independent two-chart report as well.
  if (explicitMatch && (priceMatch === true || (priceMatch === null && reportMatch))) {
    return { compatible: true, reason: "EXPLICIT_MATCH" };
  }
  return reportMatch && priceMatch === true
    ? { compatible: true, reason: "REPORT_AND_PRICE_MATCH" }
    : { compatible: false, reason: "NOT_CONFIRMED" };
}

export function combineVerifiedBattlefield(
  primaryLevels: unknown,
  contextLevels: unknown,
  primaryCurrentPrice: unknown,
  compatibility: ContextCompatibility,
) {
  type InternalLevel = CombinedBattlefieldLevel & { numericPrice: number };
  const currentPrice = numericPrice(primaryCurrentPrice);
  const primary: InternalLevel[] = exactLevels(primaryLevels, currentPrice).map((level) => ({ ...level, source: level.source ?? "PRIMARY" }));
  const context: InternalLevel[] = compatibility.compatible
    ? exactLevels(contextLevels, currentPrice).map((level) => ({ ...level, source: "CONTEXT" }))
    : [];
  const combined = [...primary, ...context].reduce<InternalLevel[]>((levels, candidate) => {
    const duplicate = levels.findIndex((level) => level.kind === candidate.kind && Math.abs(level.numericPrice - candidate.numericPrice) <= levelTolerance(candidate.numericPrice));
    if (duplicate < 0) return [...levels, candidate];
    if (candidate.source === "USER_VERIFIED" && levels[duplicate].source !== "USER_VERIFIED") {
      return levels.map((level, index) => index === duplicate ? candidate : level);
    }
    return levels;
  }, []);
  const publicLevels: CombinedBattlefieldLevel[] = combined.map(({ kind, label, price, source }) => ({ kind, label, price, source }));
  return {
    currentPrice: typeof primaryCurrentPrice === "string" ? primaryCurrentPrice : currentPrice === null ? "" : String(currentPrice),
    levels: publicLevels,
    contextCompatible: compatibility.compatible,
    compatibilityReason: compatibility.reason,
    coverage: structuralSideCoverage(publicLevels, currentPrice),
  };
}

export function trustGateForCombinedBattlefield(existingValue: unknown, combined: ReturnType<typeof combineVerifiedBattlefield>) {
  const existing = existingValue && typeof existingValue === "object" ? existingValue as JsonRecord : {};
  const reasons = Array.isArray(existing.reasons) ? existing.reasons.filter((item): item is string => typeof item === "string") : [];
  const chartLocked = existing.chartLocked === true;
  const identityLocked = existing.identityLocked === true;
  const { supportBelow, resistanceAbove, exactHorizontalLevels, twoSided } = combined.coverage;
  const status = chartLocked && identityLocked && twoSided
    ? "LOCKED"
    : !chartLocked || !identityLocked || exactHorizontalLevels === 0
      ? "HOLD"
      : "PARTIAL";
  const structuralReason = twoSided
    ? `${exactHorizontalLevels} exact horizontal levels bracket current price`
    : supportBelow
      ? "Exact support is verified; resistance above price is not verified"
      : resistanceAbove
        ? "Exact resistance is verified; support below price is not verified"
        : "No exact support/resistance pair brackets current price";
  const nextAction = status === "LOCKED"
    ? "Verify the marked prices on the original chart before acting."
    : !identityLocked
      ? "Confirm the instrument, timeframe and current price, then reanalyse."
      : supportBelow
        ? "Use only a chart view that clearly shows the next resistance above current price."
        : resistanceAbove
          ? "Use only a chart view that clearly shows the next support below current price."
          : "Use a chart with a readable price scale and visible structure on both sides of current price.";
  return {
    ...existing,
    status,
    chartLocked,
    identityLocked,
    scaleLocked: twoSided,
    exactLevelCount: exactHorizontalLevels,
    reasons: [
      reasons[0] ?? (chartLocked ? "Candles and structure are readable" : "Chart readability is incomplete"),
      reasons[1] ?? (identityLocked ? "Instrument and timeframe are verified" : "Instrument or timeframe needs confirmation"),
      structuralReason,
      ...(reasons[3] ? [reasons[3]] : []),
    ],
    nextAction,
  };
}

export function hasReusableTwoSidedStructure(value: unknown) {
  if (!value || typeof value !== "object") return false;
  const report = value as JsonRecord;
  const combined = report.combinedBattlefield && typeof report.combinedBattlefield === "object"
    ? report.combinedBattlefield as JsonRecord
    : null;
  const coverage = combined?.coverage && typeof combined.coverage === "object" ? combined.coverage as JsonRecord : null;
  if (coverage?.twoSided === true) return true;
  return structuralSideCoverage(report.levels, report.currentPrice).twoSided;
}

export function precisionGeometryDiagnostics(value: JsonRecord | null) {
  if (!value) return { present: false, anchorCount: 0, levelCount: 0, coverage: precisionCoverageDiagnostics(structuralSideCoverage([], null)) };
  return {
    present: true,
    anchorCount: Array.isArray(value.priceScaleAnchors) ? value.priceScaleAnchors.length : 0,
    levelCount: Array.isArray(value.levels) ? value.levels.length : 0,
    coverage: precisionCoverageDiagnostics(structuralSideCoverage(value.levels, value.currentPrice)),
  };
}
