import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("homepage launches the Bullseye Decision Instrument as one focused promise", async () => {
  const homepage = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");

  assert.match(homepage, /Public launch · Bullseye BDI-01/);
  assert.match(homepage, /See the market/);
  assert.match(homepage, /See what changes the plan/);
  assert.match(homepage, /Bullseye Decision Instrument/);
  assert.match(homepage, /Five separate readings/);
  assert.match(homepage, /No hidden score/);
  assert.match(homepage, /Stand aside is valid/);
  assert.match(homepage, /Bullish confirmation/);
  assert.match(homepage, /Bearish confirmation/);
  assert.match(homepage, /Risk veto/);
  assert.match(homepage, /Prior-brief delta/);
  assert.match(homepage, /NO LIVE MARKET VALUES/);
  assert.match(homepage, /scenarios, not predictions/);
  assert.doesNotMatch(homepage, /const plans|Founding 100|Free[\s\S]*Pro[\s\S]*Elite/);
});

test("public Decision Lab makes the product logic interactive without invented market data", async () => {
  const homepage = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const lab = await readFile(new URL("../app/components/PublicDecisionLab.tsx", import.meta.url), "utf8");

  assert.match(homepage, /<PublicDecisionLab \/>/);
  assert.match(lab, /Interactive public experiment/);
  assert.match(lab, /Change the conditions/);
  assert.match(lab, /aria-pressed/);
  assert.match(lab, /aria-live="polite"/);
  assert.match(lab, /Safety locked/);
  assert.match(lab, /Stand aside/);
  assert.match(lab, /Prepare bullish path/);
  assert.match(lab, /Prepare bearish path/);
  assert.match(lab, /Scenarios, not predictions/);
  assert.match(lab, /contains no market prices or live signals/);
  assert.doesNotMatch(lab, /Math\.random|fetch\(|\b\d{4,}\.\d{2}\b/);
});

test("member navigation foregrounds Today, Evidence, Review and Account", async () => {
  const shell = await readFile(new URL("../app/components/MemberShell.tsx", import.meta.url), "utf8");

  const primary = shell.slice(shell.indexOf("const links"), shell.indexOf("const moreLinks"));
  assert.match(primary, /label: "Today"/);
  assert.match(primary, /label: "Evidence"/);
  assert.match(primary, /label: "Review"/);
  assert.match(primary, /label: "Account"/);
  assert.doesNotMatch(primary, /label: "Terminal"|label: "Dashboard"|label: "Ideas"/);
});

test("product reset preserves protected commercial and market systems", async () => {
  const terminal = await readFile(new URL("../app/terminal/page.tsx", import.meta.url), "utf8");

  assert.match(terminal, /getTerminalMarketData/);
  assert.match(terminal, /resolveMembershipTier/);
  assert.match(terminal, /createTradingDecision/);
  assert.match(terminal, /createStructuredTradePlan/);
  assert.match(terminal, /persistAnalysisSnapshot/);
});
