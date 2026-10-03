import test from 'node:test';import assert from 'node:assert/strict';
import {axisReadingBounds} from '../app/pocket/axis-reading-bounds';
import {chartGridRows} from '../app/pocket/chart-grid-rows';
test('OCR margin reads a complete boundary label without changing the drawable plot',()=>{
 const b={left:5,right:90,top:18.3,bottom:86.8};const r=axisReadingBounds(b,2556);
 assert.equal(r.top,16.8);assert.equal(r.bottom,88.3);assert.equal(b.top,18.3);assert.equal(r.right,90);
 assert.equal(axisReadingBounds(b,10000).top,17.900000000000002);
 assert.deepEqual(axisReadingBounds({top:0,bottom:100},2556),{top:0,bottom:100});
});
test('independent grid detection includes a rule just outside a truncated model boundary, not remote rows',()=>{
 const width=120,height=1000,data=new Uint8ClampedArray(width*height*4);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){const tone=[100,190,400,600,810,900].some(row=>Math.abs(y-row)<=1)?70:18;data.set([tone,tone,tone,255],(y*width+x)*4);}
 assert.deepEqual(chartGridRows({width,height,data},{left:0,right:100,top:20,bottom:80}).map(y=>Math.round(y*height/100)),[190,400,600,810]);
});
