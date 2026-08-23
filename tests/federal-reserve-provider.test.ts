import assert from "node:assert/strict";
import test from "node:test";
import {
  FED_BROAD_DOLLAR_ATTRIBUTION,
  FED_H10_DAILY_INDEX_CSV,
  FED_MONETARY_POLICY_RSS,
  createFederalReserveDollarProvider,
  createFederalReserveReleaseProvider,
  normalizeFedBroadDollarCsv,
  normalizeFedMonetaryPolicyRss,
} from "../app/lib/providers/official/federal-reserve.ts";
import { aggregateOfficialEconomicCalendar } from "../app/lib/providers/official/economic-calendar.ts";
import { FED_H10_CSV_FIXTURE, FED_MONETARY_RSS_FIXTURE } from "./fixtures/federal-reserve.ts";

const RETRIEVED = "2026-08-11T18:00:00.000Z";

test("normalizes only the H.10 broad dollar series as FED_BROAD_DOLLAR and never DXY", () => {
  const rows = normalizeFedBroadDollarCsv(FED_H10_CSV_FIXTURE, RETRIEVED);
  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.metric, "FED_BROAD_DOLLAR");
  assert.notEqual(rows[0]?.metric as string, "DXY");
  assert.equal(rows[0]?.value, 120.7105);
  assert.equal(rows[0]?.source.attribution, FED_BROAD_DOLLAR_ATTRIBUTION);
  assert.match(rows[0]?.source.attribution ?? "", /Not DXY/);
});

test("preserves H.10 observation date separately from retrieval time", () => {
  const row = normalizeFedBroadDollarCsv(FED_H10_CSV_FIXTURE, RETRIEVED)[0];
  assert.equal(row?.observationAt, "2026-07-24T00:00:00.000Z");
  assert.equal(row?.retrievedAt, RETRIEVED);
  assert.notEqual(row?.observationAt, row?.retrievedAt);
  assert.equal(row?.freshness, "DAILY");
});

test("Fed broad dollar provider fails closed on malformed data or request failure", async () => {
  assert.deepEqual(normalizeFedBroadDollarCsv("DATE,JRXWTFB_N.B\nbad,ND", RETRIEVED), []);
  const provider = createFederalReserveDollarProvider({
    now: () => Date.parse(RETRIEVED),
    fetchImpl: async (input) => {
      assert.equal(String(input), FED_H10_DAILY_INDEX_CSV);
      return new Response("down", { status: 503 });
    },
  });
  assert.deepEqual(await provider.fetchObservations(), []);
});

test("normalizes only published FOMC statement/minutes RSS items with exact publication timestamps", () => {
  const rows = normalizeFedMonetaryPolicyRss(
    FED_MONETARY_RSS_FIXTURE,
    new Date("2026-07-01T00:00:00Z"),
    new Date("2026-07-31T23:59:59Z"),
  );
  assert.deepEqual(rows.map((row) => row.name), ["FOMC Minutes", "FOMC Statement"]);
  assert.equal(rows[0]?.scheduledAt, "2026-07-08T18:00:00.000Z");
  assert.equal(rows[1]?.scheduledAt, "2026-07-29T18:00:00.000Z");
  assert.equal(rows.every((row) => row.agency === "FED"), true);
});

test("Fed release provider failure is isolated by Phase 3 aggregator", async () => {
  const failing = createFederalReserveReleaseProvider({ fetchImpl: async () => { throw new Error("down"); } });
  const other = { name: "BLS", async fetchUpcomingReleases() { return [{
    id: "bls", name: "Employment Situation", agency: "BLS" as const,
    scheduledAt: "2026-07-15T12:30:00.000Z", risk: "HIGH" as const,
    sourceUrl: "https://www.bls.gov/",
  }]; } };
  const result = await aggregateOfficialEconomicCalendar(
    [failing, other], new Date("2026-07-01T00:00:00Z"), new Date("2026-07-31T23:59:59Z"),
  );
  assert.equal(result.releases.length, 1);
  assert.equal(result.releases[0]?.agency, "BLS");
});

test("official Fed endpoints require no API key", async () => {
  const seen: string[] = [];
  const dollar = createFederalReserveDollarProvider({
    fetchImpl: async (input) => { seen.push(String(input)); return new Response(FED_H10_CSV_FIXTURE); },
  });
  const releases = createFederalReserveReleaseProvider({
    fetchImpl: async (input) => { seen.push(String(input)); return new Response(FED_MONETARY_RSS_FIXTURE); },
  });
  await dollar.fetchObservations();
  await releases.fetchUpcomingReleases(new Date("2026-07-01"), new Date("2026-07-31T23:59:59Z"));
  assert.deepEqual(seen, [FED_H10_DAILY_INDEX_CSV, FED_MONETARY_POLICY_RSS]);
  assert.equal(seen.some((url) => /key=|apikey|token/i.test(url)), false);
});
