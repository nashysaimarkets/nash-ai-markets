/**
 * Economic-calendar rows arrive from an external provider and are not
 * schema-guaranteed per row. An impact rating that cannot be verified must
 * normalise to UNKNOWN and must never be presented to customers as a rating.
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  dedupeVerifiedEvents,
  groupVerifiedEvents,
  verifiedEventRisk,
  verifiedEventRiskLabel,
} from "../app/terminal/lib/event-display.ts";

test("verifiedEventRisk never invents a rating the provider did not supply", () => {
  assert.equal(verifiedEventRisk("HIGH"), "HIGH");
  assert.equal(verifiedEventRisk("high"), "HIGH");
  assert.equal(verifiedEventRisk("3"), "HIGH");
  assert.equal(verifiedEventRisk("Medium"), "MED");
  assert.equal(verifiedEventRisk("moderate"), "MED");
  assert.equal(verifiedEventRisk("2"), "MED");
  assert.equal(verifiedEventRisk("low"), "UNKNOWN");
  assert.equal(verifiedEventRisk(""), "UNKNOWN");
  assert.equal(verifiedEventRisk("   "), "UNKNOWN");
  assert.equal(verifiedEventRisk(undefined), "UNKNOWN");
  assert.equal(verifiedEventRisk(null), "UNKNOWN");
  assert.equal(verifiedEventRisk(42), "UNKNOWN");
  assert.equal(verifiedEventRisk({}), "UNKNOWN");
});

test("unverified impact is never presented as a rating", () => {
  assert.equal(verifiedEventRiskLabel("HIGH"), "HIGH impact");
  assert.equal(verifiedEventRiskLabel("MED"), "MED impact");
  assert.equal(verifiedEventRiskLabel("UNKNOWN"), "Impact not verified");
  assert.equal(verifiedEventRiskLabel(undefined), "Impact not verified");
  assert.equal(verifiedEventRiskLabel(null), "Impact not verified");
});

test("event helpers tolerate malformed provider rows without throwing", () => {
  const rows = [
    { time: "2099-01-01T13:30:00.000Z", name: "US CPI", risk: "HIGH" },
    { time: "2099-01-01T14:00:00.000Z", name: "Retail sales" },
    { time: "2099-01-01T14:30:00.000Z", name: "PPI", risk: null },
    { time: "2099-01-01T15:00:00.000Z", risk: "HIGH" },
    { time: "2099-01-01T15:30:00.000Z", name: "   ", risk: "MED" },
    null,
    undefined,
  ] as never;

  const deduped = dedupeVerifiedEvents(rows);
  // Rows without a usable name cannot be shown as a verified catalyst.
  assert.deepEqual(
    deduped.map((event) => event.name),
    ["US CPI", "Retail sales", "PPI"],
  );

  const grouped = groupVerifiedEvents(rows, Date.parse("2098-01-01T00:00:00.000Z"), 12);
  assert.deepEqual(
    grouped.map((event) => event.risk),
    ["HIGH", "UNKNOWN", "UNKNOWN"],
  );
});
