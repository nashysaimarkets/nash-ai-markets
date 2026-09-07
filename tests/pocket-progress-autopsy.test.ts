import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { buildDecisionTimeline } from "../app/pocket/decision-timeline.ts";
import { formatPocketElapsed, pocketScanStageCopy, pocketScanStageIndex } from "../app/pocket/scan-progress.ts";

test("scan progress reports real phases and elapsed time without a guessed countdown", () => {
  assert.equal(pocketScanStageIndex("PREPARING"), 0);
  assert.equal(pocketScanStageIndex("FINALISING"), 4);
  assert.equal(pocketScanStageCopy("VERIFYING").title, "VERIFYING LEVELS & LIQUIDITY");
  assert.equal(formatPocketElapsed(0), "0:00");
  assert.equal(formatPocketElapsed(117.9), "1:57");
});

test("an unreviewed saved decision exposes the next timeline action without inventing an outcome", () => {
  const events = buildDecisionTimeline({
    createdAt: "2026-09-07T08:00:00.000Z",
    intention: "UNSURE",
    analysis: { verdict: "WAIT", verdictHeadline: "Wait for confirmation.", setupScore: { overall: 62, grade: "C" } },
  });
  assert.deepEqual(events.map((event) => event.state), ["COMPLETE", "WAITING", "WAITING", "WAITING"]);
  assert.equal(events[0].headline, "BLIND · GRADE C · 62/100");
  assert.match(events[3].headline, /NOT REVIEWED/);
  assert.doesNotMatch(events[3].detail, /profit|loss/i);
});

test("a completed autopsy connects original evidence, visible change and process outcome", () => {
  const events = buildDecisionTimeline({
    createdAt: "2026-09-07T08:00:00.000Z",
    reviewedAt: "2026-09-07T10:00:00.000Z",
    intention: "LONG",
    afterImage: "data:image/jpeg;base64,AFTER",
    analysis: { verdict: "WATCH", verdictHeadline: "Reclaim resistance first.", setupScore: { overall: 74, grade: "B" } },
    review: {
      outcome: "LOSS",
      processGrade: "B",
      headline: "The read was sound but confirmation was early.",
      thesisStatus: "FAILED",
      structureShift: "WEAKENED",
      evidenceChanges: [{ impact: "INVALIDATED" }, { impact: "WEAKENED" }],
    },
  });
  assert.deepEqual(events.map((event) => event.id), ["locked", "later-chart", "evidence-change", "outcome"]);
  assert.ok(events.every((event) => event.state === "COMPLETE"));
  assert.match(events[2].headline, /2 visible evidence changes · WEAKENED/);
  assert.equal(events[3].headline, "LOSS · PROCESS GRADE B");
});

test("the client advances progress at actual processing boundaries and alerts only after success", async () => {
  const client = await readFile(new URL("../app/pocket/PocketBullseye.tsx", import.meta.url), "utf8");
  for (const stage of ["PREPARING", "MEASURING", "SECOND_OPINION", "VERIFYING", "FINALISING"]) {
    assert.match(client, new RegExp(`setScanStage\\(\"${stage}\"\\)`));
  }
  assert.match(client, /notifyPocketAnalysisReady\(nextAnalysis\.instrument\)/);
  assert.match(client, /Notification\.permission === "granted"/);
  assert.doesNotMatch(client, /Notification\.requestPermission/);
  assert.match(client, /This is elapsed time—not a guessed countdown/);
});

