import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  MARKETING_PREVIEW_FIXTURES,
  MARKETING_PREVIEW_STATES,
  assertIllustrativeCandleIntegrity,
  assertLevelOrdering,
  getMarketingPreviewFixture,
} from "../app/marketing-preview/lib/illustrative-fixtures.ts";

async function collectSourceFiles(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "marketing-preview" || entry.name === "node_modules" || entry.name === "dist") continue;
      files.push(...(await collectSourceFiles(full)));
    } else if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) {
      files.push(full);
    }
  }
  return files;
}

test("marketing preview page is production-blocked and labelled illustrative", async () => {
  const page = await readFile(new URL("../app/marketing-preview/page.tsx", import.meta.url), "utf8");
  const surface = await readFile(new URL("../app/marketing-preview/components/MarketingPreviewSurface.tsx", import.meta.url), "utf8");
  assert.match(page, /VERCEL_ENV === ["']production["']/);
  assert.match(page, /notFound\(/);
  assert.match(surface, /ILLUSTRATIVE SESSION SNAPSHOT/);
  assert.match(
    surface,
    /Illustrative session data for product demonstration\.\s*Not live market data and not financial advice\./,
  );
  assert.doesNotMatch(page, /createClient|supabase|stripe/i);
  assert.doesNotMatch(surface, /PwaController|MemberShell/);
});

test("all four marketing preview states render fixture content", () => {
  for (const id of MARKETING_PREVIEW_STATES) {
    const fixture = getMarketingPreviewFixture(id);
    assert.equal(fixture.id, id);
    assert.equal(fixture.illustrative, true);
    assert.ok(fixture.candles.length >= 60);
    assert.ok(fixture.posture.headline.length > 0);
    assert.ok(fixture.posture.participation.length > 0);
    assert.ok(fixture.posture.lean.length > 0);
    assert.ok(fixture.posture.confidenceDetail.includes("Illustrative") || fixture.posture.confidenceDetail.includes("non-actionable"));
    assert.match(fixture.banner, /ILLUSTRATIVE SESSION SNAPSHOT/);
    assertIllustrativeCandleIntegrity(fixture.candles);
    assertLevelOrdering(fixture.levels);
  }
  assert.equal(Object.keys(MARKETING_PREVIEW_FIXTURES).sort().join(","), "constructive,defensive,mixed,wait");
});

test("illustrative candles are valid OHLCV with strictly increasing timestamps", () => {
  for (const id of MARKETING_PREVIEW_STATES) {
    const { candles } = MARKETING_PREVIEW_FIXTURES[id];
    for (const candle of candles) {
      assert.ok(candle.low <= candle.open && candle.open <= candle.high);
      assert.ok(candle.low <= candle.close && candle.close <= candle.high);
      assert.ok(candle.volume > 0);
    }
    for (let index = 1; index < candles.length; index += 1) {
      assert.ok(candles[index]!.time > candles[index - 1]!.time);
    }
  }
});

test("live member routes do not import marketing fixtures", async () => {
  const roots = [
    path.join(process.cwd(), "app/dashboard"),
    path.join(process.cwd(), "app/brief"),
    path.join(process.cwd(), "app/terminal"),
    path.join(process.cwd(), "app/lib"),
    path.join(process.cwd(), "bullseye-engine.ts"),
  ];
  const files: string[] = [];
  for (const root of roots) {
    try {
      const stat = await readFile(root, "utf8").then(() => "file").catch(async () => {
        files.push(...(await collectSourceFiles(root)));
        return "dir";
      });
      if (stat === "file") files.push(root);
    } catch {
      // ignore missing optional paths
    }
  }
  for (const file of files) {
    const source = await readFile(file, "utf8");
    assert.doesNotMatch(source, /marketing-preview\/lib\/illustrative-fixtures/);
    assert.doesNotMatch(source, /MARKETING_PREVIEW_FIXTURES|getMarketingPreviewFixture/);
  }
});

test("dashboard confidence copy stays concise and overflow-safe styles exist", async () => {
  const presentation = await readFile(new URL("../app/terminal/lib/desk-decision-presentation.ts", import.meta.url), "utf8");
  const dashCss = await readFile(new URL("../app/market-command-centre.css", import.meta.url), "utf8");
  const deskCss = await readFile(new URL("../app/mission-control.css", import.meta.url), "utf8");
  assert.match(
    presentation,
    /Confirmation evidence is incomplete\. Bullseye remains non-actionable until evidence improves\./,
  );
  assert.match(dashCss, /\.dashDecisionGrid\{display:grid;grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
  assert.match(dashCss, /\.dashDecisionGrid article\{[^}]*min-width:0/);
  assert.match(dashCss, /\.dashDecisionGrid (strong|small|article)\{[^}]*overflow-wrap:anywhere/);
  assert.match(deskCss, /\.deskDecisionCell\{[^}]*overflow-wrap:anywhere/);
  assert.match(deskCss, /\.deskDecisionScoreDetail\{[^}]*overflow-wrap:anywhere/);
});

test("marketing preview chart stays isolated from live candle API fetching", async () => {
  const chart = await readFile(new URL("../app/marketing-preview/components/MarketingPreviewChart.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(chart, /\/api\/market\/candles/);
  assert.doesNotMatch(chart, /fetch\(/);
  assert.match(chart, /exponentialMovingAverage/);
  assert.match(chart, /volumeWeightedAveragePrice/);
  assert.match(chart, /ILLUSTRATIVE/);
});
