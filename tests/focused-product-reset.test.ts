import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("homepage presents one focused daily decision-brief promise", async () => {
  const homepage = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");

  assert.match(homepage, /Daily S&amp;P 500 decision brief/);
  assert.match(homepage, /Know your conditions/);
  assert.match(homepage, /Bullish path/);
  assert.match(homepage, /Bearish path/);
  assert.match(homepage, /Stand aside/);
  assert.match(homepage, /Scenarios, not predictions/);
  assert.doesNotMatch(homepage, /const plans|Founding 100|Free[\s\S]*Pro[\s\S]*Elite/);
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
