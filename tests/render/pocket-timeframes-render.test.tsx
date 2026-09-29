import test from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import ChartTimeframePicker from "../../app/pocket/ChartTimeframePicker";
import ScanChanges from "../../app/pocket/ScanChanges";
import { createSampleCharts } from "../../app/pocket/sample-analysis";
import { deriveAnalysisMaps } from "../../app/pocket/pocket-decision-intelligence";

test("the compact chart selector exposes its active timeframe without the old banner", () => {
  const charts = createSampleCharts();
  const html = renderToStaticMarkup(<ChartTimeframePicker charts={charts} activeId={charts[0].id} pendingId={charts[2].id} disabled={false} onSelect={() => undefined}/>);
  assert.ok(html.includes('aria-haspopup="dialog"'));
  assert.ok(html.includes(`chart 1 of ${charts.length}`));
  assert.ok(html.includes(charts[0].timeframe));
  assert.ok(!html.includes("Applies to every analysis section"));
  assert.ok(!html.includes("psTimeframePicker"));
});

test("the sample covers every analysis map and each source has distinct structure and levels", () => {
  const charts = createSampleCharts();
  for (const chart of charts) {
    assert.equal(deriveAnalysisMaps(chart.report!).length, 10);
    assert.ok(decodeURIComponent(chart.image).includes("FICTIONAL SAMPLE"));
    assert.equal(chart.report!.timeframe, chart.timeframe);
    const html = renderToStaticMarkup(<ScanChanges previous={null} analysis={chart.report!} image={chart.image} sample onCompared={async () => { throw new Error("sample must not persist"); }} canCompare={async () => { throw new Error("sample must not request access"); }}/>);
    assert.ok(html.includes("WHAT CHANGED?")); assert.ok(!html.includes("<button"));
  }
  assert.notEqual(charts[0].report!.direction, charts[2].report!.direction);
  assert.notEqual(charts[0].report!.levels[0].price, charts[2].report!.levels[0].price);
});

test("chart selector remains available while sibling analyses prepare", () => {
  const charts = createSampleCharts().map((chart, index) => ({ ...chart, report: index < 2 ? chart.report : undefined,
    preparation: index === 2 ? "analysing" as const : undefined }));
  const html = renderToStaticMarkup(<ChartTimeframePicker charts={charts} activeId={charts[0].id} pendingId={null} disabled={false} onSelect={() => undefined}/>);
  assert.ok(html.includes('aria-expanded="false"'));
  assert.ok(!html.includes('disabled=""'));
});
