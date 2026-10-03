import type {AxisVerification} from './axis-verification';
export type AxisBounds={left:number;right:number;top:number;bottom:number};
type Bounds=AxisBounds;
export type AxisReader=(image:HTMLImageElement,bounds:Bounds,rows:number[],model:Array<{price:number;y:number}>,signal:AbortSignal)=>Promise<AxisVerification>;
export function createSharedAxisReader(reader:AxisReader){
type AxisJob={promise:Promise<AxisVerification>;controller:AbortController;users:number;done:boolean;expires:number};
const axisJobs=new Map<string,AxisJob>();
/** Share identical source-image calibration. Cache verified evidence briefly in memory only. */
return async function verifyOriginalAxis(image:HTMLImageElement,bounds:Bounds,gridRows:number[],model:Array<{price:number;y:number}>,signal:AbortSignal):Promise<AxisVerification>{
 const cancelled:AxisVerification={status:'held',reason:'Price-axis verification cancelled.'};
 if(signal.aborted)return cancelled;
 for(const [key,job] of axisJobs)if(job.done&&job.expires<Date.now())axisJobs.delete(key);
 const key=JSON.stringify([image.currentSrc||image.src,image.naturalWidth,image.naturalHeight,bounds,gridRows,model]);
 let job=axisJobs.get(key);
 if(!job){
  const controller=new AbortController();
  job={controller,users:0,done:false,expires:0,promise:Promise.resolve(cancelled)};
  const entry=job;
  axisJobs.set(key,entry);
  entry.promise=reader(image,bounds,gridRows,model,controller.signal).then(result=>{
   entry.done=true;entry.expires=Date.now()+120000;
   if(result.status!=='verified'&&axisJobs.get(key)===entry)axisJobs.delete(key);
   // Retain at most three completed calibrations; never evict an active reader.
   const completed=[...axisJobs].filter(([,j])=>j.done);
   while(completed.length>3){const oldest=completed.shift()!;axisJobs.delete(oldest[0]);}
   return result;
  });
 }
 const entry=job;entry.users++;
 let listener:(()=>void)|undefined;
 const aborted=new Promise<AxisVerification>(resolve=>{listener=()=>resolve(cancelled);signal.addEventListener('abort',listener,{once:true});});
 try{return await Promise.race([entry.promise,aborted]);}
 finally{
  if(listener)signal.removeEventListener('abort',listener);
  entry.users--;
  if(entry.users===0&&!entry.done){entry.controller.abort();if(axisJobs.get(key)===entry)axisJobs.delete(key);}
 }
}
}
