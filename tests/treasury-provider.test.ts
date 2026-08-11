import assert from "node:assert/strict";
import test from "node:test";
import {
  createTreasuryYieldProvider,
  parseTreasuryYieldCurveXml,
  TREASURY_ATTRIBUTION,
  TREASURY_DATASET_NAME,
  TREASURY_PROVIDER_NAME,
  TREASURY_XML_ENDPOINT,
} from "../app/lib/providers/official/treasury.ts";
import {
  MALFORMED_10Y_TREASURY_XML,
  MISSING_30Y_TREASURY_XML,
  OLDER_TREASURY_YIELD_CURVE_XML,
  VALID_TREASURY_YIELD_CURVE_XML,
} from "./fixtures/treasury-yield-curve.ts";

const RETRIEVED_AT = Date.parse("2026-08-11T12:00:00.000Z");

function providerFor(xml: string, status = 200) {
  let requestedUrl = "";
  const provider = createTreasuryYieldProvider({
    now: () => RETRIEVED_AT,
    fetchImpl: async (input) => {
      requestedUrl = String(input);
      return new Response(xml, {
        status,
        headers: { "content-type": "application/xml" },
      });
    },
  });
  return { provider, requestedUrl: () => requestedUrl };
}

test("uses the official Treasury daily yield-curve XML endpoint", async () => {
  const fixture = providerFor(VALID_TREASURY_YIELD_CURVE_XML);
  await fixture.provider.fetchObservations();

  const requested = new URL(fixture.requestedUrl());
  assert.equal(`${requested.origin}${requested.pathname}`, TREASURY_XML_ENDPOINT);
  assert.equal(requested.searchParams.get("data"), "daily_treasury_yield_curve");
  assert.equal(requested.searchParams.get("field_tdr_date_value"), "2026");
});

test("normalizes the latest complete Treasury row as US2Y, US10Y and US30Y daily observations", async () => {
  const observations = await providerFor(VALID_TREASURY_YIELD_CURVE_XML).provider.fetchObservations();

  assert.deepEqual(observations.map((row) => row.metric), ["US2Y", "US10Y", "US30Y"]);
  assert.deepEqual(observations.map((row) => row.value), [3.72, 4.21, 4.82]);
  assert.equal(observations.every((row) => row.freshness === "DAILY"), true);
  assert.equal(observations.every((row) => row.unit === "%"), true);
});

test("preserves official observation time separately from retrieval time", async () => {
  const observations = await providerFor(VALID_TREASURY_YIELD_CURVE_XML).provider.fetchObservations();

  for (const row of observations) {
    assert.equal(row.observationAt, "2026-08-10T00:00:00.000Z");
    assert.equal(row.retrievedAt, "2026-08-11T12:00:00.000Z");
    assert.notEqual(row.observationAt, row.retrievedAt);
  }
});

test("uses exact Treasury agency, dataset and attribution identities", async () => {
  const observations = await providerFor(VALID_TREASURY_YIELD_CURVE_XML).provider.fetchObservations();

  for (const row of observations) {
    assert.equal(row.source.agency, TREASURY_PROVIDER_NAME);
    assert.equal(row.source.dataset, TREASURY_DATASET_NAME);
    assert.equal(row.source.attribution, TREASURY_ATTRIBUTION);
  }
  assert.equal(TREASURY_PROVIDER_NAME, "U.S. Department of the Treasury");
  assert.equal(TREASURY_DATASET_NAME, "Daily Treasury Par Yield Curve Rates");
  assert.equal(
    TREASURY_ATTRIBUTION,
    "U.S. Department of the Treasury / Daily Treasury Par Yield Curve Rates",
  );
});

test("fails closed when any required 2Y, 10Y or 30Y field is missing", async () => {
  assert.deepEqual(
    await providerFor(MISSING_30Y_TREASURY_XML).provider.fetchObservations(),
    [],
  );
});

test("fails closed on malformed numeric yield values", async () => {
  assert.deepEqual(
    await providerFor(MALFORMED_10Y_TREASURY_XML).provider.fetchObservations(),
    [],
  );
});

test("returns no fabricated observations for an empty Treasury response", async () => {
  assert.deepEqual(await providerFor("").provider.fetchObservations(), []);
  assert.deepEqual(parseTreasuryYieldCurveXml("<feed></feed>"), []);
});

test("keeps an older official observation DAILY and preserves its original date", async () => {
  const observations = await providerFor(OLDER_TREASURY_YIELD_CURVE_XML).provider.fetchObservations();

  assert.equal(observations.length, 3);
  assert.equal(observations.every((row) => row.freshness === "DAILY"), true);
  assert.equal(observations.every((row) => row.observationAt === "2026-08-01T00:00:00.000Z"), true);
  assert.equal(observations.every((row) => row.retrievedAt === "2026-08-11T12:00:00.000Z"), true);
});

test("returns no values when the Treasury endpoint rejects or request fails", async () => {
  assert.deepEqual(
    await providerFor("service unavailable", 503).provider.fetchObservations(),
    [],
  );

  const provider = createTreasuryYieldProvider({
    now: () => RETRIEVED_AT,
    fetchImpl: async () => {
      throw new Error("network unavailable");
    },
  });
  assert.deepEqual(await provider.fetchObservations(), []);
});
