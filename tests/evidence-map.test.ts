import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import type { ConvictionExplainerModel } from "../app/lib/oracle/conviction-explainer.ts";
import { buildEvidenceMap } from "../app/lib/oracle/evidence-map.ts";

const ROOT = join(import.meta.dirname, "..");
const read = (relative: string) => readFileSync(join(ROOT, relative), "utf8");

const conviction: ConvictionExplainerModel = {
  available: true,
  methodology: "Verified delayed factors. Scenario weights are not probabilities.",
  factors: [
    {
      id: "trend",
      label: "Trend",
      relation: "supports",
      strength: "High",
      explanation: "Verified structure is constructive.",
      whyItMatters: "Structure helps distinguish persistence from noise.",
      dataStatus: "Verified delayed",
    },
    {
      id: "volatility",
      label: "Volatility",
      relation: "opposes",
      strength: "Medium",
      explanation: "Volatility is rising.",
      whyItMatters: "Rising volatility can restrict participation quality.",
      dataStatus: "Verified delayed",
    },
    {
      id: "event-risk",
      label: "Event risk",
      relation: "caution",
      strength: "Medium",
      explanation: "A verified release is approaching.",
      whyItMatters: "Scheduled releases can invalidate structure.",
      dataStatus: "Verified delayed",
    },
    {
      id: "breadth",
      label: "Breadth",
      relation: "unavailable",
      strength: "Unavailable",
      explanation: "No breadth feed is connected.",
      whyItMatters: "Breadth would show participation quality.",
      dataStatus: "Unavailable",
    },
  ],
};

test("evidence map reuses existing factors without recalculating them", () => {
  const model = buildEvidenceMap({
    conviction,
    verified: true,
    permissionLabel: "Proceed with caution",
    permissionTone: "caution",
    leanLabel: "Bullish lean",
    primaryRisk: "Event risk is elevated",
    freshness: "Delayed market data · 12m ago",
  });

  assert.equal(model.nodes.length, conviction.factors.length);
  assert.deepEqual(model.nodes.map((node) => node.id), conviction.factors.map((factor) => factor.id));
  assert.deepEqual(model.counts, { supportive: 1, restrictive: 2, neutral: 0, unavailable: 1 });
  assert.equal(model.nodes[0]?.displayLabel, "ES structure");
  assert.equal(model.nodes[0]?.sourceLabel, "Structure factor status");
  assert.equal(model.nodes[1]?.displayLabel, "VIX");
  assert.equal(model.outcome.permissionLabel, "Proceed with caution");
  assert.equal(model.outcome.primaryRisk, "Event risk is elevated");
  assert.match(model.methodology, /never recalculates the decision/i);
});

test("unverified example data can fill the diagram but can never open permission", () => {
  const model = buildEvidenceMap({
    conviction,
    verified: false,
    exampleOnly: true,
    permissionLabel: "Permitted with caution",
    permissionTone: "open",
    leanLabel: "Illustrative bullish lean",
    primaryRisk: null,
    freshness: "EXAMPLE ONLY",
  });

  assert.equal(model.exampleOnly, true);
  assert.equal(model.outcome.permissionTone, "blocked");
  assert.equal(model.outcome.permissionLabel, "WAIT FOR VERIFIED CONTEXT");
  assert.match(model.outcome.primaryRisk, /incomplete/i);
  assert.ok(model.nodes.every((node) => node.displayDataStatus === "Example only"));
  assert.ok(model.nodes.every((node) => /not a live source/i.test(node.sourceLabel)));
  assert.ok(model.nodes.every((node) => /deterministic example/i.test(node.displayExplanation)));
  assert.match(model.methodology, /No node is live or verified/i);
});

test("shared Evidence Map is accessible and replaces duplicate conviction lists", () => {
  const component = read("app/components/oracle/EvidenceMap.tsx");
  const dashboard = read("app/dashboard/components/MarketCommandCentre.tsx");
  const brief = read("app/brief/components/MorningMarketBrief.tsx");
  const stack = read("app/components/oracle/OracleCompanionStack.tsx");
  const css = read("app/components/oracle/oracle.css");

  assert.doesNotMatch(component, /["']use client["']/);
  assert.match(component, /aria-labelledby="evidence-map-title"/);
  assert.match(component, /role="list"/);
  assert.match(component, /<details>/);
  assert.match(component, /Read the Bullseye methodology/);
  for (const source of [dashboard, brief, stack]) {
    assert.match(source, /EvidenceMap/);
    assert.doesNotMatch(source, /<ConvictionExplainer/);
  }
  assert.match(css, /\.oracleEvidenceNodes summary:focus-visible/);
  assert.match(css, /@media\(max-width:640px\)[\s\S]*\.oracleEvidenceNodes\{grid-template-columns:1fr\}/);
});

test("marketing previews label the map as example-only while production callers default safely", () => {
  const builder = read("app/lib/oracle/build-oracle-bundle.ts");
  const dashboardPreview = read("app/marketing-preview/components/RealDashboardPreview.tsx");
  const briefPreview = read("app/marketing-preview/components/RealBriefPreview.tsx");

  assert.match(builder, /exampleOnly\?: boolean/);
  assert.match(builder, /exampleOnly: input\.exampleOnly/);
  assert.match(dashboardPreview, /verified: false,[\s\S]{0,80}exampleOnly: true/);
  assert.match(briefPreview, /verified: false,[\s\S]{0,80}exampleOnly: true/);
});
