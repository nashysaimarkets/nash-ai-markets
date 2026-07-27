import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { summarizeBriefChanges } from "../app/lib/brief-change-summary.ts";
import type {
  AnalysisSnapshotPayload,
  StoredAnalysisSnapshot,
} from "../app/lib/market-analysis-snapshot.ts";
import { weeklyProcessReview } from "../app/lib/weekly-process-review.ts";

const read = (path: string) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

function payload(overrides: {
  posture?: string;
  risk?: string;
  permission?: string;
  status?: string;
  quote?: string;
} = {}) {
  return {
    market: {
      status: overrides.status ?? "DELAYED",
      quotes: [{ symbol: "ES", value: overrides.quote ?? "5,000", change: "+0.1%" }],
    },
    decision: {
      riskRating: overrides.risk ?? "medium",
      tradePermission: overrides.permission ?? "caution",
      confidenceScore: 55,
    },
    plan: { directionalPosture: overrides.posture ?? "stand-aside" },
    gateway: { connectionStatus: "connected" },
  } as unknown as AnalysisSnapshotPayload;
}

test("What changed compares only a preserved earlier snapshot", () => {
  const previous = {
    session_date: "2026-07-24",
    payload: payload({ posture: "stand-aside", quote: "4,980" }),
  } as StoredAnalysisSnapshot;
  const summary = summarizeBriefChanges(previous, payload({ posture: "trend-following", quote: "5,000" }));

  assert.equal(summary.available, true);
  assert.equal(summary.previousSessionDate, "2026-07-24");
  assert.equal(summary.stateChanges.find((item) => item.label === "Posture")?.changed, true);
  assert.deepEqual(summary.quoteChanges.map((item) => item.label), ["ES"]);
  assert.match(summary.headline, /preserved conditions changed/);

  const unavailable = summarizeBriefChanges(null, payload());
  assert.equal(unavailable.available, false);
  assert.match(unavailable.headline, /prior preserved session/);
});

test("weekly review measures recorded process without inventing performance", () => {
  const review = weeklyProcessReview([
    {
      traded_at: "2026-07-20T08:00:00.000Z",
      direction: "neutral",
      followed_plan: true,
      respected_confirmation: true,
      respected_invalidation: null,
    },
    {
      traded_at: "2026-07-21T08:00:00.000Z",
      direction: "long",
      followed_plan: false,
      respected_confirmation: false,
      respected_invalidation: true,
    },
    {
      traded_at: "2026-07-12T08:00:00.000Z",
      direction: "short",
      followed_plan: true,
      respected_confirmation: true,
      respected_invalidation: true,
    },
  ], new Date("2026-07-22T12:00:00.000Z"));

  assert.equal(review.decisions, 2);
  assert.equal(review.standAside, 1);
  assert.equal(review.plan.recorded, 2);
  assert.equal(review.plan.respected, 1);
  assert.match(review.focus, /following the plan/);
  assert.equal("winRate" in review, false);
});

test("Today, Journal and Review complete the member habit loop", async () => {
  const [today, capture, terminal, journal, review, api] = await Promise.all([
    read("app/terminal/components/TodayDecisionBrief.tsx"),
    read("app/terminal/components/DecisionCapture.tsx"),
    read("app/terminal/page.tsx"),
    read("app/journal/page.tsx"),
    read("app/review/page.tsx"),
    read("app/api/journal/route.ts"),
  ]);

  assert.match(today, /What changed\?/);
  assert.match(today, /DecisionCapture/);
  assert.match(terminal, /summarizeBriefChanges/);
  assert.match(terminal, /row\.session_date < currentAnalysis\.payload\.sessionDate/);
  assert.match(capture, /Records the decision only/);
  assert.doesNotMatch(capture, /entryPrice|pnl|positionSize/);
  assert.match(journal, /access\.features\.journal/);
  assert.match(journal, /<JournalForm/);
  assert.match(review, /weeklyProcessReview/);
  assert.match(review, /not a performance claim/);
  assert.match(api, /access\.features\.journal/);
  assert.match(api, /Decision Journal requires NASH Membership/);
});
