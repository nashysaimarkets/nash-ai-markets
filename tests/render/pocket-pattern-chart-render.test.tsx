import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { PatternWatch } from '../../app/pocket/PocketBullseye';
import { createSampleCharts } from '../../app/pocket/sample-analysis';

const sample = createSampleCharts()[0];
test('Pattern Watch shows the selected source inline even with no drawable patterns', () => {
  const html = renderToStaticMarkup(<PatternWatch
    analysis={{ ...sample.report!, patterns: [] }} sourceImage={sample.image}
    primaryLevels={[]} onAddChart={() => {}} onReanalyse={() => {}}
    hasContext={false} reanalysing={false}
  />);
  assert.match(html, /Original uploaded chart for historical pattern inspection/);
  assert.ok(html.includes(`src="${sample.image}"`));
  assert.ok(html.indexOf('psXRayCanvas') < html.indexOf('psPatternGuide'));
  assert.doesNotMatch(html, /VIEW MY CHART|<svg class="psXRayPatterns"/);
  assert.match(html, /NO PATTERN REPORTED/);
});
