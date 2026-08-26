import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { generateSecondOpinion } from "../app/lib/server/second-opinion.ts";
import {
  assertPocketGolden,
  validatePocketGoldenCase,
  type PocketGoldenCase,
} from "../tests/support/pocket-golden-regression.ts";

type Manifest = { schemaVersion: 1; cases: unknown[] };

const fixtureDirectory = new URL("../tests/fixtures/pocket-golden/", import.meta.url);
const manifest = JSON.parse(await readFile(new URL("manifest.json", fixtureDirectory), "utf8")) as Manifest;
if (manifest.schemaVersion !== 1 || !Array.isArray(manifest.cases)) throw new Error("Unsupported Pocket golden manifest.");

if (manifest.cases.length === 0) {
  console.log("Pocket golden intake is ready; no privacy-approved chart fixtures are registered yet.");
  process.exit(0);
}

const mimeFor = (file: string) => {
  const extension = extname(file).toLowerCase();
  if (extension === ".png") return "image/png";
  if (extension === ".webp") return "image/webp";
  if (extension === ".jpg" || extension === ".jpeg") return "image/jpeg";
  throw new Error(`Unsupported golden image extension: ${extension}`);
};

let passed = 0;
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
  passed += 1;
  console.log(`PASS ${golden.id}`);
}

console.log(`Pocket golden regression passed ${passed}/${manifest.cases.length} approved charts.`);
