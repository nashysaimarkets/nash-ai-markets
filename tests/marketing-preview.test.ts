import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  MARKETING_PREVIEW_FIXTURES,
  MARKETING_PREVIEW_STATES,
  aggregateIllustrativeCandles,
  assertIllustrativeCandleIntegrity,
  assertLevelOrdering,
  getMarketingPreviewFixture,
} from "../app/marketing-preview/lib/illustrative-fixtures.ts";
import {
  MARKETING_PREVIEW_PAGES,
  resolveMarketingPreviewPage,
} from "../app/marketing-preview/lib/page-sections.ts";

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
  assert.match(surface, /mpSidebar|Illustrative Bullseye navigation/);
  assert.match(surface, /mpTopBar|Today.?s command centre|mpSessionPill/);
  assert.match(surface, /EXAMPLE-ONLY MEMBER EXPERIENCE/);
  assert.match(surface, /MarketingPreviewPageContent/);
  assert.match(page, /resolveMarketingPreviewPage/);
  assert.match(page, /initialPage/);
});

test("marketing preview exposes every confirmed primary member page without advertising unfinished routes", async () => {
  const surface = await readFile(new URL("../app/marketing-preview/components/MarketingPreviewSurface.tsx", import.meta.url), "utf8");
  const pages = await readFile(new URL("../app/marketing-preview/components/MarketingPreviewPages.tsx", import.meta.url), "utf8");
  assert.deepEqual(
    MARKETING_PREVIEW_PAGES.map((page) => page.label),
    ["Dashboard", "Morning Brief", "Trading Desk", "Ideas", "Reviews", "Profile", "Preferences"],
  );
  assert.equal(resolveMarketingPreviewPage("terminal"), "terminal");
  assert.equal(resolveMarketingPreviewPage(["brief"]), "brief");
  assert.equal(resolveMarketingPreviewPage("journal"), "dashboard");
  assert.match(surface, /onClick=\{\(\) => selectPage\(item\.id\)\}/);
  assert.match(surface, /replacePreviewQuery\("view"/);
  assert.match(pages, /MorningBriefPreview/);
  assert.match(pages, /TradingDeskPreview/);
  assert.match(pages, /IdeasPreview/);
  assert.match(pages, /ReviewsPreview/);
  assert.match(pages, /ProfilePreview/);
  assert.match(pages, /PreferencesPreview/);
  assert.doesNotMatch(JSON.stringify(MARKETING_PREVIEW_PAGES), /Journal|Performance|Results|Replay/);
});

test("example member pages remain isolated from accounts, billing and live providers", async () => {
  const pages = await readFile(new URL("../app/marketing-preview/components/MarketingPreviewPages.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(pages, /createClient|supabase|stripe|\/api\/market|fetch\(/i);
  assert.match(pages, /EXAMPLE ONLY · NOT LIVE/);
  assert.match(pages, /SAMPLE ACCOUNT · NO REAL DETAILS/);
  assert.match(pages, /No account data is changed/);
  assert.match(pages, /not a recommendation/i);
});

test("marketing preview chart exposes premium controls without live fetches", async () => {
  const chart = await readFile(new URL("../app/marketing-preview/components/MarketingPreviewChart.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(chart, /\/api\/market\/candles/);
  assert.doesNotMatch(chart, /fetch\(/);
  assert.match(chart, /mpTimeframes|EMA 9|VWAP|Volume/);
  assert.match(chart, /520/);
  assert.match(chart, /exponentialMovingAverage/);
  assert.match(chart, /volumeWeightedAveragePrice/);
  assert.match(chart, /ILLUSTRATIVE/);
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
  assert.equal(getMarketingPreviewFixture("wait").posture.headline, "Stay patient");
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

test("advertising timeframe controls regroup the illustrative tape instead of changing labels only", () => {
  const candles = getMarketingPreviewFixture("constructive").candles;
  const oneMinute = aggregateIllustrativeCandles(candles, "1m");
  const fiveMinute = aggregateIllustrativeCandles(candles, "5m");
  const fifteenMinute = aggregateIllustrativeCandles(candles, "15m");
  const hourly = aggregateIllustrativeCandles(candles, "1H");
  assert.equal(oneMinute.length, candles.length);
  assert.ok(fiveMinute.length < oneMinute.length);
  assert.ok(fifteenMinute.length < fiveMinute.length);
  assert.ok(hourly.length < fifteenMinute.length);
  assert.equal(fiveMinute.reduce((sum, candle) => sum + candle.volume, 0), candles.reduce((sum, candle) => sum + candle.volume, 0));
  assertIllustrativeCandleIntegrity(fiveMinute);
  assertIllustrativeCandleIntegrity(fifteenMinute);
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
  const mpCss = await readFile(new URL("../app/marketing-preview/marketing-preview.css", import.meta.url), "utf8");
  assert.match(
    presentation,
    /Confirmation evidence is incomplete\. Bullseye remains non-actionable until evidence improves\./,
  );
  assert.match(dashCss, /\.dashDecisionGrid\{display:grid;grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
  assert.match(dashCss, /\.dashDecisionGrid article\{[^}]*min-width:0/);
  assert.match(dashCss, /\.dashDecisionGrid (strong|small|article)\{[^}]*overflow-wrap:anywhere/);
  assert.match(deskCss, /\.deskDecisionCell\{[^}]*overflow-wrap:anywhere/);
  assert.match(deskCss, /\.deskDecisionScoreDetail\{[^}]*overflow-wrap:anywhere/);
  assert.match(mpCss, /\.mpShell\{/);
  assert.match(mpCss, /\.mpSidebar\{/);
  assert.match(mpCss, /\.mpBottomStrip\{/);
  assert.match(mpCss, /\.mpIdeasGrid\{/);
  assert.match(mpCss, /\.mpReviewGrid\{/);
  assert.match(mpCss, /\.mpSettingsGrid/);
  assert.match(mpCss, /overflow-x:hidden/);
});
