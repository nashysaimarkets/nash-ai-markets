import test from 'node:test';
import assert from 'node:assert/strict';
import { measureChart } from '../app/pocket/browser-chart-extractor';

async function withBrowser(failDecode:boolean,run:()=>Promise<void>){
 const names=['Image','document','fetch','createImageBitmap'] as const;
 const previous=names.map(name=>[name,Object.getOwnPropertyDescriptor(globalThis,name)] as const);
 let fetched=false;
 class LocalImage {
  naturalWidth=1179;naturalHeight=2556;
  onload:(()=>void)|null=null;onerror:(()=>void)|null=null;
  set src(value:string){assert.match(value,/^data:image\/png;base64,/);queueMicrotask(()=>failDecode?this.onerror?.():this.onload?.());}
 }
 Object.defineProperty(globalThis,'Image',{configurable:true,value:LocalImage});
 Object.defineProperty(globalThis,'fetch',{configurable:true,value:()=>{fetched=true;throw new TypeError('Load failed');}});
 Object.defineProperty(globalThis,'createImageBitmap',{configurable:true,value:undefined});
 Object.defineProperty(globalThis,'document',{configurable:true,value:{createElement(tag:string){
  assert.equal(tag,'canvas');
  return {width:0,height:0,getContext(){return {
   drawImage(_image:unknown,_x:number,_y:number,width:number,height:number){assert.equal(width,415);assert.equal(height,900);},
   getImageData(_x:number,_y:number,width:number,height:number){return {data:new Uint8ClampedArray(width*height*4)};},
  };}};
 }}});
 try{await run();assert.equal(fetched,false);}finally{for(const [name,descriptor] of previous){if(descriptor)Object.defineProperty(globalThis,name,descriptor);else Reflect.deleteProperty(globalThis,name);}}
}
test('local uploaded chart is measured without data-URL fetch or ImageBitmap support',async()=>{
 await withBrowser(false,async()=>{
  const evidence=await measureChart('data:image/png;base64,AA==','PRIMARY');
  assert.deepEqual(evidence.image,{width:415,height:900});
  assert.equal(evidence.role,'PRIMARY');
  assert.equal(evidence.candles.count,0);
 });
});
test('an image decode failure reports the local preparation problem',async()=>{
 await withBrowser(true,async()=>{await assert.rejects(measureChart('data:image/png;base64,AA==','PRIMARY'),/could not decode the chart for measurement/);});
});
