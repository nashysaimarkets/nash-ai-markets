import assert from "node:assert/strict";
import test from "node:test";
import {
  BEA_API_ENDPOINT,
  BEA_ATTRIBUTION,
  BEA_PROVIDER_NAME,
  BEA_RELEASE_DATES_ENDPOINT,
  createBeaObservationProvider,
  createBeaReleaseCalendarProvider,
  normalizeBeaNipaPayloads,
  normalizeBeaReleaseDates,
} from "../app/lib/providers/official/bea.ts";
import { aggregateOfficialEconomicCalendar } from "../app/lib/providers/official/economic-calendar.ts";
import { BEA_GDP_FIXTURE, BEA_INCOME_FIXTURE, BEA_RELEASE_FIXTURE } from "./fixtures/bea.ts";

const RETRIEVED = "2026-08-11T18:00:00.000Z";

test("normalizes GDP, PCE and personal income with distinct metric identities", () => {
  const rows = normalizeBeaNipaPayloads(BEA_GDP_FIXTURE, BEA_INCOME_FIXTURE, RETRIEVED);
  assert.deepEqual(rows.map((row) => row.metric), ["GDP", "PCE", "PERSONAL_INCOME"]);
  assert.deepEqual(rows.map((row) => row.value), [2.4, 20811.5, 26010.2]);
  assert.equal(rows.every((row) => row.source.agency === BEA_PROVIDER_NAME), true);
  assert.equal(rows.every((row) => row.source.attribution === BEA_ATTRIBUTION), true);
});

test("preserves observation period separately from retrieval time", () => {
  const rows = normalizeBeaNipaPayloads(BEA_GDP_FIXTURE, BEA_INCOME_FIXTURE, RETRIEVED);
  const gdp = rows.find((row) => row.metric === "GDP");
  const pce = rows.find((row) => row.metric === "PCE");
  assert.equal(gdp?.observationAt, "2026-04-01T00:00:00.000Z");
  assert.equal(pce?.observationAt, "2026-06-01T00:00:00.000Z");
  assert.equal(rows.every((row) => row.retrievedAt === RETRIEVED), true);
  assert.equal(rows.every((row) => row.freshness === "DAILY"), true);
});

test("malformed or missing BEA rows fail closed per metric", () => {
  const bad = structuredClone(BEA_INCOME_FIXTURE);
  bad.BEAAPI.Results.Data[0]!.DataValue = "not-a-number";
  bad.BEAAPI.Results.Data[1]!.DataValue = "not-a-number";
  const rows = normalizeBeaNipaPayloads(BEA_GDP_FIXTURE, bad, RETRIEVED);
  assert.equal(rows.some((row) => row.metric === "GDP"), true);
  assert.equal(rows.some((row) => row.metric === "PERSONAL_INCOME"), false);
});

test("BEA observation provider uses official API and fails closed on API failure", async () => {
  const urls: string[] = [];
  const provider = createBeaObservationProvider({
    apiKey: "test-key",
    now: () => Date.parse(RETRIEVED),
    fetchImpl: async (input) => {
      const url = String(input);
      urls.push(url);
      if (url.includes("T10101")) return Response.json(BEA_GDP_FIXTURE);
      return new Response("down", { status: 503 });
    },
  });
  const rows = await provider.fetchObservations();
  assert.deepEqual(rows.map((row) => row.metric), ["GDP"]);
  assert.equal(urls.every((url) => url.startsWith(BEA_API_ENDPOINT)), true);
});

test("normalizes official BEA release dates including trade with calibrated impact", () => {
  const rows = normalizeBeaReleaseDates(
    BEA_RELEASE_FIXTURE,
    new Date("2026-08-20T00:00:00Z"),
    new Date("2026-08-30T00:00:00Z"),
  );
  assert.deepEqual(rows.map((row) => row.name), ["U.S. International Trade in Goods and Services", "Gross Domestic Product", "Personal Income and Outlays"]);
  assert.equal(rows.every((row) => row.agency === "BEA"), true);
  assert.equal(rows.find((row) => row.name.startsWith("U.S. International Trade"))?.risk, "MED");
  assert.equal(rows.filter((row) => !row.name.startsWith("U.S. International Trade")).every((row) => row.risk === "HIGH"), true);
  assert.equal(rows.every((row) => row.sourceUrl === BEA_RELEASE_DATES_ENDPOINT), true);
});

test("BEA calendar provider failure does not erase another successful calendar provider", async () => {
  const failing = createBeaReleaseCalendarProvider({ fetchImpl: async () => { throw new Error("down"); } });
  const other = { name: "BLS", async fetchUpcomingReleases() { return [{
    id: "bls", name: "Employment Situation", agency: "BLS" as const,
    scheduledAt: "2026-08-21T12:30:00.000Z", risk: "HIGH" as const,
    sourceUrl: "https://www.bls.gov/",
  }]; } };
  const result = await aggregateOfficialEconomicCalendar(
    [failing, other], new Date("2026-08-20T00:00:00Z"), new Date("2026-08-30T00:00:00Z"),
  );
  assert.equal(result.releases.length, 1);
  assert.equal(result.releases[0]?.agency, "BLS");
});
