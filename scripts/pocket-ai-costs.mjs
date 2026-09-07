import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const nonnegative = value => typeof value === "number" && Number.isFinite(value) && value >= 0;
const tokens = value => nonnegative(value) && Number.isSafeInteger(value);

// Input is sanitized pocket_ai_usage records, one JSON object per line.
// Rates must match the actual model and returned service tier; no guessed aliases.
export function summarizePocketCosts(records, rates, completedScans = null) {
  if (!rates || !/^[A-Z]{3}$/.test(rates.currency) || !Array.isArray(rates.prices)) {
    throw new Error("Supply a currency and verified prices for exact model/serviceTier pairs.");
  }
  if (completedScans !== null && (!Number.isSafeInteger(completedScans) || completedScans <= 0)) {
    throw new Error("Completed scans must be a measured positive integer, or omitted.");
  }
  const prices = new Map();
  for (const rate of rates.prices) {
    if (!rate.model || !rate.serviceTier || ![rate.inputPerMillion, rate.cachedInputPerMillion, rate.outputPerMillion].every(nonnegative)) {
      throw new Error("Each rate needs exact model/serviceTier identifiers and nonnegative token prices.");
    }
    const key = JSON.stringify([rate.model, rate.serviceTier]);
    if (prices.has(key)) throw new Error("Duplicate model/serviceTier rate.");
    prices.set(key, rate);
  }
  const seen = new Map();
  const byOperation = {};
  let duplicates = 0;
  let unknownCalls = 0;
  let calls = 0;
  let knownTokenCost = 0;
  for (const row of records) {
    if (!row || row.event !== "pocket_ai_usage") throw new Error("Input must contain only pocket_ai_usage records.");
    const signature = JSON.stringify([row.model, row.serviceTier, row.operation, row.status, row.inputTokens, row.cachedInputTokens, row.outputTokens]);
    if (row.responseId && seen.has(row.responseId)) {
      if (seen.get(row.responseId) !== signature) throw new Error("Conflicting records for the same provider response.");
      duplicates++;
      continue;
    }
    if (row.responseId) seen.set(row.responseId, signature);
    const rate = prices.get(JSON.stringify([row.model, row.serviceTier]));
    const hasUsage = [row.inputTokens, row.cachedInputTokens, row.outputTokens].every(tokens) && row.cachedInputTokens <= row.inputTokens;
    const cost = hasUsage && rate
      ? ((row.inputTokens - row.cachedInputTokens) * rate.inputPerMillion + row.cachedInputTokens * rate.cachedInputPerMillion + row.outputTokens * rate.outputPerMillion) / 1e6
      : null;
    // Null IDs (for failed calls) are separate attempts, never deduplicated.
    const key = typeof row.operation === "string" && /^[a-z-]+$/.test(row.operation) ? row.operation : "unknown";
    const group = Object.hasOwn(byOperation, key) ? byOperation[key] : (byOperation[key] = { calls: 0, unknownCalls: 0, knownTokenCost: 0 });
    calls++;
    group.calls++;
    if (cost === null) { unknownCalls++; group.unknownCalls++; }
    else { knownTokenCost += cost; group.knownTokenCost += cost; }
  }
  const complete = calls > 0 && unknownCalls === 0;
  return { currency: rates.currency, calls, duplicates, unknownCalls, knownTokenCost, complete,
    completedScans, tokenCostPerCompletedScan: complete && completedScans !== null ? knownTokenCost / completedScans : null,
    byOperation };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [, , logPath, ratesPath, completed] = process.argv;
  if (!logPath || !ratesPath) throw new Error("Usage: node scripts/pocket-ai-costs.mjs usage.ndjson verified-rates.json [completed-scans]");
  const records = readFileSync(logPath, "utf8").split(/\r?\n/).filter(line => line.trim()).map(line => JSON.parse(line));
  const result = summarizePocketCosts(records, JSON.parse(readFileSync(ratesPath, "utf8")), completed === undefined ? null : Number(completed));
  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
}
