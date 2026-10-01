import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import InteractiveLevelScanner from '../../app/pocket/InteractiveLevelScanner';
import { createSampleCharts } from '../../app/pocket/sample-analysis';
const sample=createSampleCharts()[0];const analysis=sample.report!;
test('original screenshot is shown before dimensions are known without premature overlays',()=>{
 const html=renderToStaticMarkup(<InteractiveLevelScanner analysis={analysis} sourceImage={sample.image}/>);
 assert.match(html,/original uploaded chart/);assert.match(html,/Loading original chart/);
 assert.doesNotMatch(html,/<svg|psScannerStage|psHolo/);assert.match(html,/Levels withheld/);
});
test('each scenario preserves the supplied source condition without manufacturing prices',()=>{
 const supplied={...analysis,bullConfirmation:'UP condition',bearConfirmation:'DOWN condition',nextSequence:{...analysis.nextSequence,patience:'WAIT condition'}};
 for(const [scenario,condition] of [['bull','UP'],['bear','DOWN'],['wait','WAIT']] as const){const html=renderToStaticMarkup(<InteractiveLevelScanner analysis={analysis} sourceAnalysis={supplied} scenario={scenario}/>);assert.match(html,new RegExp(`${condition} condition`));assert.match(html,/not a price forecast/);}
});
test('missing source image never generates a replacement chart or an overlay',()=>{
 const html=renderToStaticMarkup(<InteractiveLevelScanner analysis={analysis}/>);
 assert.match(html,/Original screenshot unavailable/);assert.doesNotMatch(html,/<img|<svg/);
});
