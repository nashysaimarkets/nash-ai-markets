import test from 'node:test';import assert from 'node:assert/strict';
import {preciseLiquidityZones} from '../app/pocket/precise-liquidity';
import {readCandlePixels} from '../app/pocket/candle-pixels';
const bounds={left:5,right:95,top:5,bottom:95};
function chart(){const width=200,height=200,data=new Uint8ClampedArray(width*height*4);for(let i=3;i<data.length;i+=4)data[i]=255;return {width,height,data};}
function rect(r:ReturnType<typeof chart>,left:number,top:number,right:number,bottom:number,colour=[240,30,30]){for(let y=top;y<=bottom;y++)for(let x=left;x<=right;x++){const i=(y*r.width+x)*4;r.data.set([...colour,255],i);}}
function candle(r:ReturnType<typeof chart>,x:number,high:number,low:number){rect(r,x,high,x,low);rect(r,x-1,high+5,x+1,low-5);}
test('locates real colour-connected wick endpoints without price or model coordinates',()=>{const r=chart();candle(r,50,40,90);candle(r,100,40,110);const c=readCandlePixels(r,bounds)!;assert.deepEqual(c.candles.map(v=>[v.x,v.highY,v.lowY]),[[50,40,90],[100,40,110]]);});
test('rejects horizontal annotations, body-only rectangles and clipped candles',()=>{const r=chart();rect(r,25,40,175,41);rect(r,60,60,63,90);candle(r,120,5,80);assert.equal(readCandlePixels(r,bounds)!.candles.length,0);});
test('ambiguous merged shapes, unsupported colours and malformed rasters are not repaired',()=>{const r=chart();rect(r,40,40,70,90);rect(r,100,40,102,90,[90,90,90]);assert.equal(readCandlePixels(r,bounds)!.candles.length,0);assert.equal(readCandlePixels({...r,data:new Uint8ClampedArray(4)},bounds),null);assert.equal(readCandlePixels(r,{...bounds,right:101}),null);});

test('an original raster can support a calibrated band, but an interior body crossing cannot',()=>{
 const r=chart();candle(r,50,110,130);candle(r,110,105,130);
 const anchors=[{price:3000,y:20},{price:2900,y:50},{price:2800,y:80}],axis={status:'verified' as const,anchors,matchedModelTicks:3,axisLeft:190};
 const zone={side:'BELOW_PRICE' as const,pattern:'EQUAL_LOWS' as const,label:'Lows',priceLow:2850,priceHigh:2850,confidence:'HIGH' as const,evidence:'Synthetic witness',touchPoints:[{x:25,y:65},{x:55,y:65}]};
 const shield={status:'VISIBLE_RISK_ZONES' as const,summary:'Synthetic',stopGuidance:'Verify',zones:[zone]};
 const call=(raster:typeof r)=>preciseLiquidityZones(shield,'2900',anchors,bounds,axis,200,200,readCandlePixels(raster,bounds));
 assert.equal(call(r).zones.length,1);
 const crossing=chart();candle(crossing,50,110,150);candle(crossing,110,105,150);assert.equal(call(crossing).zones.length,0);
});

test('stem ties use the column supporting both original endpoints',()=>{
 const r=chart();candle(r,50,40,90);rect(r,51,41,51,90);r.data.set([0,0,0,255],(60*r.width+50)*4);
 const c=readCandlePixels(r,bounds)!.candles;assert.equal(c.length,1);assert.equal(c[0].x,50);assert.equal(c[0].highY,40);assert.equal(c[0].lowY,90);
});

test('compressed candles need a regular mixed-colour price series before flat endpoints are accepted',()=>{
 const r=chart();for(let i=0;i<9;i++)rect(r,25+i*6,30+i*3,26+i*6,70+i*4,i%2?[40,160,40]:[240,30,30]);
 const c=readCandlePixels(r,bounds)!.candles;assert.equal(c.length,9);
 assert.deepEqual(c.map(v=>[v.highY,v.lowY]),Array.from({length:9},(_,i)=>[30+i*3,70+i*4]));
 assert.ok(c.every(v=>!v.upperWick&&!v.lowerWick));
});
test('regular rectangles with a shared histogram baseline, one colour or too few bars stay rejected',()=>{
 for(const variant of ['volume','one-colour','short','irregular']){
  const r=chart();for(let i=0;i<(variant==='short'?7:9);i++)rect(r,25+i*6+(variant==='irregular'?i%3*2:0),30+i*3,26+i*6+(variant==='irregular'?i%3*2:0),variant==='volume'?110:70+i*4,i%2&&variant!=='one-colour'?[40,160,40]:[240,30,30]);
  assert.equal(readCandlePixels(r,bounds)!.candles.length,0,variant);
 }
});
test('a tapered candle high at the body edge remains an exact price endpoint',()=>{
 const r=chart();for(const x of [50,110]){rect(r,x,70,x,100);rect(r,x-1,70,x+1,90);}
 const pixels=readCandlePixels(r,bounds)!;assert.equal(pixels.candles.length,2);assert.ok(pixels.candles.every(c=>!c.upperWick&&c.lowerWick));
 const anchors=[{price:3000,y:20},{price:2900,y:50},{price:2800,y:80}],axis={status:'verified' as const,anchors,matchedModelTicks:3,axisLeft:190};
 const zone={side:'ABOVE_PRICE' as const,pattern:'EQUAL_HIGHS' as const,label:'Highs',priceLow:2950,priceHigh:2950,confidence:'HIGH' as const,evidence:'Body-edge highs',touchPoints:[{x:25,y:35},{x:55,y:35}]};
 const shield={status:'VISIBLE_RISK_ZONES' as const,summary:'Synthetic',stopGuidance:'Verify',zones:[zone]};
 assert.equal(preciseLiquidityZones(shield,'2900',anchors,bounds,axis,200,200,pixels).zones.length,1);
});
