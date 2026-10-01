"use client";
import {axisWordsFromTsv,verifyAxisWords,type AxisVerification} from './axis-verification';
import type {Worker} from 'tesseract.js';

type Bounds={left:number;right:number;top:number;bottom:number};
/** The original pixels stay on this device. OCR assets are served by this app. */
export async function verifyOriginalAxis(image:HTMLImageElement,bounds:Bounds,gridRows:number[],model:Array<{price:number;y:number}>,signal:AbortSignal):Promise<AxisVerification>{
 let worker:Worker|undefined;let stopped=false;let timer:ReturnType<typeof setTimeout>|undefined;
 const stop=()=>{stopped=true;void worker?.terminate().catch(()=>{});};
 const deadline=new Promise<never>((_,reject)=>{
  timer=setTimeout(()=>{stop();reject(new Error('Axis verification timed out.'));},25000);
 });
 const aborted=new Promise<never>((_,reject)=>{
  if(signal.aborted)reject(new Error('Axis verification cancelled.'));
  else signal.addEventListener('abort',()=>{stop();reject(new Error('Axis verification cancelled.'));},{once:true});
 });
 const work=async():Promise<AxisVerification>=>{
  const {createWorker,PSM}=await import('tesseract.js');
  if(stopped||signal.aborted)throw new Error('Axis verification cancelled.');
  worker=await createWorker('eng',1,{workerPath:'/ocr/v6/worker.min.js',corePath:'/ocr/v6/core',langPath:'/ocr/v6/lang',workerBlobURL:false,cacheMethod:'write',errorHandler:()=>{}});
  if(stopped||signal.aborted){await worker.terminate();throw new Error('Axis verification cancelled.');}
  await worker.setParameters({tessedit_pageseg_mode:PSM.SPARSE_TEXT});
  let result:AxisVerification={status:'held',reason:'Independent price labels need a clearer axis.'};
  // One focused reread uses larger glyphs and contrast, not another AI scan.
  for(const attempt of [0,1]){
   if(stopped||signal.aborted)throw new Error('Axis verification cancelled.');
   const x=Math.floor(image.naturalWidth*Math.max(.65,(bounds.right-3)/100));
   const y=Math.max(0,Math.floor(image.naturalHeight*bounds.top/100));
   const width=image.naturalWidth-x,height=Math.min(image.naturalHeight-y,Math.ceil(image.naturalHeight*(bounds.bottom-bounds.top)/100));
   if(width<=0||height<=0)return {status:'held',reason:'Price-axis crop could not be verified.'};
   const scale=Math.min(attempt?3:2,4096/height,1200/width);
   const canvas=document.createElement('canvas');canvas.width=Math.round(width*scale);canvas.height=Math.round(height*scale);
   const context=canvas.getContext('2d',{willReadFrequently:true});if(!context)return {status:'held',reason:'Price-axis pixels unavailable.'};
   context.drawImage(image,x,y,width,height,0,0,canvas.width,canvas.height);
   if(attempt){const pixels=context.getImageData(0,0,canvas.width,canvas.height);for(let i=0;i<pixels.data.length;i+=4){const value=(pixels.data[i]+pixels.data[i+1]+pixels.data[i+2])/3;const tone=value>128?255:0;pixels.data[i]=pixels.data[i+1]=pixels.data[i+2]=tone;}context.putImageData(pixels,0,0);}
   const recognized=await worker.recognize(canvas,{}, {tsv:true});
   canvas.width=canvas.height=1;
   result=verifyAxisWords(axisWordsFromTsv(recognized.data.tsv??'',{x,y,scale}),gridRows.map(row=>row*image.naturalHeight/100),model,image.naturalHeight);
   if(result.status==='verified')return result;
  }
  return result;
 };
 try{return await Promise.race([work(),deadline,aborted]);}
 catch{return {status:'held',reason:signal.aborted?'Price-axis verification cancelled.':'Independent price reader unavailable. Try a clearer chart.'};}
 finally{if(timer)clearTimeout(timer);stop();}
}
