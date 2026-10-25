import test from 'node:test';
import assert from 'node:assert/strict';
import {automaticChartConfirmation} from '../app/pocket/chart-preflight.ts';
const ready={status:'READY',instrument:'US 500',instrumentConfidence:'HIGH',timeframe:'5m',timeframeConfidence:'HIGH',currentPrice:'6725.50',currentPriceConfidence:'HIGH',priceScaleVisible:true,candlesReadable:true,enoughHistory:true,sameInstrument:null,issues:[],guidance:''};
test('clear chart auto-admits without a checkbox or manual fact entry',()=>assert.deepEqual(automaticChartConfirmation(ready,false),{instrument:'US 500',timeframe:'5m',currentPrice:'6725.50',contextMatch:'NOT_PROVIDED'}));
for(const patch of [{status:'RETAKE'},{priceScaleVisible:false},{candlesReadable:false},{enoughHistory:false},{currentPrice:'UNKNOWN'},{currentPrice:'0'},{currentPrice:'1..2'},{instrument:'UNKNOWN'},{timeframe:'UNKNOWN'}, {instrumentConfidence:'LOW'}, {timeframeConfidence:'MEDIUM'}, {currentPriceConfidence:'UNKNOWN'}])test('automatic hold '+JSON.stringify(patch),()=>assert.equal(automaticChartConfirmation({...ready,...patch},false),null));
test('discrete uncertain field correction preserves detected fields',()=>{
 const uncertain={...ready,instrument:'',instrumentConfidence:'UNKNOWN'};
 assert.equal(automaticChartConfirmation(uncertain,false),null);
 assert.deepEqual(automaticChartConfirmation(uncertain,false,{instrument:'US 500',timeframe:'FAKE',currentPrice:'999'}),automaticChartConfirmation(ready,false));
});
test('corrections cannot override unreadable geometry or unknown/mismatched context',()=>{
 for(const patch of [{priceScaleVisible:false},{candlesReadable:false},{enoughHistory:false},{status:'RETAKE'},{sameInstrument:false},{sameInstrument:null}])assert.equal(automaticChartConfirmation({...ready,...patch},true,{instrument:'US 500',timeframe:'5m',currentPrice:'6725.50'}),null);
});
test('malformed transport never admits',()=>{for(const input of [null,{}, {...ready,priceScaleVisible:'true'}])assert.equal(automaticChartConfirmation(input,false),null);});
