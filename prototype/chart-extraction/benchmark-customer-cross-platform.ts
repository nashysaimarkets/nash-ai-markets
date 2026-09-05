import { readFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";
import sources from "./cross-platform-sources.json" with { type: "json" };
import { measureChartPixels } from "../../app/pocket/browser-chart-extractor.ts";

const directory = process.argv[2];
if (!directory) throw new Error("Pass the cross-platform fixture directory.");
const rows = [];
for (const source of sources) {
  const bytes = await readFile(join(directory, source.file));
  const metadata = await sharp(bytes).metadata();
  const width = Math.max(1, Math.round((metadata.width ?? 1) * Math.min(1, 900 / Math.max(metadata.width ?? 1, metadata.height ?? 1))));
  const decoded = await sharp(bytes).resize({ width }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const rgba = new Uint8ClampedArray(decoded.info.width * decoded.info.height * 4);
  for (let from = 0, to = 0; from < decoded.data.length; from += decoded.info.channels, to += 4) {
    rgba[to] = decoded.data[from] ?? 0; rgba[to + 1] = decoded.data[from + 1] ?? 0; rgba[to + 2] = decoded.data[from + 2] ?? 0; rgba[to + 3] = 255;
  }
  const image = { data: rgba, width: decoded.info.width, height: decoded.info.height };
  const result = measureChartPixels(image, source.volumeProfile ? "INDICATOR_VOLUME" : "PRIMARY");
  const indicatorResult = source.volumeProfile ? result : measureChartPixels(image, "INDICATOR_VOLUME");
  rows.push({ platform: source.platform, file: source.file, excluded: "excludeFromAccuracy" in source && source.excludeFromAccuracy === true, chart: result.chartStatus === "chart-detected", candles: result.candles.count >= 8, profileExpected: source.volumeProfile, profileDetected: result.volumeProfile.status === "visible", profileConfidence: result.volumeProfile.confidence, indicatorFalsePositive: !source.volumeProfile && indicatorResult.volumeProfile.status === "visible", indicatorConfidence: indicatorResult.volumeProfile.confidence, levels: result.levels.length });
}
const scored = rows.filter((row) => !row.excluded);
const charts = scored.filter((row) => !row.profileExpected);
const profiles = scored.filter((row) => row.profileExpected);
console.log(JSON.stringify({
  engine: "customer-browser-cv-v1",
  chartRecognition: { passed: charts.filter((row) => row.chart && row.candles).length, total: charts.length },
  volumeProfile: { truePositive: profiles.filter((row) => row.profileDetected).length, positives: profiles.length, falsePositive: charts.filter((row) => row.profileDetected).length, indicatorSlotFalsePositive: charts.filter((row) => row.indicatorFalsePositive).length, negatives: charts.length },
  rows,
}, null, 2));
