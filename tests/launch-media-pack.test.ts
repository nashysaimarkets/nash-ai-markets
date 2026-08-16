import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path: string) => readFile(new URL(path, root), "utf8");
const readBinary = (path: string) => readFile(new URL(path, root));

const media = [
  { stem: "widescreen", width: 1920, height: 1080 },
  { stem: "square", width: 1080, height: 1080 },
  { stem: "vertical", width: 1080, height: 1920 },
] as const;

test("launch end cards have the exact editor canvases and compact PNG output", async () => {
  for (const item of media) {
    const image = await readBinary(`public/launch/bullseye-end-card-${item.stem}.png`);
    assert.deepEqual([...image.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
    assert.equal(image.readUInt32BE(16), item.width);
    assert.equal(image.readUInt32BE(20), item.height);
    assert.ok(image.byteLength < 750_000, `${item.stem} end card should stay economical to store and transfer`);
  }
});

test("every editable end card retains the CTA and market-data safety boundary", async () => {
  for (const item of media) {
    const source = await read(`public/launch/bullseye-end-card-${item.stem}.svg`);
    assert.match(source, /JOIN THE LAUNCH WAITING LIST/);
    assert.match(source, /EDUCATIONAL DECISION SUPPORT/);
    assert.match(source, /NOT LIVE MARKET DATA/);
    assert.doesNotMatch(source, /profit|win rate|accuracy|guaranteed return/i);
  }
});

test("subtitle files are plain-text, bounded and free of outcome claims", async () => {
  const paths = [
    "public/launch/captions/bullseye-reveal-25s.srt",
    "public/launch/captions/bullseye-vertical-20s.srt",
    "public/launch/captions/bullseye-wait-hook-10s.srt",
    "public/launch/captions/bullseye-square-15s.srt",
  ];
  const subtitles = await Promise.all(paths.map(read));
  for (const source of subtitles) {
    assert.match(source, /00:00:00,000 -->/);
    assert.doesNotMatch(source, /&amp;|<script|https?:\/\//i);
    assert.doesNotMatch(source, /guaranteed returns?|win rate|accuracy rate|copy our trades|buy now/i);
  }
  assert.match(subtitles[0], /00:00:25,000/);
  assert.match(subtitles[1], /00:00:20,000/);
  assert.match(subtitles[2], /00:00:10,000/);
  assert.match(subtitles[3], /00:00:15,000/);
});

test("accepted film pack and private page protocol preserve every launch boundary", async () => {
  const [pack, acceptance] = await Promise.all([
    read("docs/BULLSEYE_LAUNCH_VIDEO_EDIT_PACK.md"),
    read("docs/WAITLIST_PRIVATE_VISUAL_ACCEPTANCE.md"),
  ]);
  assert.match(pack, /DERIVATIVES CUT \/ PHONE VIDEO PASS \/ PUBLIC USE NOT AUTHORISED/);
  assert.match(pack, /Bullseye_Cinematic_Launch_Film_v16_BrighterBarcodeTransitions\.mp4/);
  assert.match(pack, /3155872116ade291c23654d3d9a24a8acca81d1f5d522354ff3c4d703422ac63/);
  assert.match(pack, /bullseye-v16-reveal-25s-16x9-captioned\.mp4/);
  assert.match(pack, /bullseye-v16-reel-20s-9x16-captioned\.mp4/);
  assert.match(pack, /bullseye-v16-wait-hook-10s-9x16-captioned\.mp4/);
  assert.match(pack, /bullseye-v16-feed-15s-1x1-captioned\.mp4/);
  assert.match(pack, /bullseye-v16-reel-20s-9x16-silent-captioned\.mp4/);
  assert.match(pack, /Public production and paid promotion: \*\*NO-GO\*\*/);
  assert.match(pack, /EXAMPLE ONLY[\s\S]*not[- ]live/i);
  assert.match(
    acceptance,
    /PRIVATE DESKTOP\/FILM\/NETWORK PASS \/ PHYSICAL RESPONSIVE ACCEPTANCE PENDING/,
  );
  assert.match(acceptance, /x-robots-tag: noindex/i);
  assert.match(acceptance, /PENDING — PHYSICAL PAGE RUN/);
  assert.match(acceptance, /does not autoplay/i);
  assert.match(acceptance, /approximately 3 MB MP4/i);
  assert.match(acceptance, /same-origin `POST \/api\/waitlist`/);
  assert.match(acceptance, /no market-data provider request is made/);
  assert.match(acceptance, /does\s+not clear public production/i);
});
