import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join } from "node:path";
import sharp from "sharp";
import manifest from "./ig-development-manifest.json" with { type: "json" };
import { measureChartPixels } from "../../app/pocket/browser-chart-extractor.ts";

const directory = process.argv[2];
if (!directory) {
  console.error("Usage: node --import tsx prototype/chart-extraction/benchmark-customer-engine.ts <image-directory>");
  process.exit(2);
}

const cases: Array<{ file: string; sha256: string; instrument: string; timeframe: string }> = process.argv[3] ? JSON.parse(await readFile(process.argv[3], "utf8")).cases : manifest;
if (!Array.isArray(cases) || !cases.length) throw new Error("No registered screenshots.");
type CustomerBenchmarkRow = { file: string; chart: boolean; candles: boolean; repeatable: boolean; noFabrication: boolean; levelCount: number; volumeProfile: string; measurementMs: number };
const rows: CustomerBenchmarkRow[] = [];
for (const expected of cases) {
  if (!/^[A-Za-z0-9_().-]+$/.test(expected.file)) throw new Error("Invalid fixture filename.");
  const bytes = await readFile(join(directory, expected.file));
  if (createHash("sha256").update(bytes).digest("hex") !== expected.sha256) throw new Error(`${expected.file}: registered image bytes changed`);
  const metadata = await sharp(bytes).metadata();
  const width = Math.max(1, Math.round((metadata.width ?? 1) * Math.min(1, 900 / Math.max(metadata.width ?? 1, metadata.height ?? 1))));
  const decoded = await sharp(bytes).resize({ width }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const rgba = new Uint8ClampedArray(decoded.info.width * decoded.info.height * 4);
  for (let source = 0, target = 0; source < decoded.data.length; source += decoded.info.channels, target += 4) {
    rgba[target] = decoded.data[source] ?? 0; rgba[target + 1] = decoded.data[source + 1] ?? 0; rgba[target + 2] = decoded.data[source + 2] ?? 0; rgba[target + 3] = 255;
  }
  const image = { data: rgba, width: decoded.info.width, height: decoded.info.height };
  const startedAt = performance.now();
  const first = measureChartPixels(image, "PRIMARY");
  const measurementMs = Math.round((performance.now() - startedAt) * 100) / 100;
  const second = measureChartPixels(image, "PRIMARY");
  rows.push({
    file: expected.file,
    chart: first.chartStatus === "chart-detected",
    candles: first.candles.count >= 8,
    repeatable: JSON.stringify(first) === JSON.stringify(second),
    noFabrication: first.levels.every((level) => !("price" in level)),
    levelCount: first.levels.length,
    volumeProfile: first.volumeProfile.status,
    measurementMs,
  });
}

const metric = (key: "chart" | "candles" | "repeatable" | "noFabrication") => {
  const passed = rows.filter((row) => row[key]).length;
  return { passed, total: rows.length, percent: Number((100 * passed / rows.length).toFixed(1)) };
};
console.log(JSON.stringify({
  engine: "customer-browser-cv-v1",
  scope: "Pixel measurement only. Candle detection means at least eight detected candles, not candle-location accuracy. noFabrication checks that this stage emits no exact price field; it does not evaluate AI prices, OCR, pattern accuracy or support/resistance recall.",
  sourceTimeframes: [...new Set(cases.map((row) => row.timeframe))],
  timing: { runtime: "local Node; excludes image decode, upload and AI", medianMs: [...rows].sort((a,b) => a.measurementMs-b.measurementMs)[Math.ceil(rows.length*.5)-1].measurementMs, p90Ms: [...rows].sort((a,b) => a.measurementMs-b.measurementMs)[Math.ceil(rows.length*.9)-1].measurementMs },
  metrics: { chartRecognition: metric("chart"), candleRead: metric("candles"), repeatability: metric("repeatable"), noFabrication: metric("noFabrication") },
  failures: rows.filter((row) => !row.chart || !row.candles || !row.repeatable || !row.noFabrication),
  rows,
}, null, 2));
