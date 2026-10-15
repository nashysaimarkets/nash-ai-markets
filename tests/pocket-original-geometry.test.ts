import assert from "node:assert/strict";
import test from "node:test";
import { readCandlePixels } from "../app/pocket/candle-pixels.ts";
import { pixelCheckedPatterns, pixelCheckedLiquidity } from "../app/pocket/original-pixel-geometry.ts";
const bounds = { left: 5, right: 90, top: 10, bottom: 90 };
const pixels = { width: 1000, height: 2000, candles: [
 { id: 0, left: 249, right: 251, x: 250, highY: 400, lowY: 700, upperWick: true, lowerWick: true },
 { id: 1, left: 549, right: 551, x: 550, highY: 500, lowY: 700, upperWick: true, lowerWick: true },
 { id: 2, left: 749, right: 751, x: 750, highY: 400, lowY: 800, upperWick: true, lowerWick: true },
] };
const pattern = { name: "DOUBLE TOP", timeframe: "1h", status: "FORMING", confidence: "MEDIUM", geometry: { points: [{x:25,y:20},{x:55,y:35},{x:75,y:20}],labelX:25,labelY:20 } };
const anchors = [{price:3000,y:20},{price:2900,y:50},{price:2800,y:80}];
const axis = {status:"verified" as const, anchors,matchedModelTicks:3,axisLeft:950};
const report = { evidenceQuality: {chartReadability:"CLEAR",instrumentConfidence:"HIGH",timeframeConfidence:"HIGH",scaleReadable:true,candlesReadable:true}, plotBounds: bounds, priceScaleAnchors:anchors, levels:[],currentPrice:"2950",timeframe:"1h", patterns:[pattern], liquidity:{state:"VERIFIED",confidence:"HIGH",zones:[{side:"SELL_SIDE",basis:"EQUAL_LOWS",price:"2950",x:20,x2:60,y:35}],observations:[{side:"sell-side",x:25,y:35,confidence:"HIGH"},{side:"sell-side",x:55,y:35,confidence:"HIGH"}]} };
// 2950 at y=35; current is 2975 for a sell-side reference.
const check = (r = {...report,currentPrice:"2975"}, p = pixels) => pixelCheckedLiquidity(r,true,axis,p);
test("every pattern vertex requires a distinct correctly ordered original candle endpoint", () => {
 assert.equal(pixelCheckedPatterns([pattern],"1h",bounds,pixels).length,1);
 for(const change of [{timeframe:"4h"},{sourceRole:"HIGHER_TIMEFRAME"},{confidence:"LOW"},{geometry:{...pattern.geometry,points:[{x:25,y:21},{x:55,y:35},{x:75,y:20}]}}]) assert.equal(pixelCheckedPatterns([{...pattern,...change}],"1h",bounds,pixels).length,0);
 assert.equal(pixelCheckedPatterns([pattern],"1h",bounds,{...pixels,candles:[...pixels.candles,{...pixels.candles[0],id:4}]}).length,0);
});
test("liquidity rows require independent prices and distinct correct-side endpoints; an unsupported third touch is not dropped", () => {
 assert.equal(check().length,1);
 assert.equal(check({...report,currentPrice:"2900"}).length,0);
 assert.equal(check({...report,currentPrice:"2975",liquidity:{...report.liquidity,observations:[...report.liquidity.observations,{side:"sell-side",x:40,y:35,confidence:"HIGH"}]}}).length,0);
 assert.equal(pixelCheckedLiquidity({...report,currentPrice:"2975"},false,axis,pixels).length,0);
 assert.equal(pixelCheckedLiquidity({...report,currentPrice:"2975"},true,{status:"held",reason:"no scale"},pixels).length,0);
 assert.equal(check({...report,currentPrice:"2975",liquidity:{...report.liquidity,confidence:"MEDIUM"}}).length,0);
});
function raster() { const width=200,height=200,data=new Uint8ClampedArray(width*height*4); for(let i=3;i<data.length;i+=4)data[i]=255; return {width,height,data}; }
function rect(r:ReturnType<typeof raster>,left:number,top:number,right:number,bottom:number,colour=[240,30,30]) { for(let y=top;y<=bottom;y++)for(let x=left;x<=right;x++)r.data.set([...colour,255],(y*r.width+x)*4); }
test("compressed candles require a regular mixed-color run; histograms, isolated rectangles and malformed rasters stay absent", () => {
 const r=raster(); for(let i=0;i<9;i++)rect(r,25+i*6,30+i*3,26+i*6,70+i*4,i%2?[40,160,40]:[240,30,30]);
 assert.equal(readCandlePixels(r,{left:5,right:95,top:5,bottom:95})?.candles.length,9);
 for(const variant of ["volume","one-color","short","irregular"]) {
  const r=raster(); for(let i=0;i<(variant==="short"?7:9);i++)rect(r,25+i*6+(variant==="irregular"?i%3*2:0),30+i*3,26+i*6+(variant==="irregular"?i%3*2:0),variant==="volume"?110:70+i*4,i%2&&variant!=="one-color"?[40,160,40]:[240,30,30]);
  assert.equal(readCandlePixels(r,{left:5,right:95,top:5,bottom:95})?.candles.length,0,variant);
 }
 assert.equal(readCandlePixels({...r,data:new Uint8ClampedArray(4)},bounds),null);
});

test('dedicated liquidity intervals preserve exact price endpoints, including zero-width lines',()=>{
 const base={...report,currentPrice:'2975',liquidity:{...report.liquidity,zones:[{...report.liquidity.zones[0],priceLow:2949,priceHigh:2951}],observations:[{side:'sell-side',x:25,y:34.7,confidence:'HIGH'},{side:'sell-side',x:55,y:35.3,confidence:'HIGH'}]}};
 const p={...pixels,candles:pixels.candles.map((c,i)=>({...c,lowY:i===0?694:i===1?706:c.lowY}))};
 const bands=pixelCheckedLiquidity(base,true,axis,p);
 assert.equal(bands.length,1);
 assert.ok(Math.abs(bands[0].top-34.7)<1e-8);
 assert.ok(Math.abs(bands[0].height-.6)<1e-8,'keep exact interval, never visual padding');
 const line=pixelCheckedLiquidity({...report,currentPrice:'2975'},true,axis,pixels);
 assert.equal(line[0].height,0);
 for(const range of [{priceLow:2799,priceHigh:2951},{priceLow:2951,priceHigh:2949},{priceLow:2949},{priceLow:2949,priceHigh:3000}]){
  assert.equal(pixelCheckedLiquidity({...base,liquidity:{...base.liquidity,zones:[{...report.liquidity.zones[0],...range}]}},true,axis,p).length,0);
 }
 const third={...base,liquidity:{...base.liquidity,observations:[...base.liquidity.observations,{side:'sell-side',x:40,y:35,confidence:'HIGH'}]}};
 assert.equal(pixelCheckedLiquidity(third,true,axis,p).length,0,'unsupported third witness must reject complete band');
});
