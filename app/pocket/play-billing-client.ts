/** Pure Android boundary. Native assertions never grant subscription access. */
type Ports = { identity:()=>Promise<{url:string;revision:string}>; status:(restore:boolean)=>Promise<{purchaseToken?:unknown}>; fetch:typeof fetch; origin:()=>string };
export function createPlayClient(ports:Ports, timeoutMs=10000) {
 if(!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>10000)throw Error('Invalid deadline');
 async function perform(input:string,init:RequestInit={},restore=false){
  const target=new URL(input,'https://local.invalid');
  if(!input.startsWith('/api/pocket/')||input.includes('\\')||target.origin!=='https://local.invalid'||target.hash||target.pathname!==input.split('?')[0]||!/^\/api\/pocket\/[a-z0-9/-]+$/i.test(target.pathname))throw Error('Local Pocket endpoint required');
  const controller=new AbortController(),abort=()=>controller.abort();let timer:ReturnType<typeof setTimeout>|undefined;
  init.signal?.addEventListener('abort',abort,{once:true});if(init.signal?.aborted)abort();
  const stopped=new Promise<never>((_,reject)=>{const stop=()=>reject(Error('Play check cancelled or timed out'));controller.signal.addEventListener('abort',stop,{once:true});if(controller.signal.aborted)stop();timer=setTimeout(abort,timeoutMs);});
  void stopped.catch(()=>{});
 const wait=<T,>(action:()=>Promise<T>)=>Promise.race([Promise.resolve().then(()=>{controller.signal.throwIfAborted();return action();}),stopped]);
  let reader:ReadableStreamDefaultReader<Uint8Array>|undefined;
  async function json(response:Response){
   if(!response.ok||!/^application\/json(?:;|$)/i.test(response.headers.get('content-type')??'')){void response.body?.cancel();throw Error('Play backend unavailable');}
   reader=response.body?.getReader();if(!reader)throw Error('Empty response');let size=0,text='';const decoder=new TextDecoder('utf-8',{fatal:true});
   while(true){const next=await wait(()=>reader!.read());if(next.done)break;size+=next.value.byteLength;if(size>16384)throw Error('Oversized response');text+=decoder.decode(next.value,{stream:true});}
   text+=decoder.decode();reader.releaseLock();reader=undefined;return JSON.parse(text);
  }
  async function request(path:string,options:RequestInit){const pending=ports.fetch(path,{...options,signal:controller.signal,redirect:'error',credentials:'same-origin'});void pending.then(r=>{if(controller.signal.aborted)void r.body?.cancel().catch(()=>{});},()=>{});return wait(()=>pending);}
  try{
   const identity=await wait(ports.identity),url=new URL(identity.url);
   if(url.protocol!=='https:'||url.origin!==ports.origin()||url.pathname!=='/pocket'||url.search||url.hash||url.username||url.password||url.hostname==='pocket.nashaimarkets.com'||url.hostname.includes('-git-')||!/^[a-f0-9]{40}$/.test(identity.revision))throw Error('Unverified Android backend');
   const manifest=await json(await request('/api/pocket/build-manifest',{}));if(manifest.revision!==identity.revision)throw Error('Android backend revision mismatch');
   const status=await wait(()=>ports.status(restore)),token=status?.purchaseToken;
   if((restore&&token===undefined)||(token!==undefined&&(typeof token!=='string'||!token.length||token.length>8192||/[\s\x00-\x1f\x7f]/.test(token))))throw Error('Restore requires verified purchase ownership');
   const headers=new Headers(init.headers);headers.delete('x-pocket-apple-transaction');headers.delete('x-pocket-google-token');if(typeof token==='string')headers.set('x-pocket-google-token',token);
   if(!restore){
    controller.signal.throwIfAborted();init.signal?.throwIfAborted();
    // Preserve scanner-owned deadlines/body limits; only native proof acquisition
    // uses this ten-second metadata budget. No automatic retry after dispatch.
    return ports.fetch(input,{...init,headers,redirect:'error',credentials:'same-origin'});
   }
   const response=await request(input,{...init,headers});
   // Buffer a bounded response before clearing deadline; callers cannot hang on body.
   const payload=await json(response);controller.signal.throwIfAborted();
   return Response.json(payload,{status:response.status,headers:{'Cache-Control':'private, no-store'}});
  }finally{clearTimeout(timer);controller.abort();init.signal?.removeEventListener('abort',abort);if(reader){void reader.cancel().catch(()=>{});reader.releaseLock();}}
 }
 return {request:perform,restore:(signal?:AbortSignal)=>perform('/api/pocket/google-account',{method:'POST',signal},true)};
}
