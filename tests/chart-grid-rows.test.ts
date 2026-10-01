import test from 'node:test';
import assert from 'node:assert/strict';
import { chartGridRows } from '../app/pocket/chart-grid-rows';

const bounds={left:0,right:100,top:0,bottom:100};
function raster(grid:number[]){
 const width=120,height=480,data=new Uint8ClampedArray(width*height*4);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const offset=(y*width+x)*4;const tone=grid.some(row=>Math.abs(row-y)<=1)?70:18;
  data.set([tone,tone,tone,255],offset);
  // Vertical rules and short candle marks must not become horizontal rules.
  if(x===60)data.set([70,70,70,255],offset);
  if(x>=20&&x<=23&&y>=130&&y<=300)data.set([220,30,30,255],offset);
 }
 return {data,width,height};
}
test('measures independent original-raster centres despite vertical rules and candles',()=>{
 const image=raster([80,240,400]);
 assert.deepEqual(chartGridRows(image,bounds).map(y=>Math.round(y*image.height/100)),[80,240,400]);
 assert.deepEqual(chartGridRows(image,{...bounds,top:25,bottom:75}).map(y=>Math.round(y*image.height/100)),[240]);
});
test('blank charts, vertical rules, missing pixels and invalid bounds provide no raster proof',()=>{
 assert.deepEqual(chartGridRows(raster([]),bounds),[]);
 assert.deepEqual(chartGridRows({data:new Uint8ClampedArray(),width:120,height:480},bounds),[]);
 assert.deepEqual(chartGridRows(raster([80,240,400]),{...bounds,right:NaN}),[]);
});
