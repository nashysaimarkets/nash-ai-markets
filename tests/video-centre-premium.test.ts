import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { normalizeMarketVideoRecord } from "../app/lib/market-video/validate.ts";

const ROOT = join(import.meta.dirname, "..");
const read = (relative: string) => readFileSync(join(ROOT, relative), "utf8");

const base = {
  youtubeVideoId: "dQw4w9WgXcQ",
  type: "PRE_MARKET",
  marketDate: "2026-08-03",
  status: "published",
  title: "Morning brief",
  publishedAt: "2026-08-03T11:30:00.000Z",
};

test("a record without editorial extras exposes no takeaways or transcript", () => {
  const record = normalizeMarketVideoRecord(base);
  assert.ok(record);
  assert.equal(record.keyTakeaways, undefined);
  assert.equal(record.transcriptPreview, undefined);
});

test("published takeaways are trimmed and capped at three", () => {
  const record = normalizeMarketVideoRecord({
    ...base,
    keyTakeaways: ["  first  ", "second", "third", "fourth"],
  });
  assert.ok(record);
  assert.deepEqual(record.keyTakeaways, ["first", "second", "third"]);
});

test("malformed takeaways are discarded rather than rendered as blanks", () => {
  const record = normalizeMarketVideoRecord({
    ...base,
    keyTakeaways: ["kept", "", "   ", 42, null, { a: 1 }],
  });
  assert.ok(record);
  assert.deepEqual(record.keyTakeaways, ["kept"]);
});

test("a takeaways array with nothing usable produces no section at all", () => {
  const record = normalizeMarketVideoRecord({ ...base, keyTakeaways: ["", "  ", 7] });
  assert.ok(record);
  assert.equal(record.keyTakeaways, undefined);
});

test("transcript previews are bounded so one record cannot flood the card", () => {
  const record = normalizeMarketVideoRecord({ ...base, transcriptPreview: "x".repeat(5000) });
  assert.ok(record);
  assert.equal(record.transcriptPreview?.length, 600);
});

test("a blank transcript preview is omitted rather than rendered empty", () => {
  const record = normalizeMarketVideoRecord({ ...base, transcriptPreview: "    " });
  assert.ok(record);
  assert.equal(record.transcriptPreview, undefined);
});

test("editorial extras never affect whether a video is considered valid", () => {
  const withGarbage = normalizeMarketVideoRecord({
    ...base,
    keyTakeaways: "not-an-array",
    transcriptPreview: 12345,
  });
  assert.ok(withGarbage, "a valid video must survive unusable optional fields");
  assert.equal(withGarbage.keyTakeaways, undefined);
  assert.equal(withGarbage.transcriptPreview, undefined);
});

test("the embed stays privacy-enhanced and click-to-load", () => {
  const player = read("app/components/MarketVideoPlayer.tsx");
  const record = normalizeMarketVideoRecord(base);
  assert.match(record!.embedUrl, /^https:\/\/www\.youtube-nocookie\.com\/embed\//);
  assert.doesNotMatch(player, /autoplay=1/);
  // The iframe mounts only after an explicit click.
  assert.match(player, /active \? \(/);
  assert.match(player, /onClick=\{\(\) => setActive\(true\)\}/);
});

test("the video centre shows both daily slots when nothing is published", () => {
  const centre = read("app/dashboard/components/DashboardVideoCentre.tsx");
  assert.match(centre, /PRE_MARKET/);
  assert.match(centre, /POST_MARKET/);
  assert.match(centre, /Morning brief/);
  assert.match(centre, /Post-market review/);
  assert.match(centre, /Not published yet/);
});

test("the unpublished state never fabricates a video or borrows a thumbnail", () => {
  const centre = read("app/dashboard/components/DashboardVideoCentre.tsx");
  // No hardcoded media source of any kind: no thumbnail host, no embed target
  // and no iframe. The placeholder is drawn entirely in CSS.
  assert.doesNotMatch(centre, /ytimg\.com|youtube\.com|youtube-nocookie\.com/i);
  assert.doesNotMatch(centre, /<iframe/i);
  assert.doesNotMatch(centre, /<img/i);
});

test("the written brief stays reachable whenever video is absent", () => {
  const centre = read("app/dashboard/components/DashboardVideoCentre.tsx");
  assert.match(centre, /href="\/brief"/);
  assert.match(centre, /Morning Brief/);
});

test("the dashboard embeds the player rather than only linking to it", () => {
  const centre = read("app/dashboard/components/DashboardVideoCentre.tsx");
  assert.match(centre, /MarketVideoPlayer/);
  assert.match(centre, /heading=\{published\.title\}/);
});
