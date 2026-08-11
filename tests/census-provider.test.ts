import assert from "node:assert/strict";
import test from "node:test";
import {
  CENSUS_ATTRIBUTION,
  CENSUS_EITS_BASE,
  CENSUS_PROVIDER_NAME,
  createCensusObservationProvider,
  normalizeCensusSingleSeries,
} from "../app/lib/providers/official/census.ts";
import { CENSUS_QUERIES, censusPayload } from "./fixtures/census.ts";

const RETRIEVED = "2026-08-11T18:00:00.000Z";

test("normalizes four explicitly configured Census series without cross-series substitution", () => {
  const rows = CENSUS_QUERIES.flatMap((query, index) =>
    normalizeCensusSingleSeries(censusPayload(query, String(100 + index)), query, RETRIEVED)
  );
  assert.deepEqual(rows.map((row) => row.metric), ["RETAIL_SALES", "HOUSING", "DURABLE_GOODS", "TRADE"]);
  assert.equal(rows.every((row) => row.source.agency === CENSUS_PROVIDER_NAME), true);
  assert.equal(rows.every((row) => row.source.attribution.startsWith(CENSUS_ATTRIBUTION)), true);
});

test("preserves Census observation month separately from retrieval time", () => {
  const row = normalizeCensusSingleSeries(censusPayload(CENSUS_QUERIES[0]!), CENSUS_QUERIES[0]!, RETRIEVED)[0];
  assert.equal(row?.observationAt, "2026-06-01T00:00:00.000Z");
  assert.equal(row?.retrievedAt, RETRIEVED);
  assert.notEqual(row?.observationAt, row?.retrievedAt);
  assert.equal(row?.freshness, "DAILY");
});

test("fails closed for malformed, ambiguous or mismatched Census responses", () => {
  const query = CENSUS_QUERIES[0]!;
  assert.deepEqual(normalizeCensusSingleSeries([], query, RETRIEVED), []);
  assert.deepEqual(normalizeCensusSingleSeries([["cell_value"], ["bad"]], query, RETRIEVED), []);
  const ambiguous = censusPayload(query);
  ambiguous.push([...ambiguous[1]!]);
  assert.deepEqual(normalizeCensusSingleSeries(ambiguous, query, RETRIEVED), []);
  const wrong = censusPayload(query);
  wrong[1]![2] = "WRONG";
  assert.deepEqual(normalizeCensusSingleSeries(wrong, query, RETRIEVED), []);
});

test("provider isolates failed Census datasets and requires API key", async () => {
  const seen: string[] = [];
  const provider = createCensusObservationProvider({
    apiKey: "test-key",
    queries: CENSUS_QUERIES,
    now: () => Date.parse(RETRIEVED),
    fetchImpl: async (input) => {
      const url = String(input);
      seen.push(url);
      const query = CENSUS_QUERIES.find((candidate) => url.includes(`/${candidate.dataset}?`))!;
      if (query.metric === "HOUSING") throw new Error("down");
      return Response.json(censusPayload(query));
    },
  });
  const rows = await provider.fetchObservations();
  assert.deepEqual(rows.map((row) => row.metric), ["RETAIL_SALES", "DURABLE_GOODS", "TRADE"]);
  assert.equal(seen.every((url) => url.startsWith(CENSUS_EITS_BASE)), true);
  assert.equal(seen.every((url) => new URL(url).searchParams.get("key") === "test-key"), true);
});

test("empty API key fails closed without requests", async () => {
  let called = false;
  const provider = createCensusObservationProvider({
    apiKey: "",
    queries: CENSUS_QUERIES,
    fetchImpl: async () => { called = true; return Response.json([]); },
  });
  assert.deepEqual(await provider.fetchObservations(), []);
  assert.equal(called, false);
});
