import assert from "node:assert/strict";
import test from "node:test";
import {
  createNewYorkFedRatesProvider,
  NEW_YORK_FED_RATES_ENDPOINT,
  normalizeNewYorkFedRates,
} from "../app/lib/providers/official/new-york-fed.ts";

const payload = { refRates: [
  { effectiveDate: "2026-08-13", type: "EFFR", percentRate: 3.63 },
  { effectiveDate: "2026-08-13", type: "SOFR", percentRate: 3.62 },
  { effectiveDate: "2026-08-14", type: "SOFRAI", average30day: 3.63 },
] };

test("normalizes only official EFFR and SOFR observations", () => {
  const rows = normalizeNewYorkFedRates(payload, "2026-08-15T12:00:00.000Z");
  assert.deepEqual(rows.map((row) => row.metric), ["EFFR", "SOFR"]);
  assert.deepEqual(rows.map((row) => row.value), [3.63, 3.62]);
  assert.equal(rows.every((row) => row.unit === "%" && row.freshness === "DAILY"), true);
});

test("provider uses the no-key official endpoint and fails closed", async () => {
  let requested = "";
  const provider = createNewYorkFedRatesProvider({
    now: () => Date.parse("2026-08-15T12:00:00.000Z"),
    fetchImpl: async (input) => { requested = String(input); return Response.json(payload); },
  });
  assert.equal((await provider.fetchObservations()).length, 2);
  assert.equal(requested, NEW_YORK_FED_RATES_ENDPOINT);

  const failing = createNewYorkFedRatesProvider({ fetchImpl: async () => new Response("down", { status: 503 }) });
  assert.deepEqual(await failing.fetchObservations(), []);
});
