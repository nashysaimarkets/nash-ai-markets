import test from "node:test";
import assert from "node:assert/strict";
// @ts-ignore sharp ships declarations; the shared verification install uses a legacy exports map.
import sharp from "sharp";
import { createPrecisionCrop } from "../app/api/pocket/precision-crop.ts";

test("precision rescue enlarges the plotted chart and price-scale area", async () => {
  const source = await sharp({ create: { width: 945, height: 2048, channels: 3, background: "white" } }).png().toBuffer();
  const crop = await createPrecisionCrop(`data:image/png;base64,${source.toString("base64")}`, { left: 4, top: 15, right: 90, bottom: 86 });
  assert.ok(crop?.startsWith("data:image/png;base64,"));
  const output = Buffer.from(crop!.split(",")[1], "base64");
  const metadata = await sharp(output).metadata();
  assert.equal(metadata.width, 1400);
  assert.ok((metadata.height ?? 0) > 900);
});

test("precision rescue refuses malformed image data", async () => {
  assert.equal(await createPrecisionCrop("not-an-image", {}), null);
});
