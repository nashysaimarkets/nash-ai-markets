import assert from "node:assert/strict";
import { test } from "node:test";

import { resolveDeskFeedStatus } from "../app/terminal/lib/feed-status.ts";
import type { MarketDataStatus } from "../app/lib/market-data.ts";
import type { MarketCoverage } from "../app/lib/markets/market-catalog.ts";

const COVERAGES: MarketCoverage[] = ["live", "proxy", "awaiting"];
const STATUSES: MarketDataStatus[] = ["LIVE", "DELAYED", "PREVIEW", "UNAVAILABLE"];

test("no combination ever claims connected and unavailable at once", () => {
  for (const coverage of COVERAGES) {
    for (const status of STATUSES) {
      const resolved = resolveDeskFeedStatus({ coverage, status });
      const label = resolved.label.toUpperCase();
      const contradictory = label.includes("CONNECTED") && label.includes("UNAVAILABLE");
      assert.equal(
        contradictory,
        false,
        `contradictory badge for coverage=${coverage} status=${status}: ${resolved.label}`,
      );
    }
  }
});

test("a connected feed reports its freshness rather than a bare status code", () => {
  assert.equal(resolveDeskFeedStatus({ coverage: "live", status: "LIVE" }).label, "CONNECTED · LIVE");
  assert.equal(
    resolveDeskFeedStatus({ coverage: "live", status: "DELAYED" }).label,
    "CONNECTED · DELAYED",
  );
});

test("a connected market with no provider response states the provider is unavailable", () => {
  const resolved = resolveDeskFeedStatus({ coverage: "live", status: "UNAVAILABLE" });
  assert.equal(resolved.label, "DATA PROVIDER UNAVAILABLE");
  assert.equal(resolved.tone, "warning");
  assert.match(resolved.detail, /Nothing has been inferred/);
});

test("a connected market awaiting its first verified snapshot does not claim live data", () => {
  const resolved = resolveDeskFeedStatus({ coverage: "live", status: "PREVIEW" });
  assert.equal(resolved.label, "AWAITING VERIFIED SNAPSHOT");
  assert.doesNotMatch(resolved.label, /LIVE/);
});

test("uncovered markets never inherit a live status from the snapshot", () => {
  for (const status of STATUSES) {
    assert.equal(
      resolveDeskFeedStatus({ coverage: "proxy", status }).label,
      "AWAITING VERIFIED SNAPSHOT",
    );
    assert.equal(
      resolveDeskFeedStatus({ coverage: "awaiting", status }).label,
      "COVERAGE COMING SOON",
    );
  }
});

test("every resolved status carries a plain-language explanation", () => {
  for (const coverage of COVERAGES) {
    for (const status of STATUSES) {
      const resolved = resolveDeskFeedStatus({ coverage, status });
      assert.ok(resolved.detail.length > 30, `detail too thin for ${coverage}/${status}`);
      assert.ok(resolved.label.length > 0);
    }
  }
});

test("delayed data is never presented as live", () => {
  const delayed = resolveDeskFeedStatus({ coverage: "live", status: "DELAYED" });
  assert.doesNotMatch(delayed.label, /· LIVE/);
  assert.match(delayed.detail, /delayed/i);
});
