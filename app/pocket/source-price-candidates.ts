import { exactAxisPrice } from "./axis-verification.ts";

export const SOURCE_PRICE_CANDIDATES_VERSION = "source-price-candidates-v1" as const;
export type CandidateInput = "MISSING" | "MALFORMED" | "EMPTY" | "PRESENT";
export type SourcePriceCandidate = {
  kind: "support" | "resistance";
  label: string;
  price: string;
  provenance: "UNVERIFIED";
};
export type SourcePriceCandidates = {
  version: typeof SOURCE_PRICE_CANDIDATES_VERSION;
  source: "PRIMARY";
  origin: "MAIN";
  provenance: "UNVERIFIED";
  levelInput: CandidateInput;
  axisInput: CandidateInput;
  levels: SourcePriceCandidate[];
  axisPrices: number[];
  rejectedLevels: number;
  rejectedAxisPrices: number;
};

const record = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
const label = (kind: SourcePriceCandidate["kind"]) => `Reported ${kind} candidate`;
function input(source: Record<string, unknown> | null, key: string, maximum: number) {
  if (!source || !Object.hasOwn(source, key)) return { state: "MISSING" as const, values: [] as unknown[], count: 0 };
  const value = source[key];
  if (!Array.isArray(value) || value.length > maximum) return { state: "MALFORMED" as const, values: [] as unknown[], count: Array.isArray(value) ? value.length : 0 };
  return { state: value.length ? "PRESENT" as const : "EMPTY" as const, values: value as unknown[], count: value.length };
}

/** Call on the completed MAIN response before geometry merging/calibration.
 * These are untrusted price hints, never drawable levels or verified absence.
 * Keep original price text; discard all model coordinates and authority labels.
 */
export function collectSourcePriceCandidates(value: unknown): SourcePriceCandidates {
  const source = record(value), rawLevels = input(source, "levels", 8), rawAxis = input(source, "priceScaleAnchors", 4);
  const selected = new Map<number, SourcePriceCandidate>(), conflicting = new Set<number>();
  for (const item of rawLevels.values) {
    const level = record(item);
    if (!level || (level.kind !== "support" && level.kind !== "resistance") || typeof level.price !== "string" || level.price.length > 30 ||
      (level.source !== undefined && level.source !== "PRIMARY") || (level.sourceRole !== undefined && level.sourceRole !== "PRIMARY")) continue;
    const price = exactAxisPrice(level.price);
    if (price === null || conflicting.has(price)) continue;
    const prior = selected.get(price);
    if (prior && prior.kind !== level.kind) { selected.delete(price); conflicting.add(price); continue; }
    if (!prior) selected.set(price, { kind: level.kind, label: label(level.kind), price: level.price, provenance: "UNVERIFIED" });
  }
  const levels = [...selected.values()];
  const axisPrices = [...new Set(rawAxis.values.flatMap(item => {
    const anchor = record(item);
    return anchor && typeof anchor.price === "number" && Number.isFinite(anchor.price) && anchor.price > 0 ? [anchor.price] : [];
  }))];
  return {
    version: SOURCE_PRICE_CANDIDATES_VERSION, source: "PRIMARY", origin: "MAIN", provenance: "UNVERIFIED",
    levelInput: rawLevels.state, axisInput: rawAxis.state, levels, axisPrices,
    rejectedLevels: rawLevels.count - levels.length, rejectedAxisPrices: rawAxis.count - axisPrices.length,
  };
}

/** Recheck this serialized side channel before using it for price projection.
 * An untrusted/empty record cannot grant geometry, semantics or absence credit.
 */
export function isSourcePriceCandidates(value: unknown): value is SourcePriceCandidates {
  const source = record(value);
  if (!source || source.version !== SOURCE_PRICE_CANDIDATES_VERSION || source.source !== "PRIMARY" || source.origin !== "MAIN" || source.provenance !== "UNVERIFIED") return false;
  const keys = ["version", "source", "origin", "provenance", "levelInput", "axisInput", "levels", "axisPrices", "rejectedLevels", "rejectedAxisPrices"];
  if (Object.keys(source).length !== keys.length || Object.keys(source).some(key => !keys.includes(key))) return false;
  const coherent = (state: unknown, count: number, rejected: unknown, maximum: number) => {
    if (!Number.isSafeInteger(rejected) || (rejected as number) < 0 || count > maximum) return false;
    if (state === "PRESENT") return count + (rejected as number) >= 1 && count + (rejected as number) <= maximum;
    if (state === "EMPTY" || state === "MISSING") return count === 0 && rejected === 0;
    return state === "MALFORMED" && count === 0;
  };
  if (!Array.isArray(source.levels) || !Array.isArray(source.axisPrices) ||
    !coherent(source.levelInput, source.levels.length, source.rejectedLevels, 8) ||
    !coherent(source.axisInput, source.axisPrices.length, source.rejectedAxisPrices, 4)) return false;
  const prices = new Set<number>();
  for (const item of source.levels) {
    const level = record(item);
    if (!level || Object.keys(level).length !== 4 || (level.kind !== "support" && level.kind !== "resistance") ||
      level.label !== label(level.kind) || level.provenance !== "UNVERIFIED" || typeof level.price !== "string" || level.price.length > 30) return false;
    const price = exactAxisPrice(level.price);
    if (price === null || prices.has(price)) return false;
    prices.add(price);
  }
  return source.axisPrices.every(price => typeof price === "number" && Number.isFinite(price) && price > 0) && new Set(source.axisPrices).size === source.axisPrices.length;
}
