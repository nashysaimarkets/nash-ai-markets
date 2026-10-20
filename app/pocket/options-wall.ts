export type OptionsWallRow = { side: "CALL" | "PUT"; strike: number; volume: number; expiry: string };
export type OptionsWallRead = { symbol: string; readable: boolean; rows: OptionsWallRow[]; limitation: string };
export type OptionsWallMatch = OptionsWallRow & { level: { kind: string; price: number; label: string } };
export type OptionsWallResult = { status: "MATCHED" | "NO_OVERLAP" | "UNVERIFIED"; message: string; symbol: string; rows: OptionsWallRow[]; matches: OptionsWallMatch[] };

function validExpiry(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
function validRow(value: unknown): value is OptionsWallRow {
  if (!value || typeof value !== "object") return false;
  const row = value as OptionsWallRow;
  return (row.side === "CALL" || row.side === "PUT") && Number.isFinite(row.strike) && row.strike > 0 && Number.isSafeInteger(row.volume) && row.volume > 0 && validExpiry(row.expiry);
}
export function isOptionsWallResult(value: unknown, context?: Record<string, unknown>): value is OptionsWallResult {
  if (!value || typeof value !== "object") return false;
  const result = value as OptionsWallResult;
  const symbol = (v: string) => v.trim().toUpperCase().replace(/^[A-Z]+:/, "");
  return ["MATCHED", "NO_OVERLAP", "UNVERIFIED"].includes(result.status) && typeof result.message === "string" && typeof result.symbol === "string" &&
    (result.status === "UNVERIFIED" || !context || typeof context.ticker === "string" && symbol(result.symbol) === symbol(context.ticker)) &&
    Array.isArray(result.rows) && result.rows.length <= 8 && result.rows.every(validRow) && Array.isArray(result.matches) && result.matches.length <= 8 &&
    result.matches.every(match => validRow(match) && match.level && ["support", "resistance", "pivot"].includes(match.level.kind) && typeof match.level.label === "string" && Number.isFinite(match.level.price) && match.level.price > 0) &&
    (result.status === "MATCHED" ? result.matches.length > 0 : result.matches.length === 0);
}

export function crossCheckOptionsWall(read: OptionsWallRead, expectedTicker: string, levels: { kind: string; price: string; label: string }[]): OptionsWallResult {
  const empty = (message: string): OptionsWallResult => ({ status: "UNVERIFIED", message, symbol: read.symbol, rows: [], matches: [] });
  // An unknown or mismatched underlying is never allowed to annotate the chart.
  const symbol = (value: string) => value.trim().toUpperCase().replace(/^[A-Z]+:/, "");
  const expected = symbol(expectedTicker);
  if (!read.readable || !read.rows.length) return empty(read.limitation || "The strike and volume labels are not readable enough to compare.");
  if (!/^[A-Z][A-Z0-9.-]{0,14}$/.test(expected) || ["UNKNOWN", "UNCONFIRMED"].includes(expected) || !read.symbol || symbol(read.symbol) !== expected) {
    return empty("The options profile and chart cannot be confirmed as the same listed symbol.");
  }
  const verifiedLevels = levels.flatMap((level) => {
    const price = exactAxisPrice(level.price);
    return ["support", "resistance", "pivot"].includes(level.kind) && price !== null
      ? [{ kind: level.kind, price, label: level.label.slice(0, 50) }] : [];
  });
  if (!verifiedLevels.length) return empty("The price chart has no verified numeric structural level for this comparison.");
  const rows = read.rows.filter(validRow).slice(0, 8);
  if (!rows.length) return empty("A readable strike, expiry and traded-volume value are required.");
  const matches = rows.flatMap((row) => {
    // Relative tolerance handles plotted rounding; the absolute cap prevents a distant strike from being called nearby.
    const level = verifiedLevels.find((candidate) => Math.abs(candidate.price - row.strike) <= Math.min(candidate.price * 0.005, 5));
    return level ? [{ ...row, level }] : [];
  });
  return {
    status: matches.length ? "MATCHED" : "NO_OVERLAP",
    message: matches.length ? "Visible options volume overlaps a verified chart level. This is context, not a directional signal." : "No visible high-volume strike overlaps a verified chart level.",
    symbol: symbol(read.symbol), rows, matches,
  };
}
import { exactAxisPrice } from "./axis-verification.ts";
