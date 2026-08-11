import assert from "node:assert/strict";
import test from "node:test";
import {
  SEC_ATTRIBUTION,
  SEC_PROVIDER_NAME,
  SEC_SUBMISSIONS_BASE,
  createSecEdgarFilingProvider,
  normalizeSecSubmissionsPayload,
} from "../app/lib/providers/official/sec-edgar.ts";
import { SEC_SUBMISSIONS_FIXTURE } from "./fixtures/sec-edgar.ts";

const RETRIEVED = "2026-08-11T18:00:00.000Z";

test("normalizes recent report filing activity only and never a forward earnings calendar", () => {
  const rows = normalizeSecSubmissionsPayload(SEC_SUBMISSIONS_FIXTURE, RETRIEVED);
  assert.deepEqual(rows.map((row) => row.form), ["10-Q", "8-K"]);
  assert.equal(rows[0]?.companyName, "Example Public Company");
  assert.equal(rows[0]?.cik, "0000320193");
  assert.equal(rows[0]?.source.agency, SEC_PROVIDER_NAME);
  assert.equal(rows[0]?.source.attribution, SEC_ATTRIBUTION);
  assert.equal("scheduledAt" in (rows[0] ?? {}), false);
  assert.equal("forecast" in (rows[0] ?? {}), false);
  assert.equal("consensus" in (rows[0] ?? {}), false);
});

test("preserves EDGAR acceptance timestamp separately from retrieval time", () => {
  const row = normalizeSecSubmissionsPayload(SEC_SUBMISSIONS_FIXTURE, RETRIEVED)[0];
  assert.equal(row?.filedAt, "2026-08-01T20:15:30.000Z");
  assert.equal(row?.retrievedAt, RETRIEVED);
  assert.notEqual(row?.filedAt, row?.retrievedAt);
});

test("malformed EDGAR payloads fail closed", () => {
  assert.deepEqual(normalizeSecSubmissionsPayload({}, RETRIEVED), []);
  const malformed = structuredClone(SEC_SUBMISSIONS_FIXTURE);
  malformed.name = "";
  assert.deepEqual(normalizeSecSubmissionsPayload(malformed, RETRIEVED), []);
});

test("SEC provider isolates failed CIKs and requires no API key/account", async () => {
  const seen: Array<{ url: string; userAgent: string }> = [];
  const provider = createSecEdgarFilingProvider({
    ciks: ["320193", "0000000001"],
    userAgent: "NASH AI Markets contact@example.com",
    now: () => Date.parse(RETRIEVED),
    fetchImpl: async (input, init) => {
      const url = String(input);
      seen.push({ url, userAgent: String((init?.headers as Record<string, string>)?.["User-Agent"] ?? "") });
      if (url.endsWith("CIK0000000001.json")) throw new Error("down");
      return Response.json(SEC_SUBMISSIONS_FIXTURE);
    },
  });
  const rows = await provider.fetchRecentActivity();
  assert.equal(rows.length, 2);
  assert.equal(seen[0]?.url.startsWith(SEC_SUBMISSIONS_BASE), true);
  assert.equal(seen.every((item) => item.userAgent.includes("NASH AI Markets")), true);
  assert.equal(seen.some((item) => /key=|apikey|token/i.test(item.url)), false);
});

test("missing declared User-Agent fails closed without requests", async () => {
  let called = false;
  const provider = createSecEdgarFilingProvider({
    ciks: ["320193"],
    userAgent: "",
    fetchImpl: async () => { called = true; return Response.json(SEC_SUBMISSIONS_FIXTURE); },
  });
  assert.deepEqual(await provider.fetchRecentActivity(), []);
  assert.equal(called, false);
});
