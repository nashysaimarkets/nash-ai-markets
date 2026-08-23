import assert from "node:assert/strict";
import test from "node:test";
import {
  DATA_FRESHNESS_STATES,
  ECONOMIC_RELEASE_AGENCIES,
  MACRO_METRICS,
} from "../app/lib/macro-data.ts";
import {
  federalReserveBroadDollarFixture,
  macroContextFixture,
  treasury10YearFixture,
} from "./fixtures/macro-data.ts";

test("macro contracts expose the approved provider-neutral metric identities", () => {
  assert.deepEqual(MACRO_METRICS, [
    "US2Y",
    "US10Y",
    "US30Y",
    "FED_BROAD_DOLLAR",
    "EFFR",
    "SOFR",
    "CPI",
    "CORE_CPI",
    "PAYROLLS",
    "UNEMPLOYMENT",
    "PPI",
    "JOLTS",
    "GDP",
    "PCE",
    "PERSONAL_INCOME",
    "RETAIL_SALES",
    "HOUSING",
    "DURABLE_GOODS",
    "TRADE",
  ]);
  assert.deepEqual(DATA_FRESHNESS_STATES, [
    "CURRENT",
    "DAILY",
    "SCHEDULED",
    "STALE",
    "UNAVAILABLE",
  ]);
  assert.deepEqual(ECONOMIC_RELEASE_AGENCIES, ["BLS", "BEA", "CENSUS", "FED"]);
});

test("official observations retain their own observation and retrieval timestamps", () => {
  assert.equal(treasury10YearFixture.freshness, "DAILY");
  assert.notEqual(treasury10YearFixture.observationAt, treasury10YearFixture.retrievedAt);
  assert.match(treasury10YearFixture.source.attribution, /U\.S\. Department of the Treasury/);
});

test("Federal Reserve broad-dollar context cannot masquerade as DXY", () => {
  assert.equal(federalReserveBroadDollarFixture.metric, "FED_BROAD_DOLLAR");
  assert.notEqual(federalReserveBroadDollarFixture.metric as string, "DXY");
  assert.match(federalReserveBroadDollarFixture.source.attribution, /Not DXY/);
});

test("partial macro context represents independent source availability without market data", () => {
  assert.equal(macroContextFixture.status, "partial");
  assert.deepEqual(macroContextFixture.availableSources, ["Treasury", "Federal Reserve", "BLS", "BEA"]);
  assert.deepEqual(macroContextFixture.unavailableSources, ["Census", "SEC"]);
  assert.equal(macroContextFixture.observations.some((row) => (row.metric as string) === "ES"), false);
  assert.equal(macroContextFixture.observations.some((row) => (row.metric as string) === "VIX"), false);
});
