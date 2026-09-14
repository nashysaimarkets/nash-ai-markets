import test from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import TimeframeEvidenceStrip from "../../app/pocket/TimeframeEvidenceStrip";
import { createSampleCharts } from "../../app/pocket/sample-analysis";

test("evidence cards show original wording, individual source images and one selected control", () => {
  const charts = createSampleCharts();
  const html = renderToStaticMarkup(<TimeframeEvidenceStrip charts={charts} activeId={charts[0].id} pendingId={null} disabled={false} onSelect={() => { throw new Error("render must not request a scan"); }} />);
  assert.equal(html.match(/aria-pressed="true"/g)?.length, 1);
  assert.equal(html.match(/class="psEvidenceCard"/g)?.length, 5);
  assert.ok(html.includes("5 of 5 ready"));
  for (const label of ["Trend", "Structure", "Momentum", "Trend agrees · 5m", "Trend conflicts · 5m", "Mixed trend · 5m", "Full wording"]) assert.ok(html.includes(label), label);
  assert.ok(html.includes("No RSI or MACD panel is supplied."), "clipping does not discard the report's qualifications");
  assert.equal(html.match(/<img /g)?.length, 5);
});

test("partial progress keeps ready cards selectable and does not invent evidence for waiting cards", () => {
  const charts = createSampleCharts().map((chart, index) => index < 2 ? chart : { ...chart, report: undefined, preparation: index === 2 ? "verifying" as const : "failed" as const });
  const html = renderToStaticMarkup(<TimeframeEvidenceStrip charts={charts} activeId={charts[0].id} pendingId={charts[2].id} disabled={false} onSelect={() => undefined} />);
  for (const label of ["2 of 5 ready", "VERIFYING…", "TAP TO RETRY", "Awaiting analysis", "Chart 3"]) assert.ok(html.includes(label), label);
  assert.ok(!html.includes('disabled=""'));
  assert.ok(!html.includes("Trend conflicts"));
  assert.ok(!html.includes("aria-valuenow"));
});

test("empty and single-chart sessions need no extra uploads; active operations retain the existing selection lock", () => {
  const charts = createSampleCharts().slice(0, 1);
  assert.equal(renderToStaticMarkup(<TimeframeEvidenceStrip charts={[]} activeId="" pendingId={null} disabled={false} onSelect={() => undefined} />), "");
  const html = renderToStaticMarkup(<TimeframeEvidenceStrip charts={charts} activeId={charts[0].id} pendingId={null} disabled={true} onSelect={() => undefined} />);
  assert.ok(html.includes("1 of 1 ready"));
  assert.equal(html.match(/class="psEvidenceCard"/g)?.length, 1);
  assert.ok(html.includes('disabled=""'));
});
