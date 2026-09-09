import { readFileSync } from "node:fs";

const file = process.argv[2];
if (!file) throw new Error("Usage: node scripts/pocket-reliability-report.mjs /path/to/exported-runtime-log.txt");
const rows = readFileSync(file, "utf8").split("\n").flatMap((line) => {
  try {
    const value = JSON.parse(line.slice(line.indexOf("{")));
    if (value.event === "pocket_scan") return [value];
    if (typeof value.message === "string") { const nested = JSON.parse(value.message.slice(value.message.indexOf("{"))); return nested.event === "pocket_scan" ? [nested] : []; }
  } catch { /* Other log lines are not scan metrics. */ }
  return [];
});
const scans = [...new Map(rows.map((row) => [row.scanId, row])).values()];
const latencies = scans.map((row) => row.elapsedMs).filter(Number.isFinite).sort((a, b) => a - b);
const quantile = (p) => latencies.length ? latencies[Math.max(0, Math.ceil(latencies.length * p) - 1)] : null;
console.log(JSON.stringify({ scans: scans.length, completed: scans.filter((s) => s.outcome === "completed").length, inconclusive: scans.filter((s) => s.outcome === "inconclusive").length, failures: scans.filter((s) => s.outcome === "failed").length, completionRate: scans.length ? scans.filter((s) => s.outcome !== "failed").length / scans.length : null, medianMs: quantile(.5), p95Ms: quantile(.95), reportedInputTokens: scans.reduce((sum, s) => sum + s.inputTokens, 0), reportedOutputTokens: scans.reduce((sum, s) => sum + s.outputTokens, 0), note: "This describes the supplied log window. Completion is not trading accuracy. Missing-response usage and provider prices are needed for full costs." }, null, 2));
