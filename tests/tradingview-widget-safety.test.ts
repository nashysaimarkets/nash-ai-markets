import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const ROOT = join(import.meta.dirname, "..");
const read = (relative: string) => readFileSync(join(ROOT, relative), "utf8");

test("TradingView remains an official opt-in display surface, never an engine feed", () => {
  const platforms = read("app/terminal/lib/preferred-platforms.ts");
  const desk = read("app/terminal/components/TradingDeskOS.tsx");

  assert.match(platforms, /https:\/\/s\.tradingview\.com\/widgetembed/);
  assert.match(platforms, /display-only, sandboxed and opt-in/i);
  assert.match(platforms, /never enter Bullseye’s verified feed or decision engine/i);
  assert.doesNotMatch(platforms, /fetch\s*\(|axios|websocket/i);
  assert.match(desk, /!embedAllowed/);
  assert.match(desk, /Load TradingView embed/);
  assert.match(desk, /sandbox="allow-scripts allow-same-origin allow-popups allow-forms"/);
  assert.match(desk, /referrerPolicy="no-referrer"/);
});

test("privacy notice explains optional widget delivery and device-local comparison", () => {
  const privacy = read("app/privacy/page.tsx");

  assert.match(privacy, /optional TradingView chart loads only after a member chooses/i);
  assert.match(privacy, /widgets do not set\s*\n?\s*cookies/i);
  assert.match(privacy, /may be delayed or unavailable/i);
  assert.match(privacy, /never enter Bullseye’s verified feed or decision engine/i);
  assert.match(privacy, /comparisons between verified display states/i);
});
