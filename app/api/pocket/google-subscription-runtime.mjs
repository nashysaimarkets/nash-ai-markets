/** Prepared server-only composition of the existing verifier and ownership recorder.
 * No mounted route, default fetch, credential, polling, retry or activation.
 * Invoke admitScan for each protected request; never cache its decision as a subscription.
 */
import {createGoogleSubscriptionVerifier} from './google-subscription-verifier.mjs';
import {createGoogleOwnershipRecorder} from './google-subscription-ownership.mjs';
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
export function createGoogleSubscriptionRuntime(config,ports){
 if(typeof window!=='undefined'||!object(config)||!object(ports))throw Error('GOOGLE_RUNTIME_CONFIG');
 const cfg=structuredClone(config),bound={...ports};
 const timeoutMs=cfg.timeoutMs??10000,clock=bound.clock??Date.now;
 if(!Number.isSafeInteger(timeoutMs)||timeoutMs<1||timeoutMs>10000||typeof clock!=='function'||
    (cfg.acknowledgementEnabled!==undefined&&typeof cfg.acknowledgementEnabled!=='boolean'))throw Error('GOOGLE_RUNTIME_CONFIG');
 const verifier=createGoogleSubscriptionVerifier(cfg,bound);
 const hold=(reason,extra={})=>Object.freeze({allowed:false,entitled:false,status:'HOLD',reason,...extra});
 async function wait(action,signal){let timer,abort;try{return await new Promise((resolve,reject)=>{
   abort=()=>reject(Error('GOOGLE_RUNTIME_CANCELLED_OR_TIMEOUT'));if(signal?.aborted)return abort();
   signal?.addEventListener('abort',abort,{once:true});timer=setTimeout(abort,timeoutMs);
   Promise.resolve().then(()=>{signal?.throwIfAborted();return action();}).then(resolve,reject);
 });}finally{clearTimeout(timer);if(abort)signal?.removeEventListener('abort',abort);}}
 function validInput(input){if(!object(input)||(input.signal!==undefined&&!(input.signal instanceof AbortSignal)))throw Error('GOOGLE_RUNTIME_INPUT');return {purchaseToken:input.purchaseToken,signal:input.signal};}
 function validCandidate(v){return object(v)&&v.status==='VERIFIED_FOR_PERSISTENCE'&&v.entitled===false&&v.entitlementCandidate===true&&v.environment===cfg.environment&&v.productId===cfg.productId;}
 async function current(v,signal){
   const account=await wait(()=>bound.readAccount({signal}),signal);signal?.throwIfAborted();
   if(account?.accountId?.toLowerCase()!==v.accountId)throw Error('GOOGLE_RUNTIME_OWNER');
   // Last authoritative read is revocation/ownership; no later await may reuse it.
   const binding=await wait(()=>bound.readTokenBinding({tokenSha256:v.tokenSha256,signal}),signal);
   if(!object(binding)||binding.status!=='BOUND'||binding.accountId?.toLowerCase()!==v.accountId||binding.revoked!==false||
     binding.replacedByTokenSha256!==null||binding.packageName!==cfg.packageName||binding.environment!==cfg.environment)throw Error('GOOGLE_RUNTIME_OWNERSHIP');
   signal?.throwIfAborted();const now=clock();
   if(!Number.isSafeInteger(now)||now<v.observedAtMs||now-v.observedAtMs>30000||v.expiresAtMs<=now)throw Error('GOOGLE_RUNTIME_STALE');
 }
 async function admitScan(input={}){try{
   const safe=validInput(input);const v=await wait(()=>verifier.verify(safe),safe.signal);
   if(!validCandidate(v)||v.acknowledgementRequired!==false||v.ownershipState!=='BOUND')return hold('FRESH_ACKNOWLEDGED_OWNERSHIP_REQUIRED');
   await current(v,safe.signal);safe.signal?.throwIfAborted();
   return Object.freeze({allowed:true,entitled:false,status:'REQUEST_ADMITTED',accountId:v.accountId,tokenSha256:v.tokenSha256,expiresAtMs:v.expiresAtMs,scope:'single-request'});
 }catch{return hold('CURRENT_ACCESS_UNAVAILABLE');}}
 return Object.freeze({admitScan,async synchronise(input={}){
   let attempted=false,recorded=false;
   try{
     const safe=validInput(input);let candidate;
     const recorder=createGoogleOwnershipRecorder(cfg,{...bound,verify:async arg=>{const v=await verifier.verify(arg);candidate=v;return v;}});
     const receipt=await recorder.record(safe);recorded=receipt.ownershipRecorded===true;
     if(receipt.status!=='OWNERSHIP_RECORDED'||!validCandidate(candidate))return hold(receipt.reason??receipt.status,{ownershipRecorded:recorded,reconciliationRequired:receipt.reconciliationRequired===true||receipt.status==='RECORDED_AFTER_CANCELLATION'});
     await current(candidate,safe.signal);
     if(candidate.acknowledgementRequired){
       if(cfg.acknowledgementEnabled!==true||typeof bound.acknowledge!=='function')return hold('ACKNOWLEDGEMENT_REQUIRED',{ownershipRecorded:true});
       // Trusted server adapter only. Never retry an ambiguous billing-side effect.
       safe.signal?.throwIfAborted();
       const ack=await wait(()=>{safe.signal?.throwIfAborted();attempted=true;return bound.acknowledge({purchaseToken:safe.purchaseToken,packageName:cfg.packageName,productId:cfg.productId,signal:safe.signal});},safe.signal);
       if(!object(ack)||ack.acknowledged!==true)throw Error('ACK_UNKNOWN');
     }
     // Acknowledge response alone cannot grant access. Read Google and ownership again.
     const decision=await admitScan(safe);return Object.freeze({...decision,ownershipRecorded:true,acknowledgementAttempted:attempted});
   }catch{return hold(attempted?'ACKNOWLEDGEMENT_UNKNOWN':'RECONCILIATION_REQUIRED',{ownershipRecorded:recorded,acknowledgementAttempted:attempted,reconciliationRequired:true});}
 }});
}
