import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("owner-only visual preview labels synthetic charts and preserves the verified dashboard", async () => {
  const page = await readFile(new URL("../app/admin/visual-preview/page.tsx", import.meta.url), "utf8");
  assert.match(page, /isFounding100Admin/);
  assert.match(page, /redirect\("\/login\?next=\/admin\/visual-preview"\)/);
  assert.match(page, /Every value below is synthetic design data/);
  assert.match(page, /DEMO VISUALS · NOT LIVE/);
  assert.match(page, /Return to verified dashboard/);
  assert.match(page, /DashboardCandlestickChart/);
  assert.doesNotMatch(page, /Financial Modeling Prep supplied|verified market data/i);
});
