import test from "node:test";
import assert from "node:assert/strict";
import {
  acceptWorkspaceReport, readWorkspaceImage, sameWorkspaceFacts, updateWorkspaceConfirmation,
  updateWorkspacePreflight, workspaceContext, workspaceSlotLabel, workspaceSlotTimeframe, type WorkspaceSource,
} from "../app/pocket-next/workspace-state.ts";
import type { ChartConfirmation } from "../app/pocket/chart-preflight.ts";

type Report = { direction: "BULLISH" | "BEARISH" | "NEUTRAL" };
const facts: ChartConfirmation = { instrument: "US 500", timeframe: "5m", currentPrice: "7000.5", contextMatch: "NOT_PROVIDED" };
const report: Report = { direction: "BULLISH" };
const source = (changes: Partial<WorkspaceSource<Report>> = {}): WorkspaceSource<Report> => ({
  image: "data:image/png;base64,original", revision: 1, confirmation: { ...facts }, status: "LOCKED",
  analysis: null, runState: "RUNNING", message: "", reportRevision: 0, ...changes,
});

test("completion is accepted only for the same locked source, preserving independent slots", () => {
  const primary = source(), secondary = source({ revision: 3, analysis: { direction: "BEARISH" }, runState: "COMPLETE" });
  const slots = [primary, secondary];
  const next = slots.map((slot, index) => index === 0 ? acceptWorkspaceReport(slot, 1, facts, report) : slot);
  assert.equal(next[0].analysis, report);
  assert.equal(next[0].runState, "COMPLETE");
  assert.equal(next[0].reportRevision, 1);
  assert.equal(next[1], secondary);
  assert.equal(primary.analysis, null, "the original source remains immutable");
});

test("a late report cannot resurrect a cancelled request or replace newer image results", () => {
  for (const slot of [source({ runState: "CANCELLED" }), source({ image: "replacement", revision: 2 }), source({ image: null }), source({ status: "AWAITING_CONFIRMATION" })]) {
    assert.equal(acceptWorkspaceReport(slot, 1, facts, report), slot);
  }
});

test("changing any confirmed fact rejects the old report even when image revision is unchanged", () => {
  for (const confirmation of [{ ...facts, timeframe: "30m" }, { ...facts, instrument: "GBP/USD" }, { ...facts, currentPrice: "7001" }, { ...facts, contextMatch: "MATCHED" as const }]) {
    const slot = source({ confirmation });
    assert.equal(sameWorkspaceFacts(facts, confirmation), false);
    assert.equal(acceptWorkspaceReport(slot, 1, facts, report), slot);
  }
});

test("unlocking or replacing facts drops the old report and never relabels its evidence", () => {
  const completed = source({ analysis: report, runState: "COMPLETE" });
  const unlocked = updateWorkspacePreflight(completed, 1, "AWAITING_CONFIRMATION");
  assert.equal(unlocked.analysis, null);
  assert.equal(unlocked.confirmation, null);
  assert.equal(workspaceSlotLabel(unlocked), "CONFIRM FACTS");
  const corrected = updateWorkspaceConfirmation(completed, 1, { ...facts, timeframe: "1h" });
  assert.equal(corrected.analysis, null);
  assert.equal(corrected.confirmation?.timeframe, "1h");
});

test("callbacks for an obsolete slot revision cannot alter current facts or report", () => {
  const slot = source({ revision: 2, analysis: report, runState: "COMPLETE" });
  assert.equal(updateWorkspacePreflight(slot, 1, "CHECKING"), slot);
  assert.equal(updateWorkspaceConfirmation(slot, 1, null), slot);
});

test("slot status distinguishes checking, ready, cancelled, error and absent evidence", () => {
  assert.equal(workspaceSlotLabel(source({ image: null })), "ADD CHART");
  assert.equal(workspaceSlotLabel(source({ status: "CHECKING", runState: "IDLE", confirmation: null })), "CHECKING");
  assert.equal(workspaceSlotLabel(source({ runState: "IDLE" })), "READY TO SCAN");
  assert.equal(workspaceSlotLabel(source()), "ANALYSING");
  assert.equal(workspaceSlotLabel(source({ runState: "CANCELLED" })), "CANCELLED");
  assert.equal(workspaceSlotLabel(source({ runState: "ERROR" })), "ERROR");
  assert.equal(workspaceSlotLabel(source({ runState: "IDLE", status: "UNAVAILABLE" })), "CONFIRM FACTS");
  assert.equal(workspaceSlotLabel(source({ runState: "IDLE", status: "RETAKE" })), "RETAKE");
});

test("demo selector uses its actual synthetic timeframe while real unconfirmed slots remain suggestions", () => {
  const demo = { status: "IDLE" as const, confirmation: null, analysis: { timeframe: "15m" } };
  assert.equal(workspaceSlotTimeframe(demo, "5m", true), "15m");
  assert.equal(workspaceSlotTimeframe(demo, "5m", false), "5m SLOT");
  assert.equal(workspaceSlotTimeframe({ ...demo, status: "LOCKED", confirmation: { ...facts, timeframe: "30m" } }, "5m"), "30m");
  assert.equal(workspaceSlotTimeframe({ ...demo, analysis: null }, "5m", true), "DEMO");
  assert.equal(demo.confirmation, null, "demo metadata never becomes confirmed chart facts");
});

test("cross-timeframe conflicts are shown only for confirmed same-instrument reports", () => {
  const first = source({ analysis: report, runState: "COMPLETE" });
  const second = source({ analysis: { direction: "BEARISH" }, confirmation: { ...facts, timeframe: "1h" }, runState: "COMPLETE" });
  assert.match(workspaceContext([first, second]), /Timeframe conflict/);
  assert.match(workspaceContext([first, { ...second, confirmation: { ...facts, instrument: "GBP/USD" } }]), /Different instrument labels/);
  assert.match(workspaceContext([first, { ...second, status: "AWAITING_CONFIRMATION" }]), /second confirmed report/);
  assert.match(workspaceContext([first, { ...second, confirmation: facts }]), /share a timeframe label/);
  assert.match(workspaceContext([first, { ...second, analysis: { direction: "NEUTRAL" } }]), /Price confluence remains unverified/);
});

test("invalid image type, empty and oversized files fail before any reading or replacement", async () => {
  await assert.rejects(readWorkspaceImage(new File(["data"], "wrong.txt", { type: "text/plain" })), /JPEG, PNG or WebP/);
  await assert.rejects(readWorkspaceImage(new File([], "empty.png", { type: "image/png" })), /non-empty/);
  const oversized = { type: "image/png", size: 8 * 1024 * 1024 + 1 } as File;
  await assert.rejects(readWorkspaceImage(oversized), /under 8 MB/);
});

test("decoded image validation rejects corrupt and oversized rasters before source replacement", async t => {
  let broken = false, huge = false;
  const descriptors = new Map(["FileReader", "Image"].map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
  class Reader {
    result: string | null = null;
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    onabort: (() => void) | null = null;
    readAsDataURL() { this.result = "data:image/png;base64,decoded"; queueMicrotask(() => this.onload?.()); }
  }
  class Raster {
    naturalWidth = 1200;
    naturalHeight = 720;
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    set src(_value: string) { if (huge) this.naturalWidth = this.naturalHeight = 5000; queueMicrotask(() => broken ? this.onerror?.() : this.onload?.()); }
  }
  Object.defineProperty(globalThis, "FileReader", { configurable: true, writable: true, value: Reader });
  Object.defineProperty(globalThis, "Image", { configurable: true, writable: true, value: Raster });
  t.after(() => { for (const [name, descriptor] of descriptors) { if (descriptor) Object.defineProperty(globalThis, name, descriptor); else Reflect.deleteProperty(globalThis, name); } });
  const file = new File(["source"], "chart.png", { type: "image/png" });
  assert.equal(await readWorkspaceImage(file), "data:image/png;base64,decoded");
  const previous = source({ analysis: report, runState: "COMPLETE" });
  broken = true;
  await assert.rejects(readWorkspaceImage(file), /could not be decoded/);
  assert.equal(previous.analysis, report, "failed reads do not mutate the existing workspace source");
  broken = false; huge = true;
  await assert.rejects(readWorkspaceImage(file), /16 megapixels/);
});
