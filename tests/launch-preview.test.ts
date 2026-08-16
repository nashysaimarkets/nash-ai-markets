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
import {
  createChallengeShareText,
  createEmptySessionChallenge,
  parseSessionChallenge,
  recordChallengeSession,
  SESSION_CHALLENGE_SIZE,
  SESSION_CHALLENGE_STORAGE_KEY,
} from "../app/launch-preview/lib/session-challenge.ts";

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

test("launch centre and individual checklist answers make no provider, account or persistence calls", async () => {
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
  assert.match(component, /<SessionChallenge score=\{score\} touched=\{touched\}/);
});

test("five-session challenge stores only bounded local dates and process scores", () => {
  assert.equal(SESSION_CHALLENGE_SIZE, 5);
  assert.equal(SESSION_CHALLENGE_STORAGE_KEY, "nash.bullseye.first-five.v1");
  const empty = createEmptySessionChallenge();
  assert.deepEqual(empty, { version: 1, sessions: [] });

  const first = recordChallengeSession(empty, { date: "2026-08-17", score: 6 });
  assert.equal(first.outcome, "recorded");
  assert.deepEqual(first.progress.sessions, [{ date: "2026-08-17", score: 6 }]);

  const duplicate = recordChallengeSession(first.progress, { date: "2026-08-17", score: 8 });
  assert.equal(duplicate.outcome, "duplicate");
  assert.deepEqual(duplicate.progress, first.progress);

  const restored = parseSessionChallenge(JSON.stringify({
    version: 1,
    sessions: [
      { date: "2026-08-17", score: 6 },
      { date: "2026-08-17", score: 8 },
      { date: "bad-date", score: 7 },
      { date: "2026-08-18", score: 99 },
      { date: "2026-08-19", score: 7, answerDetails: { risk: true } },
    ],
  }));
  assert.deepEqual(restored, {
    version: 1,
    sessions: [
      { date: "2026-08-17", score: 6 },
      { date: "2026-08-19", score: 7 },
    ],
  });
  assert.equal(parseSessionChallenge("not-json").sessions.length, 0);
});

test("five-session challenge stops at five and shares no private or session detail", () => {
  let progress = createEmptySessionChallenge();
  for (let day = 17; day <= 21; day += 1) {
    const result = recordChallengeSession(progress, { date: `2026-08-${day}`, score: day % 9 });
    assert.equal(result.outcome, "recorded");
    progress = result.progress;
  }
  assert.equal(progress.sessions.length, 5);
  assert.equal(
    recordChallengeSession(progress, { date: "2026-08-22", score: 8 }).outcome,
    "complete",
  );
  const text = createChallengeShareText(progress.sessions.length);
  assert.equal(
    text,
    "My Bullseye First 5 Sessions challenge: 5/5 sessions reviewed. Process over prediction. #BullseyeBeforeTheBell",
  );
  assert.doesNotMatch(text, /2026|score|https?:|vercel|launch-preview|_vercel_share/);
});

test("challenge persistence is device-only, minimal, accessible and reset-confirmed", async () => {
  const challenge = await launchSource("_components/SessionChallenge.tsx");
  assert.match(challenge, /window\.localStorage\.getItem\(SESSION_CHALLENGE_STORAGE_KEY\)/);
  assert.match(challenge, /window\.localStorage\.setItem\(SESSION_CHALLENGE_STORAGE_KEY/);
  assert.match(challenge, /window\.localStorage\.removeItem\(SESSION_CHALLENGE_STORAGE_KEY\)/);
  assert.doesNotMatch(challenge, /fetch\(|XMLHttpRequest|WebSocket|EventSource|createClient|supabase|stripe|\/api\//i);
  assert.match(challenge, /Stores only five dates and scores/);
  assert.match(challenge, /Never stores individual answers/);
  assert.match(challenge, /Never sends progress to Bullseye/);
  assert.match(challenge, /one entry per local calendar day/i);
  assert.match(challenge, /role="group" aria-label="Confirm challenge reset"/);
  assert.match(challenge, /role="status" aria-live="polite"/);
  assert.match(challenge, /No dates, scores, account data or preview link were included/);
});

test("launch centre styles include responsive, keyboard and reduced-motion safeguards", async () => {
  const css = await launchSource("launch-preview.css");
  assert.match(css, /:focus-visible/);
  assert.match(css, /@media\(max-width:980px\)/);
  assert.match(css, /@media\(max-width:720px\)/);
  assert.match(css, /@media\(prefers-reduced-motion:reduce\)/);
  assert.match(css, /overflow-x:hidden/);
  assert.match(css, /\.vlChallenge\{/);
  assert.match(css, /\.vlChallengeProgress ol\{/);
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
