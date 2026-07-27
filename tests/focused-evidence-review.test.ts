import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path: string) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Evidence reads the latest immutable snapshot without reconstructing history", async () => {
  const page = await read("app/brief/page.tsx");

  assert.match(page, /requireMemberPage/);
  assert.match(page, /!access\.features\.intelligence/);
  assert.match(page, /redirect\("\/terminal"\)/);
  assert.match(page, /listAnalysisSnapshots\(1\)/);
  assert.match(page, /latest\.payload\.market\.quotes/);
  assert.match(page, /topSupportingDrivers/);
  assert.match(page, /conflictingDrivers/);
  assert.match(page, /invalidationConditions/);
  assert.match(page, /No retrospective reconstruction/);
  assert.doesNotMatch(page, /getTerminalMarketData|Math\.random/);
});

test("Review joins protected snapshot and private journal records", async () => {
  const page = await read("app/review/page.tsx");

  assert.match(page, /requireMemberPage/);
  assert.match(page, /!access\.features\["yesterday-review"\]/);
  assert.match(page, /redirect\("\/terminal"\)/);
  assert.match(page, /listAnalysisSnapshots\(12\)/);
  assert.match(page, /listJournalEntries\(user\.id\)/);
  assert.match(page, /journalPerformance\(journal\.rows\)/);
  assert.match(page, /Percentages withheld/);
  assert.match(page, /performance\.sufficient/);
  assert.match(page, /No history has been reconstructed/);
});

test("focused member routes keep authentication and noindex contracts", async () => {
  const [evidence, review] = await Promise.all([
    read("app/brief/page.tsx"),
    read("app/review/page.tsx"),
  ]);

  for (const page of [evidence, review]) {
    assert.match(page, /robots: \{ index: false, follow: false \}/);
    assert.match(page, /<MemberShell/);
  }
});
