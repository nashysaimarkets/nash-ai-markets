import test from "node:test";
import assert from "node:assert/strict";
import { createSampleCharts } from "../app/pocket/sample-analysis";
import { resolveLevelEvidence } from "../app/pocket/source-evidence";
import { timeframeComparison } from "../app/pocket/timeframe-comparison";
import { createNotebookBackup, mergeNotebook, notebookMatches, parseNotebookBackup } from "../app/pocket/notebook";
import type { LockedDecision } from "../app/pocket/analysis-types";

const report = createSampleCharts()[0].report!;
const png = "data:image/png;base64,iVBORw0KGgo=";
const decision = (): LockedDecision => ({ id: "original", createdAt: "2026-09-16T15:00:00Z", intention: "UNSURE", image: png, analysis: structuredClone(report), notebook: { lesson: "Wait for the retest", tags: ["Breakout"], updatedAt: "2026-09-16T15:01:00Z" }, sourceImages: { image: png, contextImage: png, detailImage: null, fourHourImage: null, indicatorImage: null } });

test("evidence opens its own source and never borrows primary coordinates for context", () => {
  const primary = { ...report.levels[0], x: 10, x2: 80, y: 40, y2: 40, source: "PRIMARY" as const };
  const context = { ...primary, source: "CONTEXT" as const, y: 70, y2: 70 };
  const analysis = { ...report, levels: [primary], plotBounds: { left: 5, right: 90, top: 10, bottom: 80 }, contextBattlefield: { levels: [context], plotBounds: { left: 5, right: 90, top: 10, bottom: 80 } } };
  assert.equal(resolveLevelEvidence(primary, analysis, "primary", "context").line?.y, 40);
  assert.equal(resolveLevelEvidence(context, analysis, "primary", "context").image, "context");
  assert.equal(resolveLevelEvidence(context, analysis, "primary", "context").line?.y, 70);
  assert.equal(resolveLevelEvidence(context, { ...analysis, contextBattlefield: null }, "primary", "context").line, null);
  assert.equal(resolveLevelEvidence(context, analysis, "primary", null).image, null);
  assert.equal(resolveLevelEvidence({ ...primary, source: "USER_VERIFIED" }, analysis, "primary").line, null);
  assert.equal(resolveLevelEvidence({ ...primary, source: "LEVEL_LAB" }, analysis, "primary").line, null);
  assert.equal(resolveLevelEvidence(primary, { ...analysis, levels: [{ ...primary, x: Number.NaN }] }, "primary").line, null);
});

test("timeframe comparison preserves conflicts and excludes unverified identities", () => {
  const charts = createSampleCharts();
  const active = charts[0].report!;
  const rows = timeframeComparison(charts, active, charts[0].id);
  assert.equal(rows[0].relation, "Selected view");
  assert.ok(rows.some((row) => row.relation === "Opposing direction"));
  const mixed = charts.map((chart, i) => i === 1 ? { ...chart, report: { ...chart.report!, instrument: "Different instrument" } } : i === 2 ? { ...chart, report: undefined, preparation: "failed" as const } : chart);
  assert.equal(timeframeComparison(mixed, active, charts[0].id)[1].relation, "Verify identity / evidence");
  assert.equal(timeframeComparison(mixed, active, charts[0].id)[1].support, null);
  assert.equal(timeframeComparison(mixed, active, charts[0].id)[2].relation, "Retry needed");
});

test("notebook backup round trip preserves screenshots, personal notes and unpositioned levels", () => {
  const saved = decision();
  saved.analysis.levels[0] = { ...saved.analysis.levels[0], source: "USER_VERIFIED", x: Number.NaN, y: Number.NaN, x2: Number.NaN, y2: Number.NaN };
  const restored = parseNotebookBackup(createNotebookBackup([saved], ["Wait for confirmation"]));
  assert.deepEqual(restored.decisions[0].notebook, saved.notebook);
  assert.deepEqual(restored.decisions[0].sourceImages, saved.sourceImages);
  assert.deepEqual(restored.decisions[0].analysis, saved.analysis);
  assert.equal(restored.decisions[0].image, png);
  assert.deepEqual(restored.rules, ["Wait for confirmation"]);
});

test("restore rejects remote image URLs, malformed records and unsupported versions before writing", () => {
  const backup = JSON.parse(createNotebookBackup([decision()], []));
  backup.decisions[0].image = "https://tracker.invalid/image";
  assert.throws(() => parseNotebookBackup(JSON.stringify(backup)), /supported/);
  backup.decisions[0] = decision(); backup.version = 2;
  assert.throws(() => parseNotebookBackup(JSON.stringify(backup)), /supported/);
  backup.version = 1; backup.decisions[0].analysis.nextSequence = null;
  assert.throws(() => parseNotebookBackup(JSON.stringify(backup)), /supported/);
});

test("restoring collisions preserves both versions; exact duplicates are skipped", () => {
  const saved = decision();
  const changed = { ...saved, notebook: { ...saved.notebook!, lesson: "A different lesson" } };
  assert.deepEqual(mergeNotebook([saved], [saved], () => "copy"), { added: [], skipped: 1 });
  const merged = mergeNotebook([saved], [changed], () => "copy");
  assert.equal(merged.added[0].id, "copy");
  assert.equal(saved.notebook?.lesson, "Wait for the retest");
});

test("notebook filters use personal lessons and patterns without inferring a trade outcome", () => {
  assert.equal(notebookMatches(decision(), "retest", "", "", "lesson"), true);
  assert.equal(notebookMatches(decision(), "breakout", "", "", "waiting"), true);
  assert.equal(notebookMatches(decision(), "", "Different instrument", "", ""), false);
  assert.equal(notebookMatches(decision(), "", "", "", "reviewed"), false);
});
