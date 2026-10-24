/** Server-only bounded reconciliation. verifyDelivery must cryptographically
 * authenticate issuer/audience; readRevocation must perform an authoritative
 * current server read. Neither may return client assertions. No default ports.
 * Unknown tokens remain unresolved; this is not an absent-token tombstone. */
export function createGoogleReconciler(config,ports){
 if(typeof window!=='undefined')throw Error('SERVER_ONLY');
 const cfg=structuredClone(config),p=Object.freeze({...ports}),clock=p.clock??Date.now;
 if(!cfg.packageName||cfg.environment!=='sandbox'||!cfg.issuer||!cfg.audience||!Number.isInteger(cfg.timeoutMs)||cfg.timeoutMs<1||cfg.timeoutMs>10000||['verifyDelivery','readRevocation','readTokenBinding','commitRevocation'].some(k=>typeof p[k]!=='function'))throw Error('RECONCILIATION_CONFIG');
 return Object.freeze({async reconcile(request){
  let dispatched=false,timer;const controller=new AbortController(),abort=()=>controller.abort();request.signal.addEventListener('abort',abort,{once:true});if(request.signal.aborted)abort();
  const stopped=new Promise((_,reject)=>{controller.signal.addEventListener('abort',()=>reject(Error('STOP')),{once:true});if(controller.signal.aborted)reject(Error('STOP'));timer=setTimeout(abort,cfg.timeoutMs);});void stopped.catch(()=>{});
  const wait=fn=>Promise.race([Promise.resolve().then(()=>{controller.signal.throwIfAborted();return fn();}),stopped]);
  const hold=reason=>({status:'HOLD',entitled:false,reason,reconciliationRequired:true});
  try{
   const e=structuredClone(await wait(()=>p.verifyDelivery(request,{signal:controller.signal}))),now=clock();
   if(!e||e.issuer!==cfg.issuer||e.audience!==cfg.audience||e.packageName!==cfg.packageName||e.environment!==cfg.environment||typeof e.eventId!=='string'||!/^[A-Za-z0-9:_-]{1,128}$/.test(e.eventId)||!/^[a-f0-9]{64}$/.test(e.tokenSha256)||!Number.isSafeInteger(now)||!Number.isSafeInteger(e.observedAtMs)||now-e.observedAtMs>300000||e.observedAtMs>now+30000)return hold('DELIVERY_UNVERIFIED');
   const binding=await wait(()=>p.readTokenBinding({tokenSha256:e.tokenSha256,signal:controller.signal}));
   if(binding?.status!=='BOUND'||binding.packageName!==cfg.packageName||binding.environment!==cfg.environment)return hold('UNKNOWN_TOKEN_REQUIRES_REVIEW');
   const fresh=await wait(()=>p.readRevocation(e,{signal:controller.signal})),at=clock();
   if(!fresh||fresh.tokenSha256!==e.tokenSha256||fresh.packageName!==cfg.packageName||fresh.environment!==cfg.environment||!['VOIDED','REVOKED'].includes(fresh.state)||!Number.isSafeInteger(fresh.observedAtMs)||!Number.isSafeInteger(at)||fresh.observedAtMs>at||at-fresh.observedAtMs>30000)return hold('CURRENT_REVOCATION_UNCONFIRMED');
   const receipt=await wait(()=>{controller.signal.throwIfAborted();dispatched=true;return p.commitRevocation({tokenSha256:e.tokenSha256,accountId:binding.accountId,packageName:cfg.packageName,environment:cfg.environment,signal:controller.signal});});
   if(receipt?.status!=='REVOKED')return {status:'UNCERTAIN',entitled:false,reconciliationRequired:true};
   return {status:'REVOKED',entitled:false,reconciliationRequired:false};
  }catch{return dispatched?{status:'UNCERTAIN',entitled:false,reconciliationRequired:true}:hold('RECONCILIATION_UNAVAILABLE');}
  finally{clearTimeout(timer);controller.abort();request.signal.removeEventListener('abort',abort);}
 }});
}
