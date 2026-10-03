"use client";
import {axisWordsFromTsv,axisRetryColumn,verifyAxisWords,type AxisVerification,type AxisWord} from './axis-verification';
import {axisReadingBounds} from './axis-reading-bounds';
import type {Worker} from 'tesseract.js';
import {createSharedAxisReader} from './axis-reader-cache';

type Bounds={left:number;right:number;top:number;bottom:number};
export const verifyOriginalAxis=createSharedAxisReader(readOriginalAxis);
/** The original pixels stay on this device. OCR assets are served by this app. */
async function readOriginalAxis(image:HTMLImageElement,bounds:Bounds,gridRows:number[],model:Array<{price:number;y:number}>,signal:AbortSignal):Promise<AxisVerification>{
 let worker:Worker|undefined;let stopped=false;let timer:ReturnType<typeof setTimeout>|undefined;let onAbort:(()=>void)|undefined;
 const stop=()=>{stopped=true;void worker?.terminate().catch(()=>{});};
 const deadline=new Promise<never>((_,reject)=>{
  timer=setTimeout(()=>{stop();reject(new Error('Axis verification timed out.'));},25000);
 });
 const aborted=new Promise<never>((_,reject)=>{
  if(signal.aborted)reject(new Error('Axis verification cancelled.'));
  else {onAbort=()=>{stop();reject(new Error('Axis verification cancelled.'));};signal.addEventListener('abort',onAbort,{once:true});}
 });
 const work=async():Promise<AxisVerification>=>{
  const {createWorker,PSM}=await import('tesseract.js');
  if(stopped||signal.aborted)throw new Error('Axis verification cancelled.');
  worker=await createWorker('eng',1,{workerPath:'/ocr/v6/worker.min.js',corePath:'/ocr/v6/core',langPath:'/ocr/v6/lang',workerBlobURL:false,cacheMethod:'write',errorHandler:()=>{}});
  if(stopped||signal.aborted){await worker.terminate();throw new Error('Axis verification cancelled.');}
  await worker.setParameters({tessedit_pageseg_mode:PSM.SPARSE_TEXT});
  let result:AxisVerification={status:'held',reason:'Independent price labels need a clearer axis.'};
  let words:AxisWord[]=[];
  // One focused reread uses a numeric column layout, not another AI scan.
  for(const attempt of [0,1]){
   if(stopped||signal.aborted)throw new Error('Axis verification cancelled.');
   const column=attempt?axisRetryColumn(words,image.naturalWidth):{left:Math.floor(image.naturalWidth*.65),right:image.naturalWidth};
   const x=column.left,reading=axisReadingBounds(bounds,image.naturalHeight);
   const y=Math.max(0,Math.floor(image.naturalHeight*reading.top/100));
   const width=column.right-x,height=Math.min(image.naturalHeight-y,Math.ceil(image.naturalHeight*(reading.bottom-reading.top)/100));
   if(width<=0||height<=0)return {status:'held',reason:'Price-axis crop could not be verified.'};
   const scale=Math.min(attempt?3:2,4096/height,1200/width);
   const canvas=document.createElement('canvas');canvas.width=Math.round(width*scale);canvas.height=Math.round(height*scale);
   const context=canvas.getContext('2d',{willReadFrequently:true});if(!context)return {status:'held',reason:'Price-axis pixels unavailable.'};
   context.drawImage(image,x,y,width,height,0,0,canvas.width,canvas.height);
   if(attempt)await worker.setParameters({tessedit_pageseg_mode:PSM.SINGLE_BLOCK,tessedit_char_whitelist:'0123456789.,$£€'});
   const recognized=await worker.recognize(canvas,{}, {tsv:true});
   canvas.width=canvas.height=1;
   words=axisWordsFromTsv(recognized.data.tsv??'',{x,y,scale});
   result=verifyAxisWords(words,gridRows.map(row=>row*image.naturalHeight/100),model,image.naturalHeight);
   if(result.status==='verified')return result;
  }
  return result;
 };
 try{return await Promise.race([work(),deadline,aborted]);}
 catch{return {status:'held',reason:signal.aborted?'Price-axis verification cancelled.':'Independent price reader unavailable. Try a clearer chart.'};}
 finally{if(timer)clearTimeout(timer);if(onAbort)signal.removeEventListener('abort',onAbort);stop();}
}
