import { readFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";
import manifest from "./ig-development-manifest.json" with { type: "json" };
import { measureChartPixels } from "../../app/pocket/browser-chart-extractor.ts";

const directory = process.argv[2];
if (!directory) {
  console.error("Usage: node --import tsx prototype/chart-extraction/benchmark-customer-engine.ts <image-directory>");
  process.exit(2);
}

type CustomerBenchmarkRow = { file: string; chart: boolean; candles: boolean; repeatable: boolean; noFabrication: boolean; levelCount: number; volumeProfile: string };
const rows: CustomerBenchmarkRow[] = [];
for (const expected of manifest) {
  const bytes = await readFile(join(directory, expected.file));
  const metadata = await sharp(bytes).metadata();
  const width = Math.max(1, Math.round((metadata.width ?? 1) * Math.min(1, 900 / Math.max(metadata.width ?? 1, metadata.height ?? 1))));
  const decoded = await sharp(bytes).resize({ width }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const rgba = new Uint8ClampedArray(decoded.info.width * decoded.info.height * 4);
  for (let source = 0, target = 0; source < decoded.data.length; source += decoded.info.channels, target += 4) {
    rgba[target] = decoded.data[source] ?? 0; rgba[target + 1] = decoded.data[source + 1] ?? 0; rgba[target + 2] = decoded.data[source + 2] ?? 0; rgba[target + 3] = 255;
  }
  const image = { data: rgba, width: decoded.info.width, height: decoded.info.height };
  const first = measureChartPixels(image, "PRIMARY");
  const second = measureChartPixels(image, "PRIMARY");
  rows.push({
    file: expected.file,
    chart: first.chartStatus === "chart-detected",
    candles: first.candles.count >= 8,
    repeatable: JSON.stringify(first) === JSON.stringify(second),
    noFabrication: first.levels.every((level) => !("price" in level)),
    levelCount: first.levels.length,
    volumeProfile: first.volumeProfile.status,
  });
}

const metric = (key: "chart" | "candles" | "repeatable" | "noFabrication") => {
  const passed = rows.filter((row) => row[key]).length;
  return { passed, total: rows.length, percent: Number((100 * passed / rows.length).toFixed(1)) };
};
console.log(JSON.stringify({
  engine: "customer-browser-cv-v1",
  metrics: { chartRecognition: metric("chart"), candleRead: metric("candles"), repeatability: metric("repeatable"), noFabrication: metric("noFabrication") },
  failures: rows.filter((row) => !row.chart || !row.candles || !row.repeatable || !row.noFabrication),
  rows,
}, null, 2));
