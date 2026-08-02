import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(rel: string) {
  return readFileSync(path.join(root, rel), "utf8");
}

test("semantic visual tokens are defined and imported", () => {
  const tokens = read("app/visual-tokens.css");
  const globals = read("app/globals.css");
  for (const name of [
    "--accent-primary",
    "--accent-premium",
    "--accent-info",
    "--accent-caution",
    "--accent-risk",
    "--accent-reflection",
    "--surface-success-soft",
    "--surface-info-soft",
    "--surface-warning-soft",
    "--surface-risk-soft",
  ]) {
    assert.match(tokens, new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(globals, /visual-tokens\.css/);
  assert.match(tokens, /prefers-reduced-motion:\s*reduce/);
  assert.match(tokens, /vxPulseLive/);
});

test("delayed status must not use live pulse class in feed labels", () => {
  const brief = read("app/brief/components/MorningMarketBrief.tsx");
  const mcc = read("app/dashboard/components/MarketCommandCentre.tsx");
  assert.doesNotMatch(brief, /vxPulseLive/);
  assert.doesNotMatch(mcc, /vxPulseLive/);
});

test("StatusIcon covers core member symbols without emoji", () => {
  const icons = read("app/components/StatusIcon.tsx");
  for (const name of ["brief", "dashboard", "desk", "sunrise", "sunset", "video", "device", "verified", "delayed"]) {
    assert.match(icons, new RegExp(`"${name}"`));
  }
  assert.doesNotMatch(icons, /[\u{1F300}-\u{1FAFF}]/u);
});

test("session-aware accents and video placements are wired", () => {
  const brief = read("app/brief/components/MorningMarketBrief.tsx");
  const mcc = read("app/dashboard/components/MarketCommandCentre.tsx");
  const desk = read("app/terminal/components/TradingDeskOS.tsx");
  assert.match(brief, /vxSessionAccent-/);
  assert.match(mcc, /vxSessionAccent-/);
  assert.match(mcc, /postMarketPendingNotice/);
  assert.match(desk, /DeskVideoShortcut/);
  assert.match(desk, /deskVideoShortcut/);
});

test("reviews archive route exists and uses published loader only", () => {
  const page = read("app/reviews/page.tsx");
  assert.match(page, /listPublishedMarketVideoArchive/);
  assert.match(page, /loadPublishedMarketVideos/);
  assert.match(page, /Previous market reviews/);
});
