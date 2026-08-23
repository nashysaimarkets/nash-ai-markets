import assert from "node:assert/strict";
import test from "node:test";
import {
  BLS_API_ENDPOINT,
  BLS_ATTRIBUTION,
  BLS_CALENDAR_ENDPOINT,
  BLS_PROVIDER_NAME,
  BLS_SERIES,
  createBlsObservationProvider,
  createBlsReleaseCalendarProvider,
  normalizeBlsApiPayload,
  normalizeBlsCalendarIcs,
} from "../app/lib/providers/official/bls.ts";
import { aggregateOfficialEconomicCalendar } from "../app/lib/providers/official/economic-calendar.ts";
import { BLS_API_FIXTURE, BLS_CALENDAR_ICS } from "./fixtures/bls.ts";

const RETRIEVED_AT = "2026-08-11T18:30:00.000Z";

test("uses the exact approved BLS series identities", () => {
  assert.deepEqual(BLS_SERIES, {
    CPI: "CUSR0000SA0",
    CORE_CPI: "CUSR0000SA0L1E",
    PAYROLLS: "CES0000000001",
    UNEMPLOYMENT: "LNS14000000",
    PPI: "WPSFD4",
    JOLTS: "JTS000000000000000JOL",
  });
});

test("normalizes CPI, Core CPI, payrolls, unemployment, PPI and JOLTS without substitution", () => {
  const rows = normalizeBlsApiPayload(BLS_API_FIXTURE, RETRIEVED_AT);
  assert.deepEqual(rows.map((row) => row.metric), [
    "CPI", "CORE_CPI", "PAYROLLS", "UNEMPLOYMENT", "PPI", "JOLTS",
  ]);
  assert.deepEqual(rows.map((row) => row.value), [323.048, 331.207, 159539, 4.2, 149.7, 7437]);
  assert.deepEqual(rows.map((row) => row.unit), ["index", "index", "thousands", "%", "index", "thousands"]);
});

test("preserves BLS observation month separately from retrieval time and attribution", () => {
  const rows = normalizeBlsApiPayload(BLS_API_FIXTURE, RETRIEVED_AT);
  const cpi = rows.find((row) => row.metric === "CPI");
  assert.equal(cpi?.observationAt, "2026-07-01T00:00:00.000Z");
  assert.equal(cpi?.retrievedAt, RETRIEVED_AT);
  assert.notEqual(cpi?.observationAt, cpi?.retrievedAt);
  assert.equal(rows.every((row) => row.freshness === "DAILY"), true);
  assert.equal(rows.every((row) => row.source.agency === BLS_PROVIDER_NAME), true);
  assert.equal(rows.every((row) => row.source.attribution === BLS_ATTRIBUTION), true);
});

test("malformed or missing series values fail closed per series", () => {
  const payload = structuredClone(BLS_API_FIXTURE);
  payload.Results.series[0]!.data[0]!.value = "not-a-number";
  payload.Results.series[1]!.data = [];
  const rows = normalizeBlsApiPayload(payload, RETRIEVED_AT);
  assert.equal(rows.some((row) => row.metric === "CPI"), false);
  assert.equal(rows.some((row) => row.metric === "CORE_CPI"), false);
  assert.equal(rows.some((row) => row.metric === "PAYROLLS"), true);
});

test("BLS API failure returns no fabricated values and needs no API key", async () => {
  let requestBody = "";
  const provider = createBlsObservationProvider({
    now: () => Date.parse(RETRIEVED_AT),
    fetchImpl: async (input, init) => {
      assert.equal(String(input), BLS_API_ENDPOINT);
      requestBody = String(init?.body ?? "");
      return new Response("unavailable", { status: 503 });
    },
  });
  assert.deepEqual(await provider.fetchObservations(), []);
  const body = JSON.parse(requestBody);
  assert.deepEqual(body.seriesid, Object.values(BLS_SERIES));
  assert.equal("registrationkey" in body, false);
});

test("normalizes only relevant official BLS calendar releases and preserves timestamps/provenance", () => {
  const releases = normalizeBlsCalendarIcs(
    BLS_CALENDAR_ICS,
    new Date("2026-08-11T00:00:00.000Z"),
    new Date("2026-09-05T00:00:00.000Z"),
  );
  assert.deepEqual(releases.map((release) => release.name), [
    "Consumer Price Index",
    "Producer Price Index",
    "Job Openings and Labor Turnover Survey",
    "Employment Situation",
  ]);
  assert.equal(releases[0]?.scheduledAt, "2026-08-12T12:30:00.000Z");
  assert.equal(releases[0]?.agency, "BLS");
  assert.equal(releases[0]?.risk, "HIGH");
  assert.equal(releases[0]?.sourceUrl, BLS_CALENDAR_ENDPOINT);
});

test("BLS calendar provider failure returns empty releases", async () => {
  const provider = createBlsReleaseCalendarProvider({
    fetchImpl: async () => new Response("no", { status: 500 }),
  });
  assert.deepEqual(
    await provider.fetchUpcomingReleases(
      new Date("2026-08-11T00:00:00.000Z"),
      new Date("2026-09-05T00:00:00.000Z"),
    ),
    [],
  );
});

test("BLS provider failure does not erase another successful Phase 3 calendar provider", async () => {
  const failingBls = createBlsReleaseCalendarProvider({
    fetchImpl: async () => { throw new Error("network down"); },
  });
  const other = {
    name: "Other official provider",
    async fetchUpcomingReleases() {
      return [{
        id: "other-release",
        name: "Other Release",
        agency: "BEA" as const,
        scheduledAt: "2026-08-14T12:30:00.000Z",
        risk: "HIGH" as const,
        sourceUrl: "https://www.bea.gov/",
      }];
    },
  };
  const result = await aggregateOfficialEconomicCalendar(
    [failingBls, other],
    new Date("2026-08-11T00:00:00.000Z"),
    new Date("2026-08-20T00:00:00.000Z"),
  );
  assert.equal(result.releases.length, 1);
  assert.equal(result.releases[0]?.id, "other-release");
});
