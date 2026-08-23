import assert from "node:assert/strict";
import { test } from "node:test";

import {
  createCachedSnapshot,
  createConstantSnapshot,
} from "../app/lib/oracle/cached-snapshot.ts";
import { readDashboardWorkspace } from "../app/lib/oracle/dashboard-workspace.ts";
import { readProcessScore } from "../app/lib/oracle/process-score.ts";
import { readDailyChecklist } from "../app/lib/oracle/daily-checklist.ts";

/** Minimal in-memory stand-in for the Storage reads these helpers perform. */
function storageWith(entries: Record<string, string>): Pick<Storage, "getItem"> {
  return { getItem: (key: string) => entries[key] ?? null };
}

test("the raw readers return a fresh object each call, which is why they cannot be passed to useSyncExternalStore directly", () => {
  // Documents the defect: Object.is comparison inside useSyncExternalStore sees
  // a changed store on every render and loops until React throws.
  assert.notEqual(readDashboardWorkspace(null), readDashboardWorkspace(null));
  assert.notEqual(readProcessScore(null), readProcessScore(null));
  assert.notEqual(readDailyChecklist(null), readDailyChecklist(null));
});

test("createCachedSnapshot keeps one reference while the underlying value is unchanged", () => {
  const snapshot = createCachedSnapshot(() => readDashboardWorkspace(null));
  const first = snapshot();
  const second = snapshot();
  const third = snapshot();

  assert.equal(first, second);
  assert.equal(second, third);
  assert.deepEqual(first, readDashboardWorkspace(null));
});

test("createCachedSnapshot yields a new reference once the value actually changes", () => {
  let density: "comfortable" | "compact" = "comfortable";
  const snapshot = createCachedSnapshot(() => ({ version: 1 as const, density }));

  const before = snapshot();
  assert.equal(before, snapshot());

  density = "compact";
  const after = snapshot();

  assert.notEqual(before, after);
  assert.equal(after.density, "compact");
  assert.equal(after, snapshot());
});

test("createCachedSnapshot is stable for the process score and daily checklist readers", () => {
  const process = createCachedSnapshot(() => readProcessScore(null));
  assert.equal(process(), process());

  const checklist = createCachedSnapshot(() => readDailyChecklist(null));
  assert.equal(checklist(), checklist());
});

test("createCachedSnapshot reflects stored values and stays stable across repeated reads", () => {
  const stored = storageWith({
    "nash-oracle-dashboard-workspace-v1": JSON.stringify({
      version: 1,
      favouriteMarketId: "vix",
      order: ["chart", "insight"],
      pinned: ["chart"],
      expanded: [],
      density: "compact",
    }),
  });

  const snapshot = createCachedSnapshot(() => readDashboardWorkspace(stored));
  const first = snapshot();

  assert.equal(first.density, "compact");
  assert.equal(first.favouriteMarketId, "vix");
  assert.equal(first, snapshot());
});

test("createConstantSnapshot always returns the identical server reference", () => {
  const serverSnapshot = createConstantSnapshot(() => readDashboardWorkspace(null));
  const first = serverSnapshot();

  assert.equal(first, serverSnapshot());
  assert.equal(first, serverSnapshot());
});

/**
 * Mirrors what React does after committing a `useSyncExternalStore` render: it
 * re-reads the snapshot and schedules another render if the reference moved.
 * A conforming snapshot settles on the first check; a non-conforming one never
 * settles, which is the runaway that took these routes down.
 */
function passesUntilSettled(getSnapshot: () => unknown, limit = 25): number {
  let previous = getSnapshot();
  for (let pass = 1; pass <= limit; pass += 1) {
    const next = getSnapshot();
    if (Object.is(next, previous)) return pass;
    previous = next;
  }
  return Number.POSITIVE_INFINITY;
}

test("unwrapped readers never settle, reproducing the render loop that broke dashboard, brief and preferences", () => {
  assert.equal(passesUntilSettled(() => readDashboardWorkspace(null)), Number.POSITIVE_INFINITY);
  assert.equal(passesUntilSettled(() => readProcessScore(null)), Number.POSITIVE_INFINITY);
  assert.equal(passesUntilSettled(() => readDailyChecklist(null)), Number.POSITIVE_INFINITY);
});

test("wrapped readers settle immediately, so the routes can commit a render", () => {
  assert.equal(passesUntilSettled(createCachedSnapshot(() => readDashboardWorkspace(null))), 1);
  assert.equal(passesUntilSettled(createCachedSnapshot(() => readProcessScore(null))), 1);
  assert.equal(passesUntilSettled(createCachedSnapshot(() => readDailyChecklist(null))), 1);
  assert.equal(passesUntilSettled(createConstantSnapshot(() => readDashboardWorkspace(null))), 1);
});

test("createCachedSnapshot does not cache values it cannot serialise", () => {
  const circular: Record<string, unknown> = {};
  circular.self = circular;

  const snapshot = createCachedSnapshot(() => circular);
  // Must not throw; falls back to returning the live value.
  assert.equal(snapshot(), circular);
});
