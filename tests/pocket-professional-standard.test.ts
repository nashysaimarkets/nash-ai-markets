import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("Pocket opens on the evidence report instead of cinematic theatre", async () => {
  const client = await readFile(new URL("../app/pocket/PocketBullseye.tsx", import.meta.url), "utf8");
  assert.match(client, /useState<"cinema" \| "report">\("report"\)/);
  assert.match(client, /setResultView\("report"\);\s*setImmersive\(true\);\s*setShowResultReveal\(false\)/);
  assert.match(client, />EVIDENCE REPORT<\/button>/);
});

test("main scanner rail stays focused and includes first-class liquidity", async () => {
  const client = await readFile(new URL("../app/pocket/PocketBullseye.tsx", import.meta.url), "utf8");
  for (const label of ["CHART X-RAY", "PATTERNS", "LIQUIDITY", "SCENARIOS", "PLAN", "RISK"]) {
    assert.match(client, new RegExp('label: "' + label + '"'));
  }
  assert.doesNotMatch(client, /label: "SIGNAL PULSE"/);
  assert.match(client, /WHAT POCKET ACTUALLY VERIFIED/);
});

test("liquidity scanner explicitly refuses hidden-order claims", async () => {
  const route = await readFile(new URL("../app/api/pocket/analyse/route.ts", import.meta.url), "utf8");
  assert.match(route, /Never claim to see hidden orders/);
  assert.match(route, /SWEEP requires price to visibly trade beyond/);
  assert.match(route, /Return no zones rather than inventing one/);
});

test("professional restraint stylesheet suppresses decorative radar theatre", async () => {
  const styles = await readFile(new URL("../app/pocket/pocket-professional.css", import.meta.url), "utf8");
  assert.match(styles, /\.psLaunchTarget,.psLockAtmosphere,.psLockSweep,.psRevealRadar\{display:none!important\}/);
  assert.match(styles, /\.psScannerHealth/);
});
