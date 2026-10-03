import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import IndependentScannerResult from '../../app/pocket/IndependentScannerResult';
import { completedScannerAnalysis } from '../../app/api/pocket/independent-scanner';
const result = completedScannerAnalysis(JSON.stringify({instrumentIdentifier:'US 500 (DFB)',timeframe:'30m',currentPrice:'7723.23',plotBounds:{left:5,right:85,top:10,bottom:85},priceScaleAnchors:[],patterns:[],evidenceQuality:{chartReadability:'CLEAR',instrumentConfidence:'HIGH',timeframeConfidence:'HIGH',scaleReadable:false,candlesReadable:true,limitations:[]},liquidityShield:{status:'INSUFFICIENT_EVIDENCE',zones:[],summary:'Scale uncertain',stopGuidance:'Verify'}}),null)!;
test('a missing narrative still exposes completed scanners and the exact source without a fabricated verdict', () => {
 const html=renderToStaticMarkup(<IndependentScannerResult analysis={result} sourceImage="data:image/png;base64,original-source"/>);
 assert.match(html,/COMPLETED SCANNER FINDINGS/); assert.match(html,/Written report unavailable/); assert.match(html,/data:image\/png;base64,original-source/);
 assert.match(html,/PATTERN WATCH/); assert.match(html,/LIQUIDITY GUARD/); assert.match(html,/No named pattern was reported/);
 assert.doesNotMatch(html,/AI SETUP GRADE|STAND_ASIDE|\<svg/);
});
