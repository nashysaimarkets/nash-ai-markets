import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  calculateDisciplineScore,
  createDisciplineShareText,
  createEmptyDisciplineAnswers,
  DISCIPLINE_QUESTIONS,
  getDisciplineScoreBand,
} from "../app/launch-preview/lib/discipline-check.ts";

async function launchSource(relativePath: string): Promise<string> {
  return readFile(new URL(`../app/launch-preview/${relativePath}`, import.meta.url), "utf8");
}

test("launch centre is private, production-blocked and excluded from search", async () => {
  const page = await launchSource("page.tsx");
  assert.match(page, /dynamic = ["']force-dynamic["']/);
  assert.match(page, /VERCEL_ENV === ["']production["']/);
  assert.match(page, /notFound\(\)/);
  assert.match(page, /robots:\s*\{\s*index:\s*false,\s*follow:\s*false\s*\}/);
  assert.match(page, /PRIVATE LAUNCH LAB/);
  assert.match(page, /no live market data · no customer writes/);
  assert.match(page, /data-launch-preview=["']example-only["']/);
  assert.match(page, /\/marketing-preview\?state=constructive/);
  assert.doesNotMatch(page, /\/waitlist|signOut|checkout|createClient|supabase|stripe|fetch\(|\/api\//i);
});

test("launch centre and discipline check make no provider, account or persistence calls", async () => {
  const sources = await Promise.all([
    launchSource("page.tsx"),
    launchSource("_components/DisciplineCheck.tsx"),
    launchSource("lib/discipline-check.ts"),
  ]);
  const combined = sources.join("\n");
  assert.doesNotMatch(combined, /createClient|supabase|stripe|fetch\(|XMLHttpRequest|WebSocket|EventSource|localStorage|sessionStorage|\/api\//i);
  assert.doesNotMatch(combined, /window\.location|document\.location/);
  assert.match(combined, /No answers, identifiers or market data leave this page/);
  assert.match(combined, /contains no private-preview link/);
});

test("discipline score has eight process gates and safe, non-directional bands", () => {
  assert.equal(DISCIPLINE_QUESTIONS.length, 8);
  const answers = createEmptyDisciplineAnswers();
  assert.equal(calculateDisciplineScore(answers), 0);
  assert.deepEqual(Object.values(answers), Array(8).fill(false));

  for (const question of DISCIPLINE_QUESTIONS.slice(0, 4)) answers[question.id] = true;
  assert.equal(calculateDisciplineScore(answers), 4);
  assert.equal(getDisciplineScoreBand(0).label, "Pause and prepare");
  assert.equal(getDisciplineScoreBand(3).label, "Pause and prepare");
  assert.equal(getDisciplineScoreBand(4).label, "Developing plan");
  assert.equal(getDisciplineScoreBand(6).label, "Developing plan");
  assert.equal(getDisciplineScoreBand(7).label, "Prepared to observe");
  assert.equal(getDisciplineScoreBand(8).label, "Prepared to observe");
  assert.match(getDisciplineScoreBand(8).detail, /not permission to trade/i);
  assert.doesNotMatch(
    DISCIPLINE_QUESTIONS.map((question) => question.label).join(" "),
    /bullish|bearish|buy|sell|signal|profit|win rate/i,
  );
});

test("shared discipline result is text-only and cannot leak the protected preview URL", () => {
  const text = createDisciplineShareText(7, "Prepared to observe");
  assert.equal(
    text,
    "My Bullseye Discipline Check: 7/8 — Prepared to observe. Process over prediction. #BullseyeBeforeTheBell",
  );
  assert.doesNotMatch(text, /https?:|vercel|launch-preview|marketing-preview|_vercel_share/);
});

test("discipline check provides local sharing, download, reset and accessible status", async () => {
  const component = await launchSource("_components/DisciplineCheck.tsx");
  assert.match(component, /navigator\.share/);
  assert.match(component, /navigator\.clipboard\.writeText/);
  assert.match(component, /document\.createElement\(["']canvas["']\)/);
  assert.match(component, /canvas\.toBlob/);
  assert.match(component, /bullseye-discipline-scorecard\.png/);
  assert.match(component, /<fieldset>/);
  assert.match(component, /<legend>/);
  assert.match(component, /<progress/);
  assert.match(component, /role=["']status["']/);
  assert.match(component, /aria-live=["']polite["']/);
  assert.match(component, /Reset safely/);
  assert.match(component, /disabled=\{!touched\}/);
});

test("launch centre styles include responsive, keyboard and reduced-motion safeguards", async () => {
  const css = await launchSource("launch-preview.css");
  assert.match(css, /:focus-visible/);
  assert.match(css, /@media\(max-width:980px\)/);
  assert.match(css, /@media\(max-width:720px\)/);
  assert.match(css, /@media\(prefers-reduced-motion:reduce\)/);
  assert.match(css, /overflow-x:hidden/);
});

test("organic launch pack contains 30 assets and preserves the launch safety gates", async () => {
  const pack = await readFile(new URL("../docs/BULLSEYE_VIRAL_LAUNCH_PACK.md", import.meta.url), "utf8");
  const numberedAssets = pack.match(/^#### \d{2} — .+$/gm) ?? [];
  assert.equal(numberedAssets.length, 30);
  assert.match(pack, /THE MARKET HAS A WAIT BUTTON/);
  assert.match(pack, /#BullseyeBeforeTheBell/);
  assert.match(pack, /Public production: \*\*NO-GO\*\*/);
  assert.match(pack, /Paid promotion: \*\*NO-GO/);
  assert.match(pack, /Do not scrape, download or republish TradingView charts or data/);
  assert.match(pack, /zero-data-cost/i);
  assert.match(pack, /private-preview share token/i);
  assert.match(pack, /qualified UK financial-promotion review/i);
});
