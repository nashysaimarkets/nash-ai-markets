import assert from "node:assert/strict";
import test from "node:test";
import type { EconomicReleaseProvider } from "../app/lib/providers/official/contracts.ts";
import { aggregateOfficialEconomicCalendar } from "../app/lib/providers/official/economic-calendar.ts";
import {
  BEA_PCE_RELEASE,
  BLS_PAYROLLS_RELEASE,
  DUPLICATE_PAYROLLS_RELEASE,
  FED_RELEASE,
  OUTSIDE_WINDOW_RELEASE,
  WINDOW_END,
  WINDOW_START,
} from "./fixtures/official-economic-calendar.ts";

function provider(name: string, releases: unknown[]): EconomicReleaseProvider {
  return {
    name,
    async fetchUpcomingReleases() {
      return releases as never;
    },
  };
}

test("combines multiple successful official providers in chronological order", async () => {
  const result = await aggregateOfficialEconomicCalendar(
    [provider("BLS", [BLS_PAYROLLS_RELEASE]), provider("BEA", [BEA_PCE_RELEASE]), provider("Federal Reserve", [FED_RELEASE])],
    WINDOW_START,
    WINDOW_END,
  );
  assert.deepEqual(result.failedProviders, []);
  assert.deepEqual(result.successfulProviders, ["BLS", "BEA", "Federal Reserve"]);
  assert.deepEqual(result.releases.map((release) => release.id), ["fed-minutes", "bea-pce", "bls-payrolls"]);
});

test("isolates one failing provider without erasing successful providers", async () => {
  const failing: EconomicReleaseProvider = {
    name: "BEA",
    async fetchUpcomingReleases() { throw new Error("provider unavailable"); },
  };
  const result = await aggregateOfficialEconomicCalendar(
    [provider("BLS", [BLS_PAYROLLS_RELEASE]), failing],
    WINDOW_START,
    WINDOW_END,
  );
  assert.deepEqual(result.releases, [BLS_PAYROLLS_RELEASE]);
  assert.deepEqual(result.successfulProviders, ["BLS"]);
  assert.deepEqual(result.failedProviders, ["BEA"]);
});

test("returns an empty calendar when all providers fail", async () => {
  const failing = (name: string): EconomicReleaseProvider => ({
    name,
    async fetchUpcomingReleases() { throw new Error("unavailable"); },
  });
  const result = await aggregateOfficialEconomicCalendar(
    [failing("BLS"), failing("BEA")],
    WINDOW_START,
    WINDOW_END,
  );
  assert.deepEqual(result.releases, []);
  assert.deepEqual(result.successfulProviders, []);
  assert.deepEqual(result.failedProviders, ["BLS", "BEA"]);
});

test("deduplicates deterministically by agency, timestamp and normalized event name", async () => {
  const result = await aggregateOfficialEconomicCalendar(
    [provider("primary", [BLS_PAYROLLS_RELEASE]), provider("secondary", [DUPLICATE_PAYROLLS_RELEASE])],
    WINDOW_START,
    WINDOW_END,
  );
  assert.equal(result.releases.length, 1);
  assert.equal(result.releases[0]?.id, "bls-payrolls");
  assert.equal(result.releases[0]?.sourceUrl, BLS_PAYROLLS_RELEASE.sourceUrl);
});

test("preserves agency, scheduled timestamp, risk and source provenance", async () => {
  const result = await aggregateOfficialEconomicCalendar(
    [provider("BLS", [BLS_PAYROLLS_RELEASE])],
    WINDOW_START,
    WINDOW_END,
  );
  assert.deepEqual(result.releases[0], BLS_PAYROLLS_RELEASE);
});

test("fails closed for malformed and outside-window releases", async () => {
  const invalidRows = [
    { ...BLS_PAYROLLS_RELEASE, scheduledAt: "not-a-date" },
    { ...BLS_PAYROLLS_RELEASE, agency: "UNKNOWN" },
    { ...BLS_PAYROLLS_RELEASE, risk: "LOW" },
    { ...BLS_PAYROLLS_RELEASE, sourceUrl: "javascript:bad" },
    { ...BLS_PAYROLLS_RELEASE, name: "" },
    OUTSIDE_WINDOW_RELEASE,
  ];
  const result = await aggregateOfficialEconomicCalendar(
    [provider("mixed", [...invalidRows, BLS_PAYROLLS_RELEASE])],
    WINDOW_START,
    WINDOW_END,
  );
  assert.deepEqual(result.releases, [BLS_PAYROLLS_RELEASE]);
});

test("invalid requested windows fail closed without market-side effects", async () => {
  const result = await aggregateOfficialEconomicCalendar(
    [provider("BLS", [BLS_PAYROLLS_RELEASE])],
    WINDOW_END,
    WINDOW_START,
  );
  assert.deepEqual(result.releases, []);
  assert.deepEqual(result.successfulProviders, []);
  assert.deepEqual(result.failedProviders, ["BLS"]);
  assert.equal("ES" in result, false);
  assert.equal("VIX" in result, false);
  assert.equal("actionable" in result, false);
});
