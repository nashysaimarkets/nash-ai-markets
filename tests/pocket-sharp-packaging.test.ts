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
