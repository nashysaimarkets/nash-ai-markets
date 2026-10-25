/** Authenticated, known-token sandbox RTDN delivery for the existing reconciler.
 * No route, credential defaults, environment activation or entitlement grant.
 * The returned purchaseToken is ephemeral server-only input to the fresh reader;
 * never log, persist or send this internal delivery object to a browser.
 */
import {constants,createHash,createPublicKey,verify} from 'node:crypto';
import {googleReadScope} from './google-current-revocation.mjs';
const JWKS='https://www.googleapis.com/oauth2/v3/certs';
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const text=(x,max)=>typeof x==='string'&&x.length>0&&x.length<=max&&!/[\s\x00-\x1f\x7f]/u.test(x);
const requireFact=x=>{if(!x)throw Error('GOOGLE_DELIVERY_UNVERIFIED');};
const cancel=body=>{try{if(body&&!body.locked)void Promise.resolve(body.cancel()).catch(()=>{});}catch{}};
function decodeUrl(value,limit){
 requireFact(typeof value==='string'&&value.length>0&&value.length<=limit&&/^[A-Za-z0-9_-]+$/.test(value));
 const bytes=Buffer.from(value,'base64url');requireFact(bytes.toString('base64url')===value);return bytes;
}
const json=bytes=>JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));

export function createGoogleNotificationDeliveryVerifier(config,ports){
 requireFact(typeof window==='undefined'&&object(config)&&object(ports));
 const cfg=structuredClone(config),p=Object.freeze({...ports}),clock=p.clock??Date.now,timeoutMs=cfg.timeoutMs??10000;
 let audience;try{audience=new URL(cfg.audience);}catch{requireFact(false);}
 requireFact(cfg.environment==='sandbox'&&['https://accounts.google.com','accounts.google.com'].includes(cfg.issuer)&&audience.protocol==='https:'&&!audience.username&&!audience.password&&!audience.hash&&!audience.search&&audience.href===cfg.audience&&cfg.audience.length<=2048&&typeof cfg.packageName==='string'&&cfg.packageName.length<=255&&/^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)+$/.test(cfg.packageName)&&typeof cfg.serviceAccountEmail==='string'&&/^[a-z0-9][a-z0-9._-]{0,62}@[a-z0-9][a-z0-9-]{0,62}\.iam\.gserviceaccount\.com$/.test(cfg.serviceAccountEmail)&&typeof cfg.subscription==='string'&&/^projects\/[A-Za-z0-9:_-]{1,128}\/subscriptions\/[A-Za-z0-9._~-]{1,128}$/.test(cfg.subscription)&&Number.isSafeInteger(timeoutMs)&&timeoutMs>0&&timeoutMs<=10000&&typeof clock==='function'&&typeof p.fetch==='function'&&typeof p.readTokenBinding==='function');
 return Object.freeze({async verifyDelivery(request,{signal:externalSignal}={}){
  let scope;
  try{
   requireFact(request instanceof Request&&request.method==='POST'&&request.url===cfg.audience);
   scope=googleReadScope([request.signal,externalSignal],timeoutMs,p.fetch);
   const authorization=request.headers.get('authorization');requireFact(typeof authorization==='string'&&authorization.length<=16384&&/^Bearer [A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(authorization));
   const parts=authorization.slice(7).split('.'),header=json(decodeUrl(parts[0],2048)),claims=json(decodeUrl(parts[1],8192)),signature=decodeUrl(parts[2],2048);
   requireFact(object(header)&&header.alg==='RS256'&&(header.typ===undefined||header.typ==='JWT')&&typeof header.kid==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(header.kid)&&!['jku','x5u','jwk','x5c','crit','b64'].some(k=>Object.hasOwn(header,k)));
   const began=clock();requireFact(Number.isSafeInteger(began)&&began>=0);const seconds=began/1000;
   requireFact(object(claims)&&claims.iss===cfg.issuer&&claims.aud===cfg.audience&&claims.email===cfg.serviceAccountEmail&&claims.email_verified===true&&typeof claims.sub==='string'&&/^\d{10,30}$/.test(claims.sub)&&Number.isSafeInteger(claims.iat)&&Number.isSafeInteger(claims.exp)&&claims.iat<=seconds+30&&claims.exp>seconds&&claims.exp>claims.iat&&claims.exp-claims.iat<=3600&&seconds-claims.iat<=3630&&(claims.nbf===undefined||Number.isSafeInteger(claims.nbf)&&claims.nbf<=seconds));
   const keys=await scope.getJson(JWKS);requireFact(object(keys)&&Array.isArray(keys.keys)&&keys.keys.length>0&&keys.keys.length<=20);
   const candidates=keys.keys.filter(k=>object(k)&&k.kid===header.kid);requireFact(candidates.length===1);const jwk=candidates[0];
   requireFact(jwk.kty==='RSA'&&jwk.alg==='RS256'&&jwk.use==='sig'&&(jwk.key_ops===undefined||Array.isArray(jwk.key_ops)&&jwk.key_ops.length===1&&jwk.key_ops[0]==='verify'));
   decodeUrl(jwk.n,2048);decodeUrl(jwk.e,16);
   const key=createPublicKey({key:jwk,format:'jwk'}),bits=key.asymmetricKeyDetails?.modulusLength;
   requireFact(key.asymmetricKeyType==='rsa'&&Number.isInteger(bits)&&bits>=2048&&bits<=8192&&signature.byteLength===bits/8&&verify('RSA-SHA256',Buffer.from(`${parts[0]}.${parts[1]}`),{key,padding:constants.RSA_PKCS1_PADDING},signature));
   scope.signal.throwIfAborted();
   const envelope=await scope.readJson(request.body,request.headers);
   requireFact(object(envelope)&&envelope.subscription===cfg.subscription&&object(envelope.message)&&typeof envelope.message.messageId==='string'&&/^[A-Za-z0-9:_-]{1,128}$/.test(envelope.message.messageId));
   const data=envelope.message.data;requireFact(typeof data==='string'&&data.length<=60000&&/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(data));
   const decoded=Buffer.from(data,'base64');requireFact(decoded.toString('base64')===data);const event=json(decoded);
   requireFact(object(event)&&event.version==='1.0'&&event.packageName===cfg.packageName&&typeof event.eventTimeMillis==='string'&&/^\d+$/.test(event.eventTimeMillis));
   const observedAtMs=Number(event.eventTimeMillis),now=clock();requireFact(Number.isSafeInteger(observedAtMs)&&Number.isSafeInteger(now)&&observedAtMs<=now+30000&&now-observedAtMs<=300000);
   const kinds=['subscriptionNotification','voidedPurchaseNotification','oneTimeProductNotification','testNotification','pendingRefundReviewNotification'].filter(k=>Object.hasOwn(event,k));requireFact(kinds.length===1);
   let purchaseToken,orderId;
   if(kinds[0]==='subscriptionNotification'){
    const subscription=event.subscriptionNotification;requireFact(object(subscription)&&subscription.version==='1.0'&&subscription.notificationType===13);purchaseToken=subscription.purchaseToken;
   }else{
    requireFact(kinds[0]==='voidedPurchaseNotification');const voided=event.voidedPurchaseNotification;
    requireFact(object(voided)&&voided.productType===1&&voided.refundType===1&&text(voided.orderId,256));purchaseToken=voided.purchaseToken;orderId=voided.orderId;
   }
   requireFact(text(purchaseToken,4096));const tokenSha256=createHash('sha256').update(purchaseToken).digest('hex');
   const binding=await scope.wait(()=>p.readTokenBinding({tokenSha256,signal:scope.signal}));
   // RTDN has no sandbox flag. Derive scope only from authoritative existing ownership.
   requireFact(object(binding)&&binding.status==='BOUND'&&binding.packageName===cfg.packageName&&binding.environment==='sandbox'&&typeof binding.accountId==='string'&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(binding.accountId)&&typeof binding.revoked==='boolean'&&binding.replacedByTokenSha256===null);
   scope.signal.throwIfAborted();const finished=clock();requireFact(Number.isSafeInteger(finished)&&finished>=began&&claims.exp>finished/1000&&finished-observedAtMs<=300000);
   return Object.freeze({issuer:cfg.issuer,audience:cfg.audience,eventId:envelope.message.messageId,packageName:cfg.packageName,environment:binding.environment,tokenSha256,observedAtMs,purchaseToken,...(orderId?{orderId}:{})});
  }catch{throw Error('GOOGLE_DELIVERY_UNVERIFIED');}
  finally{scope?.close();cancel(request?.body);}
 }});
}
