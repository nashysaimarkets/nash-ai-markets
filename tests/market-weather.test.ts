import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { analyzeMarketSnapshot } from "../app/lib/market-intelligence-engine.ts";
import { createUnavailableSnapshot } from "../app/lib/market-data.ts";
import { createTradingDecision } from "../app/lib/trading-decision-engine.ts";
import { createStructuredTradePlan } from "../app/lib/structured-trade-planner.ts";
import { readSessionClock } from "../app/terminal/lib/session-clock.ts";
import { buildDecisionDesk } from "../app/dashboard/lib/decision-desk.ts";
import {
  buildDeskGreeting,
  buildMarketScore,
  buildMarketWeather,
  buildOpportunityRadar,
} from "../app/dashboard/lib/market-weather.ts";

const read = (path: string) => readFile(new URL(path, import.meta.url), "utf8");

function closedDesk() {
  const snapshot = createUnavailableSnapshot();
  const intelligence = analyzeMarketSnapshot(snapshot);
  const decision = createTradingDecision({
    intelligence,
    reasoning: intelligence.reasoning,
    dataStatus: snapshot.status,
    providerStatus: "offline",
    dataAgeMs: null,
    fallbackActive: false,
    missingDataWarnings: intelligence.reasoning.missingDataWarnings,
  });
  const plan = createStructuredTradePlan({
    decision,
    intelligence,
    dataStatus: snapshot.status,
    providerStatus: "offline",
    dataAgeMs: null,
    fallbackActive: false,
    missingDataWarnings: intelligence.reasoning.missingDataWarnings,
  });
  const desk = buildDecisionDesk({
    verified: false,
    decision,
    plan,
    intelligence,
    session: readSessionClock(new Date("2026-07-28T15:00:00Z")),
    candles: null,
    expectedMoveLabel: "Expected move awaits a verified candle range",
    support: null,
    resistance: null,
  });
  return { desk, intelligence };
}

test("Market Weather fails closed without inventing conditions", () => {
  const { desk, intelligence } = closedDesk();
  const weather = buildMarketWeather({ desk, intelligence });
  assert.equal(weather.verified, false);
  assert.equal(weather.trend.label, "Neutral");
  assert.equal(weather.tradingConditions.label, "Poor");
  assert.match(weather.momentum.detail, /until verified|incomplete|withheld|clear/i);
  assert.doesNotMatch(JSON.stringify(weather), /CRITICAL_INPUT_MISSING|\bNULL\b|Undefined/);
});

test("Opportunity Radar stands aside when engines cannot confirm", () => {
  const { desk } = closedDesk();
  const radar = buildOpportunityRadar(desk);
  assert.equal(radar.available, false);
  assert.equal(radar.headline, "No verified opportunity currently available");
  assert.equal(radar.direction, "Stand Aside");
  assert.equal(radar.rating, 0);
  assert.equal(radar.probability, "None");
});

test("Market Score stays blank until verified and greeting is session-aware", () => {
  const { desk, intelligence } = closedDesk();
  const weather = buildMarketWeather({ desk, intelligence });
  const score = buildMarketScore({ desk, intelligence, weather });
  assert.equal(score.score, null);
  assert.match(score.summary, /blank|verified/i);

  const pre = buildDeskGreeting(
    "chris@example.com",
    readSessionClock(new Date("2026-07-28T10:00:00Z")),
    new Date("2026-07-28T10:00:00Z"),
  );
  assert.equal(pre.name, "Chris");
  assert.match(pre.salutation, /Good (morning|afternoon|evening)/);
  assert.ok(pre.subtitle.length > 10);
});

test("Weather and Radar ship under MCC without changing Decision Desk logic", async () => {
  const [page, centre, weatherLib, deskLib] = await Promise.all([
    read("../app/dashboard/page.tsx"),
    read("../app/dashboard/components/MarketCommandCentre.tsx"),
    read("../app/dashboard/lib/market-weather.ts"),
    read("../app/dashboard/lib/decision-desk.ts"),
  ]);
  assert.match(page, /buildMarketWeather|buildOpportunityRadar|buildMarketScore|buildDeskGreeting/);
  assert.match(centre, /MarketWeatherPanel/);
  assert.match(centre, /DecisionDesk/);
  assert.match(weatherLib, /No verified opportunity currently available/);
  assert.match(deskLib, /No verified high-probability setup currently available/);
  assert.doesNotMatch(page, /Good trading day/);
  assert.match(centre, /greeting\.salutation/);
});
