import test from 'node:test';import assert from 'node:assert/strict';
import {readCandlePixels} from '../app/pocket/candle-pixels';
const bounds={left:5,right:95,top:5,bottom:95};
function chart(){const width=200,height=200,data=new Uint8ClampedArray(width*height*4);for(let i=3;i<data.length;i+=4)data[i]=255;return {width,height,data};}
function rect(r:ReturnType<typeof chart>,left:number,top:number,right:number,bottom:number,colour=[240,30,30]){for(let y=top;y<=bottom;y++)for(let x=left;x<=right;x++){const i=(y*r.width+x)*4;r.data.set([...colour,255],i);}}
function candle(r:ReturnType<typeof chart>,x:number,high:number,low:number){rect(r,x,high,x,low);rect(r,x-1,high+5,x+1,low-5);}
test('locates real colour-connected wick endpoints without price or model coordinates',()=>{const r=chart();candle(r,50,40,90);candle(r,100,40,110);const c=readCandlePixels(r,bounds)!;assert.deepEqual(c.candles.map(v=>[v.x,v.highY,v.lowY]),[[50,40,90],[100,40,110]]);});
test('rejects horizontal annotations, body-only rectangles and clipped candles',()=>{const r=chart();rect(r,25,40,175,41);rect(r,60,60,63,90);candle(r,120,5,80);assert.equal(readCandlePixels(r,bounds)!.candles.length,0);});
test('ambiguous merged shapes, unsupported colours and malformed rasters are not repaired',()=>{const r=chart();rect(r,40,40,70,90);rect(r,100,40,102,90,[90,90,90]);assert.equal(readCandlePixels(r,bounds)!.candles.length,0);assert.equal(readCandlePixels({...r,data:new Uint8ClampedArray(4)},bounds),null);assert.equal(readCandlePixels(r,{...bounds,right:101}),null);});
