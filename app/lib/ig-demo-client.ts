import type {IgDemoAction} from './ig-demo-workspace.ts';
/** Fixed same-origin browser bridge; no broker credentials or direct provider access. */
export async function sendIgDemoAction(action:IgDemoAction,signal:AbortSignal,chartToken?:string,transport:typeof fetch=fetch):Promise<unknown>{
 signal.throwIfAborted();
 const controller=new AbortController(),abort=()=>controller.abort();signal.addEventListener('abort',abort,{once:true});
 const timer=setTimeout(abort,10000);let reader:ReadableStreamDefaultReader<Uint8Array>|undefined;let response:Response|undefined;
 const wait=<T,>(p:Promise<T>)=>new Promise<T>((resolve,reject)=>{const stop=()=>reject(Error('UNAVAILABLE'));if(controller.signal.aborted)return stop();controller.signal.addEventListener('abort',stop,{once:true});p.then(resolve,reject).finally(()=>controller.signal.removeEventListener('abort',stop));});
 try{
  if(!['connect','refresh','disconnect'].includes(action)||(chartToken!==undefined&&!/^[A-Za-z0-9:_-]{1,96}$/.test(chartToken)))throw Error('UNAVAILABLE');
  const pending=transport('/api/pocket/ig-demo',{method:'POST',credentials:'same-origin',cache:'no-store',redirect:'error',signal:controller.signal,headers:{'Content-Type':'application/json','X-Pocket-IG-Demo':'1'},body:JSON.stringify({action,...(chartToken?{chartToken}:{})})});
  void pending.then(r=>{if(controller.signal.aborted)void r.body?.cancel().catch(()=>{});},()=>{});
  response=await wait(pending);
  if(!response.ok)throw Error(response.status===429?'RATE_LIMITED':'UNAVAILABLE');
  if(!/^application\/json(?:\s*;|$)/i.test(response.headers.get('content-type')??'')||!response.body)throw Error('UNAVAILABLE');
  const length=response.headers.get('content-length');if(length!==null&&(!/^\d+$/.test(length)||Number(length)>65536))throw Error('UNAVAILABLE');
  reader=response.body.getReader();const chunks:Uint8Array[]=[];let size=0;
  while(true){const next=await wait(reader.read());if(next.done)break;size+=next.value.byteLength;if(size>65536)throw Error('UNAVAILABLE');chunks.push(next.value);}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
 }finally{clearTimeout(timer);signal.removeEventListener('abort',abort);controller.abort();if(reader)void reader.cancel().catch(()=>{});else void response?.body?.cancel().catch(()=>{});}
}
