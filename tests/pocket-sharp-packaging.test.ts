import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import nextConfig from "../next.config.ts";
import { TORTURE_CASES, syntheticSvg } from "./support/pocket-image-torture.ts";

const require = createRequire(import.meta.url);
const sharp = require("sharp");

test("Sharp and Linux libvips remain production dependencies", async () => {
  const pkg = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
  const lock = JSON.parse(await readFile(new URL("../package-lock.json", import.meta.url), "utf8"));
  assert.equal(pkg.dependencies.sharp, "0.35.0");
  assert.equal(lock.packages[""].dependencies.sharp, pkg.dependencies.sharp);
  for (const name of ["sharp", "@img/sharp-linux-x64", "@img/sharp-libvips-linux-x64"]) {
    const entry = lock.packages[`node_modules/${name}`];
    assert.ok(entry, `${name} missing from lockfile`);
    assert.ok(!entry.dev && !entry.devOptional, `${name} must survive production pruning`);
  }
  assert.deepEqual(nextConfig.outputFileTracingIncludes?.["/api/pocket/torture"], [
    "./node_modules/sharp/**/*", "./node_modules/@img/sharp-*/**/*",
  ]);
});

test("all six labelled SVGs rasterize and decode without an AI provider", async () => {
  assert.equal(TORTURE_CASES.length, 6);
  for (const sample of TORTURE_CASES) {
    const png = await sharp(Buffer.from(syntheticSvg(sample))).png().toBuffer();
    assert.equal(png.subarray(0, 8).toString("hex"), "89504e470d0a1a0a", sample.id);
    const metadata = await sharp(png).metadata();
    assert.equal(metadata.width, 900, sample.id);
    assert.equal(metadata.height, 600, sample.id);
    assert.equal(metadata.format, "png", sample.id);
  }
});

test("live torture reads the analysis envelope rather than silently scoring empty output", async () => {
  const { unwrapTortureAnalysis } = await import("./support/pocket-image-torture.ts");
  const result = unwrapTortureAnalysis({ analysis: {
    levels: [{ kind: "support", y: 64 }],
    patterns: [{ name: "RECTANGLE / RANGE" }],
    liquidity: { state: "VERIFIED", event: "NONE" },
    evidenceQuality: { chartReadability: "HIGH" },
  } });
  assert.equal(result.levels?.[0]?.kind, "support");
  assert.equal(result.patterns?.[0]?.name, "RECTANGLE / RANGE");
  assert.equal(result.liquidity?.state, "VERIFIED");
  assert.equal(result.evidenceQuality?.chartReadability, "HIGH");
  assert.throws(() => unwrapTortureAnalysis({ levels: [] }), /analysis envelope/i);
});

test("torture payload matches the app's precision-crop geometry and chart scale", async () => {
  const { syntheticPrecisionCropSpec, buildTortureRequestPayload } = await import("./support/pocket-image-torture.ts");
  assert.deepEqual(syntheticPrecisionCropSpec(900, 600), {
    left: 0, top: 36, width: 900, height: 492, targetWidth: 1400, targetHeight: 765,
  });
  for (const sample of TORTURE_CASES) {
    const payload = buildTortureRequestPayload(sample, "data:image/png;base64,dummy", "data:image/jpeg;base64,crop");
    assert.equal(payload.precisionImage, "data:image/jpeg;base64,crop");
    assert.equal(payload.chartConfirmation.instrument, sample.market);
    assert.equal(payload.chartConfirmation.timeframe, sample.timeframe);
    const lastPixelY = 60 + sample.points.at(-1)! * 4.6;
    const priceProjectedY = 80 + (110 - Number(payload.chartConfirmation.currentPrice)) * 21;
    assert.ok(Math.abs(lastPixelY - priceProjectedY) < 0.2, sample.id + " price mismatch");
  }
});

test("both torture runners use the real analyse envelope and precision crop", async () => {
  for (const path of ["../app/api/pocket/torture/route.ts", "../scripts/run-pocket-image-torture.ts"]) {
    const source = await readFile(new URL(path, import.meta.url), "utf8");
    assert.match(source, /unwrapTortureAnalysis\(/, path);
    assert.match(source, /syntheticPrecisionCropSpec\(/, path);
    assert.match(source, /buildTortureRequestPayload\(/, path);
  }
});
