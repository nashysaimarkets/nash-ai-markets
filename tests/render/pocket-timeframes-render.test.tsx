import test from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import ChartTimeframePicker from "../../app/pocket/ChartTimeframePicker";
import ScanChanges from "../../app/pocket/ScanChanges";
import { createSampleCharts } from "../../app/pocket/sample-analysis";
import { deriveAnalysisMaps } from "../../app/pocket/pocket-decision-intelligence";

test("five timeframes render as accessible source buttons and expose pending analysis", () => {
  const charts = createSampleCharts();
  const html = renderToStaticMarkup(<ChartTimeframePicker charts={charts} activeId={charts[0].id} pendingId={charts[2].id} disabled onSelect={() => undefined}/>);
  for (const chart of charts) assert.ok(html.includes(chart.timeframe));
  assert.equal(html.match(/aria-pressed="true"/g)?.length, 1);
  assert.equal(html.match(/disabled=""/g)?.length, 5);
  assert.ok(html.includes('role="progressbar"'));
  assert.ok(!html.includes("aria-valuenow"), "the activity bar does not invent progress");
});

test("the sample covers every analysis map and each source has distinct structure and levels", () => {
  const charts = createSampleCharts();
  for (const chart of charts) {
    assert.equal(deriveAnalysisMaps(chart.report!).length, 10);
    assert.ok(decodeURIComponent(chart.image).includes("FICTIONAL SAMPLE"));
    assert.equal(chart.report!.timeframe, chart.timeframe);
    const html = renderToStaticMarkup(<ScanChanges previous={null} analysis={chart.report!} image={chart.image} sample canCompare={async () => { throw new Error("sample must not request access"); }}/>);
    assert.ok(html.includes("WHAT CHANGED?")); assert.ok(!html.includes("<button"));
  }
  assert.notEqual(charts[0].report!.direction, charts[2].report!.direction);
  assert.notEqual(charts[0].report!.levels[0].price, charts[2].report!.levels[0].price);
});
