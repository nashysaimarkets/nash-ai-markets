import assert from "node:assert/strict";
import test from "node:test";
import type { EconomicReleaseProvider, ScalarObservationProvider } from "../app/lib/providers/official/contracts.ts";
import { aggregateOfficialObservations } from "../app/lib/providers/official/observations.ts";
import {
  createUnavailableMacroContext,
  getVerifiedMacroContext,
} from "../app/lib/verified-macro-context.ts";
import {
  blsReleaseFixture,
  federalReserveBroadDollarFixture,
  treasury10YearFixture,
} from "./fixtures/macro-data.ts";

function observationProvider(name: string, observations: unknown[]): ScalarObservationProvider {
  return {
    name,
    async fetchObservations() {
      return observations as never;
    },
  };
}

function releaseProvider(name: string, releases: unknown[]): EconomicReleaseProvider {
  return {
    name,
    async fetchUpcomingReleases() {
      return releases as never;
    },
  };
}

test("aggregateOfficialObservations isolates failing providers without erasing successful rows", async () => {
  const failing: ScalarObservationProvider = {
    name: "Federal Reserve Board",
    async fetchObservations() {
      throw new Error("down");
    },
  };
  const result = await aggregateOfficialObservations([
    observationProvider("U.S. Department of the Treasury", [treasury10YearFixture]),
    failing,
  ]);
  assert.deepEqual(result.successfulProviders, ["U.S. Department of the Treasury"]);
  assert.deepEqual(result.failedProviders, ["Federal Reserve Board"]);
  assert.equal(result.observations.length, 1);
  assert.equal(result.observations[0]?.metric, "US10Y");
});

test("getVerifiedMacroContext assembles official sources without market snapshot metrics", async () => {
  const inWindowRelease = {
    ...blsReleaseFixture,
    id: "bls-employment-situation-2026-08",
    scheduledAt: "2026-08-20T12:30:00.000Z",
  };
  const context = await getVerifiedMacroContext({
    now: () => Date.parse("2026-08-11T12:00:00.000Z"),
    route: "/test",
    providers: {
      observationProviders: [
        observationProvider("U.S. Department of the Treasury", [treasury10YearFixture]),
        observationProvider("Federal Reserve Board", [federalReserveBroadDollarFixture]),
        observationProvider("U.S. Bureau of Labor Statistics", []),
      ],
      releaseProviders: [
        releaseProvider("U.S. Bureau of Labor Statistics", [inWindowRelease]),
        releaseProvider("U.S. Bureau of Economic Analysis", []),
        releaseProvider("Federal Reserve Board", []),
      ],
    },
  });

  assert.equal(context.status, "complete");
  assert.equal(context.observations.some((row) => (row.metric as string) === "ES"), false);
  assert.equal(context.observations.some((row) => (row.metric as string) === "VIX"), false);
  assert.deepEqual(context.filings, []);
  assert.deepEqual(context.availableSources, ["BEA", "BLS", "Federal Reserve", "Treasury"]);
  assert.deepEqual(context.unavailableSources, ["SEC"]);
  assert.equal(context.releases.length, 1);
});

test("getVerifiedMacroContext never throws when all providers fail", async () => {
  const context = await getVerifiedMacroContext({
    now: () => Date.parse("2026-08-11T12:00:00.000Z"),
    providers: {
      observationProviders: [
        {
          name: "U.S. Department of the Treasury",
          async fetchObservations() {
            throw new Error("boom");
          },
        },
      ],
      releaseProviders: [
        {
          name: "U.S. Bureau of Labor Statistics",
          async fetchUpcomingReleases() {
            throw new Error("boom");
          },
        },
      ],
    },
  });

  assert.equal(context.status, "unavailable");
  assert.deepEqual(context.observations, []);
  assert.deepEqual(context.releases, []);
});

test("createUnavailableMacroContext never includes market snapshot metrics", () => {
  const context = createUnavailableMacroContext(Date.parse("2026-08-11T12:00:00.000Z"));
  assert.equal(context.status, "unavailable");
  assert.equal(context.observations.some((row) => (row.metric as string) === "ES"), false);
});
