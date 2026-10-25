/** Explicit sandbox server adapter for an already verified, owned purchase.
 * The caller must use the existing ownership/runtime policy before invoking it.
 * No default credentials, activation, retry, entitlement grant or network on import.
 */
const ORIGIN='https://androidpublisher.googleapis.com';
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const text=(value,max)=>typeof value==='string'&&value.length>0&&value.length<=max&&!/[\s\x00-\x1f\x7f]/u.test(value);
const fail=()=>{throw Error('GOOGLE_ACKNOWLEDGEMENT_INVALID');};
const cancelBody=response=>{try{if(response?.body&&!response.body.locked)void Promise.resolve(response.body.cancel()).catch(()=>{});}catch{}};

export function createGoogleSubscriptionAcknowledger(config,ports){
 if(typeof window!=='undefined'||!object(config)||!object(ports))fail();
 const {packageName,productId,environment,acknowledgementEnabled}=config;
 const timeoutMs=config.timeoutMs??10000;
 const {readAccessToken,fetch:fetchOnce}=ports;
 if(environment!=='sandbox'||acknowledgementEnabled!==true||typeof packageName!=='string'||packageName.length>255||
    !/^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)+$/i.test(packageName??'')||
    !text(productId,150)||['.','..'].includes(productId)||
    !Number.isSafeInteger(timeoutMs)||timeoutMs<1||timeoutMs>10000||
    typeof readAccessToken!=='function'||typeof fetchOnce!=='function')fail();

 return Object.freeze({async acknowledge(input={}){
  let dispatched=false,controller,timer,externalSignal,onAbort,response,complete=false;
  try{
   if(!object(input)||input.packageName!==packageName||input.productId!==productId||
      !text(input.purchaseToken,4096)||(input.signal!==undefined&&!(input.signal instanceof AbortSignal)))fail();
   const purchaseToken=input.purchaseToken;
   externalSignal=input.signal;controller=new AbortController();
   const signal=controller.signal;
   onAbort=()=>controller.abort();
   externalSignal?.addEventListener('abort',onAbort,{once:true});
   if(externalSignal?.aborted)controller.abort();
   timer=setTimeout(onAbort,timeoutMs);
   const stopped=new Promise((_,reject)=>{
    const stop=()=>reject(Error('GOOGLE_ACKNOWLEDGEMENT_STOPPED'));
    signal.addEventListener('abort',stop,{once:true});if(signal.aborted)stop();
   });
   void stopped.catch(()=>{});
   const wait=action=>Promise.race([Promise.resolve().then(()=>{signal.throwIfAborted();return action();}),stopped]);
   const accessToken=await wait(()=>readAccessToken({signal}));
   if(!text(accessToken,8192)||!/^[A-Za-z0-9._~+/-]+=*$/.test(accessToken))fail();
   const url=`${ORIGIN}/androidpublisher/v3/applications/${encodeURIComponent(packageName)}/purchases/subscriptions/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(purchaseToken)}:acknowledge`;
   response=await wait(()=>{
    signal.throwIfAborted();dispatched=true;
    return Promise.resolve(fetchOnce(url,{method:'POST',redirect:'error',credentials:'omit',cache:'no-store',
     headers:{Authorization:`Bearer ${accessToken}`,Accept:'application/json','Content-Type':'application/json'},body:'{}',signal}))
     .then(value=>{if(signal.aborted){cancelBody(value);throw Error('GOOGLE_ACKNOWLEDGEMENT_STOPPED');}return value;});
   });
   if(response?.status!==200||response.redirected===true||response.url&&response.url!==url||
      typeof response.headers?.get!=='function')fail();
   const length=response.headers.get('content-length');
   if(length!==null&&length!=='0')fail();
   // The documented success body is empty. Bound even an empty/chunked stream.
   if(response.body!==null){
    const reader=response.body?.getReader?.();if(!reader)fail();
    let ended=false;
    try{
     while(true){const chunk=await wait(()=>reader.read());if(chunk.done){ended=true;break;}
      if(!(chunk.value instanceof Uint8Array)||chunk.value.byteLength!==0)fail();}
    }finally{
     if(!ended){try{void Promise.resolve(reader.cancel()).catch(()=>{});}catch{}}
     try{reader.releaseLock();}catch{}
    }
   }
   signal.throwIfAborted();complete=true;
   return Object.freeze({status:'ACKNOWLEDGED',acknowledged:true,entitled:false,requestDispatched:true,reconciliationRequired:false});
  }catch{
   return Object.freeze({status:dispatched?'UNCERTAIN':'NOT_SENT',acknowledged:false,entitled:false,
    requestDispatched:dispatched,reconciliationRequired:dispatched});
  }finally{
   clearTimeout(timer);controller?.abort();
   if(externalSignal instanceof AbortSignal&&onAbort)externalSignal.removeEventListener('abort',onAbort);
   if(!complete)cancelBody(response);
  }
 }});
}
