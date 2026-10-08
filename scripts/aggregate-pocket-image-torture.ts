import { readFile } from "node:fs/promises";
import { aggregateSeparateTortureReports } from "../tests/support/pocket-image-torture.ts";

/**
 * Offline only. Accept JSON files containing one or more responses from the
 * protected /api/pocket/torture?run=1&case=<id> endpoint.
 *
 * Usage:
 * node --import tsx scripts/aggregate-pocket-image-torture.ts results/*.json
 *
 * Never calls the AI provider or a preview endpoint.
 */
const paths = process.argv.slice(2);
if (!paths.length) throw new Error("Supply one or more saved single-case JSON report files");
const reports: unknown[] = [];
for (const path of paths) {
  const parsed: unknown = JSON.parse(await readFile(path, "utf8"));
  if (Array.isArray(parsed)) reports.push(...parsed);
  else reports.push(parsed);
}
const summary = aggregateSeparateTortureReports(reports);
console.log("POCKET_IMAGE_TORTURE_AGGREGATE", JSON.stringify(summary));
if (!summary.measurementComplete) process.exitCode = 2;
