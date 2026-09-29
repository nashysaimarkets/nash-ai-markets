import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { normalizeEconomicCalendar } from "../app/lib/providers/fmp-economic-calendar.ts";

test("supplemental calendar retains visible US labour releases without calling them official", () => {
  const now = Date.parse("2026-09-04T06:00:00Z");
  const events = normalizeEconomicCalendar([
    { country: "US", event: "Non Farm Payrolls", impact: "High", date: "2026-09-04 08:30:00" },
    { country: "US", event: "Average Hourly Earnings", impact: "Medium", date: "2026-09-04T12:30:00Z" },
    { country: "DE", event: "Factory Orders", impact: "High", date: "2026-09-04T07:00:00Z" },
  ], now);
  assert.deepEqual(events.map((event) => [event.name, event.risk]), [
    ["Non Farm Payrolls", "HIGH"],
    ["Average Hourly Earnings", "MED"],
  ]);
  assert.equal(events[0]?.at, "2026-09-04T12:30:00.000Z");
});

test("Pocket labels supplemental market-calendar rows by provider provenance", async () => {
  const [eventsRoute, analysisRoute, client] = await Promise.all([
    readFile(new URL("../app/api/pocket/events/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/pocket/analyse/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/pocket/PocketBullseye.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(eventsRoute, /loadFmpEconomicCalendar/);
  assert.match(analysisRoute, /provider schedule/);
  assert.match(client, /Financial Modeling Prep connected/);
  assert.match(client, /PROVIDER SCHEDULE/);
});
