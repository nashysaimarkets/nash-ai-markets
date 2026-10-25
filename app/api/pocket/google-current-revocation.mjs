/** Read-only sandbox revocation proof for the existing known-token reconciler.
 * No imports create clients or read credentials. A notification or EXPIRED state
 * alone is insufficient: match a full void of the current order, then reread it.
 */
import {createHash} from 'node:crypto';
const ORIGIN='https://androidpublisher.googleapis.com';
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const text=(x,max)=>typeof x==='string'&&x.length>0&&x.length<=max&&!/[\s\x00-\x1f\x7f]/u.test(x);
const uuid=x=>typeof x==='string'&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(x);
const requireFact=x=>{if(!x)throw Error('GOOGLE_CURRENT_REVOCATION_UNCONFIRMED');};
const cancel=response=>{try{if(response?.body&&!response.body.locked)void Promise.resolve(response.body.cancel()).catch(()=>{});}catch{}};

/** Shared bounded read mechanics used only by the two concrete Google adapters.
 * Call sites supply fixed Google URLs; request content never selects an origin.
 */
export function googleReadScope(signals,timeoutMs,fetchOnce){
 requireFact(Array.isArray(signals)&&signals.every(signal=>signal===undefined||signal instanceof AbortSignal));
 const controller=new AbortController(),abort=()=>controller.abort();
 for(const signal of signals){signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();}
 const timer=setTimeout(abort,timeoutMs),signal=controller.signal;
 const stopped=new Promise((_,reject)=>{const stop=()=>reject(Error('GOOGLE_READ_STOPPED'));signal.addEventListener('abort',stop,{once:true});if(signal.aborted)stop();});void stopped.catch(()=>{});
 const wait=action=>Promise.race([Promise.resolve().then(()=>{signal.throwIfAborted();return action();}),stopped]);
 async function readJson(body,headers,limit=65536){
  requireFact(/^application\/json(?:\s*;|$)/i.test(headers?.get?.('content-type')??''));
  const length=headers.get('content-length');requireFact(length===null||/^\d+$/.test(length)&&Number(length)<=limit);
  const reader=body?.getReader?.();requireFact(reader);let complete=false,size=0;const chunks=[];
  try{while(true){const chunk=await wait(()=>reader.read());if(chunk.done){complete=true;break;}requireFact(chunk.value instanceof Uint8Array);size+=chunk.value.byteLength;requireFact(size<=limit);chunks.push(Buffer.from(chunk.value));}
   return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks)));
  }finally{if(!complete){try{void Promise.resolve(reader.cancel()).catch(()=>{});}catch{}}try{reader.releaseLock();}catch{}}
 }
 return Object.freeze({signal,wait,readJson,async getJson(url,headers={}){
  let response;
  try{response=await wait(()=>Promise.resolve(fetchOnce(url,{method:'GET',redirect:'error',credentials:'omit',cache:'no-store',headers:{Accept:'application/json',...headers},signal})).then(value=>{if(signal.aborted){cancel(value);throw Error('GOOGLE_READ_STOPPED');}return value;}));
   requireFact(response?.status===200&&response.redirected!==true&&(!response.url||response.url===url));
   return await readJson(response.body,response.headers);
  }finally{cancel(response);}
 },close(){clearTimeout(timer);abort();for(const external of signals)external?.removeEventListener('abort',abort);}});
}

function validExpiry(value){
 if(typeof value!=='string')return NaN;
 const match=/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,9})?(Z|[+-]\d{2}:\d{2})$/.exec(value);if(!match)return NaN;
 const [year,month,day,hour,minute,second]=match.slice(1,7).map(Number);
 if(year<1970||month<1||month>12||day<1||day>new Date(Date.UTC(year,month,0)).getUTCDate()||hour>23||minute>59||second>59||(match[7]!=='Z'&&(Number(match[7].slice(1,3))>23||Number(match[7].slice(4))>59)))return NaN;
 return Date.parse(value);
}

export function createGoogleCurrentRevocationReader(config,ports){
 requireFact(typeof window==='undefined'&&object(config)&&object(ports));
 const cfg=structuredClone(config),p=Object.freeze({...ports}),clock=p.clock??Date.now,timeoutMs=cfg.timeoutMs??10000;
 requireFact(cfg.environment==='sandbox'&&typeof cfg.packageName==='string'&&cfg.packageName.length<=255&&/^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)+$/.test(cfg.packageName)&&text(cfg.productId,150)&&Array.isArray(cfg.basePlanIds)&&cfg.basePlanIds.length>0&&cfg.basePlanIds.every(x=>text(x,100))&&new Set(cfg.basePlanIds).size===cfg.basePlanIds.length&&Number.isSafeInteger(timeoutMs)&&timeoutMs>0&&timeoutMs<=10000&&typeof clock==='function'&&['fetch','readAccessToken','readTokenBinding','readObfuscatedAccountId'].every(k=>typeof p[k]==='function'));
 const scopeBinding=(binding,accountId)=>object(binding)&&binding.status==='BOUND'&&uuid(binding.accountId)&&(!accountId||binding.accountId.toLowerCase()===accountId)&&binding.packageName===cfg.packageName&&binding.environment==='sandbox'&&typeof binding.revoked==='boolean'&&binding.replacedByTokenSha256===null;
 return Object.freeze({async readRevocation(event,{signal:externalSignal}={}){
  let scope;
  try{
   requireFact(object(event)&&event.packageName===cfg.packageName&&event.environment==='sandbox'&&text(event.purchaseToken,4096)&&/^[a-f0-9]{64}$/.test(event.tokenSha256??''));
   const {purchaseToken,tokenSha256,orderId:eventOrderId,observedAtMs:eventAt}=event;
   requireFact(createHash('sha256').update(purchaseToken).digest('hex')===tokenSha256&&(eventOrderId===undefined||text(eventOrderId,256)));
   scope=googleReadScope([externalSignal],timeoutMs,p.fetch);
   const began=clock();requireFact(Number.isSafeInteger(began)&&Number.isSafeInteger(eventAt)&&eventAt<=began+30000&&began-eventAt<=300000);
   const binding=await scope.wait(()=>p.readTokenBinding({tokenSha256,signal:scope.signal}));requireFact(scopeBinding(binding));const accountId=binding.accountId.toLowerCase();
   const obfuscated=await scope.wait(()=>p.readObfuscatedAccountId(accountId,scope.signal));requireFact(text(obfuscated,64));
   const accessToken=await scope.wait(()=>p.readAccessToken({signal:scope.signal}));requireFact(text(accessToken,8192)&&/^[A-Za-z0-9._~+/-]+=*$/.test(accessToken));
   const headers={Authorization:`Bearer ${accessToken}`},prefix=`${ORIGIN}/androidpublisher/v3/applications/${encodeURIComponent(cfg.packageName)}/purchases/`;
   const url=`${prefix}subscriptionsv2/tokens/${encodeURIComponent(purchaseToken)}`;
   function current(purchase){
    requireFact(object(purchase)&&purchase.kind==='androidpublisher#subscriptionPurchaseV2'&&object(purchase.testPurchase)&&purchase.subscriptionState==='SUBSCRIPTION_STATE_EXPIRED'&&purchase.externalAccountIdentifiers?.obfuscatedExternalAccountId===obfuscated&&Array.isArray(purchase.lineItems)&&purchase.lineItems.length===1);
    const item=purchase.lineItems[0],now=clock();
    requireFact(object(item)&&item.productId===cfg.productId&&cfg.basePlanIds.includes(item.offerDetails?.basePlanId)&&text(item.latestSuccessfulOrderId,256)&&Number.isSafeInteger(now)&&Number.isFinite(validExpiry(item.expiryTime))&&validExpiry(item.expiryTime)<=now);
    return item.latestSuccessfulOrderId;
   }
   const orderId=current(await scope.getJson(url,headers));requireFact(eventOrderId===undefined||eventOrderId===orderId);
   // Provider defaults select its own current 30-day window without local clock skew.
   const query=new URLSearchParams({type:'1',includeQuantityBasedPartialRefund:'false','pageSelection.maxResults':'1000'});
   const listed=await scope.getJson(`${prefix}voidedpurchases?${query}`,headers);
   requireFact(object(listed)&&!listed.tokenPagination?.nextPageToken&&Array.isArray(listed.voidedPurchases)&&listed.voidedPurchases.length<=1000);
   const matches=listed.voidedPurchases.filter(v=>object(v)&&v.purchaseToken===purchaseToken&&v.orderId===orderId);
   requireFact(matches.length===1);const record=matches[0];
   requireFact(!Object.hasOwn(record,'voidedQuantity')&&typeof record.voidedTimeMillis==='string'&&/^\d+$/.test(record.voidedTimeMillis)&&typeof record.purchaseTimeMillis==='string'&&/^\d+$/.test(record.purchaseTimeMillis));
   const voidedAt=Number(record.voidedTimeMillis),purchasedAt=Number(record.purchaseTimeMillis),at=clock();
   requireFact(Number.isSafeInteger(voidedAt)&&Number.isSafeInteger(purchasedAt)&&Number.isSafeInteger(at)&&purchasedAt<=voidedAt&&voidedAt<=at&&purchasedAt>=0);
   // Historical refund of an older renewal cannot permanently revoke a new one.
   requireFact(current(await scope.getJson(url,headers))===orderId);
   requireFact(await scope.wait(()=>p.readObfuscatedAccountId(accountId,scope.signal))===obfuscated);
   requireFact(scopeBinding(await scope.wait(()=>p.readTokenBinding({tokenSha256,signal:scope.signal})),accountId));
   scope.signal.throwIfAborted();const observedAtMs=clock();requireFact(Number.isSafeInteger(observedAtMs)&&observedAtMs>=began);
   return Object.freeze({tokenSha256,packageName:cfg.packageName,environment:'sandbox',state:'VOIDED',observedAtMs,entitled:false});
  }catch{throw Error('GOOGLE_CURRENT_REVOCATION_UNCONFIRMED');}
  finally{scope?.close();}
 }});
}
