import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import {
  RETURN_VISIT_STORAGE_KEY,
  buildReturnVisitBriefing,
  clearStoredReturnVisitSnapshot,
  readStoredReturnVisitSnapshot,
  writeStoredReturnVisitSnapshot,
  type ReturnVisitInput,
} from "../app/lib/oracle/return-visit-briefing.ts";

const ROOT = join(import.meta.dirname, "..");
const read = (relative: string) => readFileSync(join(ROOT, relative), "utf8");

function current(overrides: Partial<ReturnVisitInput> = {}): ReturnVisitInput {
  return {
    capturedAt: "2026-08-16T08:00:00.000Z",
    verified: true,
    sessionPhase: "premarket",
    sessionLabel: "Pre-market",
    lean: "Observed lean: balanced",
    permission: "Wait for confirmation",
    risk: "Moderate",
    catalystKey: "CPI|2026-08-16T12:30:00.000Z",
    catalystLabel: "CPI · 13:30 UK",
    marketStatus: "DELAYED",
    freshness: "15-minute delayed context",
    ...overrides,
  };
}

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem(key: string) {
      return values.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      values.set(key, value);
    },
    removeItem(key: string) {
      values.delete(key);
    },
  };
}

test("first verified visit creates a device-local baseline", () => {
  const storage = memoryStorage();
  const model = buildReturnVisitBriefing({ previous: null, current: current() });

  assert.equal(model.status, "baseline");
  assert.equal(model.comparable, false);
  writeStoredReturnVisitSnapshot(model.current, storage);
  assert.deepEqual(readStoredReturnVisitSnapshot(storage), model.current);
  assert.match(storage.getItem(RETURN_VISIT_STORAGE_KEY) ?? "", /Pre-market/);
});

test("a returning member sees ordered material changes only", () => {
  const baseline = buildReturnVisitBriefing({ previous: null, current: current() }).current;
  const model = buildReturnVisitBriefing({
    previous: baseline,
    current: current({
      capturedAt: "2026-08-16T10:00:00.000Z",
      marketStatus: "LIVE",
      permission: "Selective participation",
      sessionPhase: "rth",
      sessionLabel: "Regular session",
      catalystKey: "FOMC|2026-08-16T18:00:00.000Z",
      catalystLabel: "FOMC · 19:00 UK",
      risk: "Elevated",
      lean: "Observed lean: constructive",
    }),
  });

  assert.equal(model.status, "changed");
  assert.equal(model.comparable, true);
  assert.deepEqual(model.changes.map((change) => change.id), [
    "data",
    "permission",
    "session",
    "catalyst",
    "risk",
    "lean",
  ]);
  assert.match(model.title, /6 material changes/);
});

test("unchanged verified state is reported without invented movement", () => {
  const baseline = buildReturnVisitBriefing({ previous: null, current: current() }).current;
  const model = buildReturnVisitBriefing({
    previous: baseline,
    current: current({ capturedAt: "2026-08-16T09:00:00.000Z" }),
  });

  assert.equal(model.status, "unchanged");
  assert.deepEqual(model.changes, []);
});

test("unavailable and example-only context pause comparison and preserve the baseline", () => {
  const baseline = buildReturnVisitBriefing({ previous: null, current: current() }).current;

  for (const input of [
    current({ verified: false, marketStatus: "UNAVAILABLE" }),
    current({ verified: false, marketStatus: "PREVIEW" }),
  ]) {
    const model = buildReturnVisitBriefing({ previous: baseline, current: input });
    assert.equal(model.status, "unavailable");
    assert.equal(model.previous, baseline);
    assert.match(model.message, /never replaces it/i);
  }
});

test("an old or incompatible timestamp starts a fresh baseline", () => {
  const baseline = buildReturnVisitBriefing({ previous: null, current: current() }).current;
  const model = buildReturnVisitBriefing({
    previous: baseline,
    current: current({ capturedAt: "2026-08-18T08:00:01.000Z" }),
  });

  assert.equal(model.status, "baseline");
  assert.equal(model.comparable, false);
  assert.match(model.message, /too old/i);
});

test("corrupt storage fails closed and the baseline can be cleared", () => {
  const storage = memoryStorage();
  storage.setItem(RETURN_VISIT_STORAGE_KEY, "not-json");
  assert.equal(readStoredReturnVisitSnapshot(storage), null);

  const baseline = buildReturnVisitBriefing({ previous: null, current: current() }).current;
  writeStoredReturnVisitSnapshot(baseline, storage);
  clearStoredReturnVisitSnapshot(storage);
  assert.equal(readStoredReturnVisitSnapshot(storage), null);
});

test("return briefing is accessible, device-local and isolated from example previews", () => {
  const component = read("app/components/oracle/ReturnVisitBriefing.tsx");
  const centre = read("app/dashboard/components/MarketCommandCentre.tsx");
  const page = read("app/dashboard/page.tsx");
  const css = read("app/market-command-centre.css");

  assert.match(component, /aria-live="polite"/);
  assert.match(component, /Stored only in this browser/);
  assert.match(component, /never changes verified evidence or the decision engine/);
  assert.doesNotMatch(component, /fetch\s*\(/);
  assert.doesNotMatch(component, /supabase|\/api\//i);
  assert.match(centre, /verifiedContext = false/);
  assert.match(centre, /marketStatus = "UNAVAILABLE"/);
  assert.match(page, /verifiedContext: context\.verified/);
  assert.match(page, /marketStatus: context\.snapshot\.status/);
  assert.match(css, /\.dashReturnBriefing>footer button:focus-visible[^}]*outline:2px solid/);
});
