import {createGoogleNotificationDeliveryVerifier} from '../../api/pocket/google-notification-delivery.mjs';
import {createGoogleCurrentRevocationReader,googleReadScope} from '../../api/pocket/google-current-revocation.mjs';
import {createGoogleReconciler} from '../../api/pocket/google-reconciliation.mjs';
import {createGooglePostgresPorts} from '../../api/pocket/google-subscription-postgres.mjs';

type Identity={authProject:string;storage:string};
type Config={origin:string;revision:string;identity:Identity;google:{packageName:string;productId:string;basePlanIds:string[];environment:'sandbox';timeoutMs?:number};delivery:{issuer:string;audience:string;serviceAccountEmail:string;subscription:string}};
type Ports={inspectIdentity:(signal:AbortSignal)=>Promise<Identity>;readObfuscatedAccountId:(accountId:string,signal:AbortSignal)=>Promise<string>;pool:{query:(sql:string,values:string[])=>Promise<unknown>};readAccessToken:(input:{signal:AbortSignal})=>Promise<string>;fetch:typeof fetch;clock?:()=>number};
type Result={status:string;entitled:false;reconciliationRequired:boolean};
type Binding=Readonly<{origin:string;revision:string;reconcile:(request:Request)=>Promise<Result>}>;
const prepared=new WeakSet<Binding>();
let binding:Binding|undefined;

/** Explicit trusted server composition. It neither obtains credentials nor
 * installs SQL or activates the route. Obfuscated IDs require the existing
 * authoritative mapping; no derivation or invented storage column is supplied.
 */
export function createPocketGoogleNotificationBinding(config:Config,ports:Ports):Binding{
 if(typeof window!=='undefined')throw Error('Server runtime required');
 const cfg=structuredClone(config),p=Object.freeze({...ports}),url=new URL(cfg.origin),timeoutMs=cfg.google.timeoutMs??10000;
 if(url.protocol!=='https:'||url.origin!==cfg.origin||url.username||url.password||url.hostname==='pocket.nashaimarkets.com'||url.hostname.includes('-git-')||!/^[a-f0-9]{40}$/.test(cfg.revision)||cfg.google.environment!=='sandbox'||cfg.delivery.audience!==`${cfg.origin}/api/pocket/google-notifications`||!Number.isSafeInteger(timeoutMs)||timeoutMs<1||timeoutMs>10000||!['authProject','storage'].every(k=>typeof cfg.identity[k as keyof Identity]==='string'&&/^[A-Za-z0-9:_-]{1,160}$/.test(cfg.identity[k as keyof Identity]))||['inspectIdentity','readObfuscatedAccountId','readAccessToken','fetch'].some(k=>typeof p[k as keyof Ports]!=='function'))throw Error('Unreviewed notification configuration');
 const db=createGooglePostgresPorts(p.pool),settings={...cfg.google,...cfg.delivery,timeoutMs};
 const common={...db,fetch:p.fetch,clock:p.clock};
 const delivery=createGoogleNotificationDeliveryVerifier(settings,common);
 const current=createGoogleCurrentRevocationReader(settings,{...common,readObfuscatedAccountId:p.readObfuscatedAccountId,readAccessToken:p.readAccessToken});
 const reconciler=createGoogleReconciler(settings,{...common,...delivery,...current});
 const value:Binding=Object.freeze({origin:cfg.origin,revision:cfg.revision,async reconcile(request:Request){
  const scope=googleReadScope([request.signal],timeoutMs,p.fetch);let started=false;
  try{
   const identity=await scope.wait(()=>p.inspectIdentity(scope.signal));scope.signal.throwIfAborted();
   if(identity?.authProject!==cfg.identity.authProject||identity?.storage!==cfg.identity.storage)throw Error('Notification identity mismatch');
   const scoped=new Request(request,{signal:scope.signal});
   started=true;
   return await scope.wait(()=>reconciler.reconcile(scoped)) as Result;
  }catch{
   // Once reconciliation starts, a timeout cannot prove that its write rolled back.
   return {status:started?'UNCERTAIN':'HOLD',entitled:false,reconciliationRequired:true};
  }finally{scope.close();}
 }});
 prepared.add(value);return value;
}

/** Called once by a reviewed server bootstrap only. No request/env JSON binding. */
export function bindPocketGoogleNotifications(value:Binding){
 if(typeof window!=='undefined'||binding||!prepared.has(value))throw Error('Google notification binding unavailable');
 binding=value;
}

export async function handleGoogleNotificationRequest(request:Request,configured:Binding|undefined=binding):Promise<Response>{
 const headers={'Cache-Control':'private, no-store',Vary:'Authorization'};
 const hold=(code:string,status='HOLD')=>Response.json({received:false,entitled:false,status,code},{status:503,headers});
 if(!configured||!prepared.has(configured))return hold('GOOGLE_NOTIFICATIONS_UNCONFIGURED');
 const revision=process.env.VERCEL_GIT_COMMIT_SHA??process.env.GIT_COMMIT_SHA??process.env.CF_PAGES_COMMIT_SHA??'';
 if(process.env.VERCEL_ENV==='production'||revision!==configured.revision||request.method!=='POST'||request.url!==`${configured.origin}/api/pocket/google-notifications`)return hold('GOOGLE_NOTIFICATION_BACKEND_UNVERIFIED');
 try{
  const result=await configured.reconcile(request);
  if(result.status!=='REVOKED'||result.entitled!==false||result.reconciliationRequired!==false)return hold('GOOGLE_RECONCILIATION_UNAVAILABLE',result.status==='UNCERTAIN'?'UNCERTAIN':'HOLD');
  return Response.json({received:true,status:'REVOKED',entitled:false},{headers});
 }catch{return hold('GOOGLE_RECONCILIATION_UNAVAILABLE');}
}
