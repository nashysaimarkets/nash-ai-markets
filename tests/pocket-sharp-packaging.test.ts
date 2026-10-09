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
    liquidity: { state: "VERIFIED", event: "NONE", zones: [] },
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

test("live torture enforces forbidden patterns and minimum liquidity zones", async () => {
  const { tortureExpectationFailures, TORTURE_CASES } = await import("./support/pocket-image-torture.ts");
  const sweep = TORTURE_CASES.find((sample) => sample.id === "sweep-reclaim")!;
  const bad = tortureExpectationFailures(sweep, ["HEAD & SHOULDERS"], {state:"VERIFIED",event:"SWEEP",zones:[]});
  assert.ok(bad.some((message) => message.includes("forbidden pattern HEAD & SHOULDERS")));
  assert.ok(bad.some((message) => message.includes("liquidity zones 0 < 1")));
  const good = tortureExpectationFailures(sweep, [], {state:"VERIFIED",event:"SWEEP",zones:[{}]});
  assert.deepEqual(good, []);
});

test("synthetic candle OHLC geometry is internally valid for every fixture", async () => {
  const { syntheticCandleGeometry } = await import("./support/pocket-image-torture.ts");
  for (const sample of TORTURE_CASES) {
    const candles = syntheticCandleGeometry(sample);
    assert.equal(candles.length, sample.points.length, sample.id);
    for (const [index, candle] of candles.entries()) {
      const label = `${sample.id} candle ${index}`;
      assert.ok(candle.highY <= Math.min(candle.openY, candle.closeY), label + " wick high");
      assert.ok(candle.lowY >= Math.max(candle.openY, candle.closeY), label + " wick low");
      assert.equal(candle.bodyTop, Math.min(candle.openY, candle.closeY), label + " body top");
      assert.equal(candle.bodyBottom, Math.max(candle.openY, candle.closeY), label + " body bottom");
      assert.ok(candle.highY >= 60 && candle.lowY <= 520, label + " within plot");
      assert.ok(Math.abs(candle.closeY - (60 + sample.points[index]! * 4.6)) < 0.00001, label + " close");
    }
  }
});

test("all displayed synthetic price labels lie on the same linear price scale", async () => {
  const { SYNTHETIC_PRICE_AXIS, syntheticLastPrice } = await import("./support/pocket-image-torture.ts");
  assert.ok(SYNTHETIC_PRICE_AXIS.length >= 3);
  const [first, last] = [SYNTHETIC_PRICE_AXIS[0]!, SYNTHETIC_PRICE_AXIS.at(-1)!];
  const slope = (last.price - first.price) / (last.y - first.y);
  for (const tick of SYNTHETIC_PRICE_AXIS) {
    assert.ok(Math.abs(tick.price - (first.price + (tick.y - first.y) * slope)) < 0.001,
      `axis tick ${tick.price} at y ${tick.y} is not linear`);
  }
  for (const sample of TORTURE_CASES) {
    const closeY = 60 + sample.points.at(-1)! * 4.6;
    const expectedPrice = first.price + (closeY - first.y) * slope;
    assert.ok(Math.abs(Number(syntheticLastPrice(sample)) - expectedPrice) < 0.006, sample.id);
  }
});

test("synthetic price axis remains readable without system fonts", async () => {
  const { SYNTHETIC_PRICE_AXIS } = await import("./support/pocket-image-torture.ts");
  for (const sample of TORTURE_CASES) {
    const svg = syntheticSvg(sample);
    if (sample.degrade === "crop-scale") continue;
    for (const {price, y} of SYNTHETIC_PRICE_AXIS) {
      assert.ok(svg.includes(`data-axis-price="${price}" data-axis-y="${y}"`), `${sample.id}: missing vector axis ${price}`);
      const group = svg.split(`data-axis-price="${price}" data-axis-y="${y}">`)[1]?.split("</g>")[0] ?? "";
      const digits = [...group.matchAll(/data-axis-digit="(\d)" d="([^"]+)"/g)];
      assert.equal(digits.map((match) => match[1]).join(""), String(price), `${sample.id}: exact digits for ${price}`);
      assert.ok(digits.every((match) => match[2].includes("M")), `${sample.id}: each digit has drawable strokes`);
      const positions = [...group.matchAll(/transform="translate\([\d.]+ ([\d.]+)\)"/g)];
      assert.equal(positions.length, String(price).length, `${sample.id}: each digit has a position`);
      for (const position of positions) assert.equal(Number(position[1]) + 7, y,
        `${sample.id}: ${price} glyph centre must match the calibrated axis row`);
    }
    assert.equal((svg.match(/data-axis-digit=/g) ?? []).length, SYNTHETIC_PRICE_AXIS.reduce((count, tick) => count + String(tick.price).length, 0),
      sample.id + ": all numeric labels must have font-independent vector glyphs");
  }
});

test('actual deployed raster route reports stable decoded pixel digests without provider calls', async () => {
  const { stripTypeScriptTypes } = await import('node:module');
  const { createHash } = await import('node:crypto');
  const { syntheticPrecisionCropSpec } = await import('./support/pocket-image-torture.ts');
  const route=await readFile(new URL('../app/api/pocket/torture/route.ts',import.meta.url),'utf8');
  const helper=route.slice(route.indexOf('async function makePrecisionCrop('),route.indexOf('type Counts='));
  const source=route.slice(route.indexOf('export async function GET(')).replace('export async function','async function');
  const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
  let providerCalls=0;
  const bindings={sharp,createHash,syntheticPrecisionCropSpec,TORTURE_CASES,syntheticSvg,NextResponse:{json:(body:unknown)=>body},analyse:()=>{providerCalls++;throw new Error('must never call a provider');}};
  const get=await new AsyncFunction(...Object.keys(bindings),stripTypeScriptTypes(helper+source)+'\nreturn GET;')(...Object.values(bindings));
  const old=process.env.VERCEL_ENV;process.env.VERCEL_ENV='preview';
  try{
    const first=await get(new Request('https://preview.test/api/pocket/torture?run=1&raster=1'));
    const second=await get(new Request('https://preview.test/api/pocket/torture?run=1&raster=1'));
    assert.equal(first.images.length,6);
    for(let index=0;index<6;index++){
      assert.match(first.images[index].pixelSha256,/^[a-f0-9]{64}$/);
      assert.match(first.images[index].precisionPixelSha256,/^[a-f0-9]{64}$/);
      assert.equal(first.images[index].pixelSha256,second.images[index].pixelSha256);
      assert.equal(first.images[index].precisionPixelSha256,second.images[index].precisionPixelSha256);
    }
    assert.equal(providerCalls,0);
  }finally{if(old===undefined)delete process.env.VERCEL_ENV;else process.env.VERCEL_ENV=old;}
});
