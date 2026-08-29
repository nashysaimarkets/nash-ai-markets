import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { generateSecondOpinion } from "../app/lib/server/second-opinion.ts";
import {
  assertPocketGolden,
  assertPocketReleaseGate,
  summarizePocketBenchmark,
  validatePocketGoldenCase,
  type PocketGoldenCase,
} from "../tests/support/pocket-golden-regression.ts";

type Manifest = { schemaVersion: 2; releaseGate: { minimumCharts: number }; cases: unknown[] };

const fixtureDirectory = new URL("../tests/fixtures/pocket-golden/", import.meta.url);
const manifest = JSON.parse(await readFile(new URL("manifest.json", fixtureDirectory), "utf8")) as Manifest;
if (manifest.schemaVersion !== 2 || !manifest.releaseGate || !Array.isArray(manifest.cases)) throw new Error("Unsupported Pocket golden manifest.");

if (manifest.cases.length === 0) {
  console.log(`Pocket benchmark intake ready: 0/${manifest.releaseGate.minimumCharts} privacy-approved charts.`);
  process.exit(process.env.POCKET_GOLDEN_RELEASE_GATE === "1" ? 1 : 0);
}

const mimeFor = (file: string) => {
  const extension = extname(file).toLowerCase();
  if (extension === ".png") return "image/png";
  if (extension === ".webp") return "image/webp";
  if (extension === ".jpg" || extension === ".jpeg") return "image/jpeg";
  throw new Error(`Unsupported golden image extension: ${extension}`);
};

let passed = 0;
const results: Array<{ golden: PocketGoldenCase; actual: Parameters<typeof assertPocketGolden>[1] }> = [];
for (const rawCase of manifest.cases) {
  validatePocketGoldenCase(rawCase);
  const golden = rawCase as PocketGoldenCase;
  const imagePath = join(fixtureDirectory.pathname, golden.imageFile);
  const image = await readFile(imagePath);
  const sha256 = createHash("sha256").update(image).digest("hex");
  if (sha256 !== golden.imageSha256) throw new Error(`${golden.id}: image changed after privacy approval`);

  const result = await generateSecondOpinion({
    market: golden.market,
    timeframe: golden.timeframe,
    currentPrice: null,
    direction: "neutral",
    entry: null,
    stop: null,
    target: null,
    stake: "",
    emotion: "",
    thesis: "Golden regression: evaluate only visible chart structure.",
    imageDataUrl: `data:${mimeFor(golden.imageFile)};base64,${image.toString("base64")}`,
  });
  if (result.status !== "generated") throw new Error(`${golden.id}: scanner returned ${result.status}`);
  assertPocketGolden(golden, result.content);
  results.push({ golden, actual: result.content });
  passed += 1;
  console.log(`PASS ${golden.id}`);
}

const metrics = summarizePocketBenchmark(results);
console.log(`Pocket golden regression passed ${passed}/${manifest.cases.length} approved charts.`);
console.log(`Guide recall ${metrics.guideRecallPercent}% · complete-chart pass ${metrics.chartPassPercent}% · unsupported extra guides ${metrics.extraGuides}.`);
console.log(`Coverage: ${metrics.scenarios.join(", ")} · ${metrics.timeframes.join(", ")}.`);
if (process.env.POCKET_GOLDEN_RELEASE_GATE === "1") assertPocketReleaseGate(metrics, manifest.releaseGate.minimumCharts);
