import {createGoogleSubscriptionRuntime} from '../../api/pocket/google-subscription-runtime.mjs';
type Runtime = ReturnType<typeof createGoogleSubscriptionRuntime>;
type Account = {id:string;email?:string;email_confirmed_at?:string;is_anonymous?:boolean};
type Binding = {origin:string;revision:string;authenticate:(request:Request)=>Promise<Account|null>;runtime:(request:Request,accountId:string)=>Runtime};
let binding:Readonly<Binding>|undefined;
/** Trusted server bootstrap only. Never populated from request/env JSON or client config.
 * Runtime factory must bind its readAccount port to this authenticated request.
 * Default remains unconfigured; OAuth/DB/obfuscation adapters require acceptance. */
export function bindPocketGoogleRuntime(value:Binding){
 if(typeof window!=='undefined'||binding)throw Error('Google runtime binding unavailable');
 const url=new URL(value.origin);
 if(url.protocol!=='https:'||url.origin!==value.origin||url.username||url.password||!/^[a-f0-9]{40}$/.test(value.revision)||typeof value.authenticate!=='function'||typeof value.runtime!=='function')throw Error('Invalid Google runtime binding');
 binding=Object.freeze({...value});
}
export async function checkGoogleRequest(request:Request,expectedAccountId?:string,restore=false,configured=binding):Promise<Response>{
 const headers={'Cache-Control':'private, no-store',Vary:'Cookie, x-pocket-google-token'};
 const deny=(status:number,code:string)=>Response.json({entitled:false,status:'HOLD',code},{status,headers});
 if(!configured)return deny(503,'GOOGLE_RUNTIME_UNCONFIGURED');
 const controller=new AbortController(),abort=()=>controller.abort();request.signal.addEventListener('abort',abort,{once:true});if(request.signal.aborted)abort();let timer:ReturnType<typeof setTimeout>|undefined;
 const stopped=new Promise<never>((_,reject)=>{const stop=()=>reject(Error('Cancelled'));controller.signal.addEventListener('abort',stop,{once:true});if(controller.signal.aborted)stop();timer=setTimeout(abort,10000);});
 void stopped.catch(()=>{});
 const wait=<T,>(action:()=>Promise<T>)=>Promise.race([Promise.resolve().then(()=>{controller.signal.throwIfAborted();return action();}),stopped]);
 try{
  const revision=process.env.VERCEL_GIT_COMMIT_SHA??process.env.GIT_COMMIT_SHA??process.env.CF_PAGES_COMMIT_SHA??'';
  if(new URL(request.url).origin!==configured.origin||revision!==configured.revision)return deny(503,'GOOGLE_BACKEND_UNVERIFIED');
  if(restore&&(request.method!=='POST'||request.headers.get('origin')!==configured.origin))return deny(403,'GOOGLE_ORIGIN_REQUIRED');
  const token=request.headers.get('x-pocket-google-token');
  if(!token||token.length>8192||/[\s\x00-\x1f\x7f]/.test(token))return deny(400,'GOOGLE_PROOF_REQUIRED');
  const scoped=new Request(request.url,{method:request.method,headers:request.headers,signal:controller.signal});
  const user=await wait(()=>configured.authenticate(scoped));
  if(!user?.id||!user.email||!user.email_confirmed_at||user.is_anonymous||expectedAccountId&&user.id!==expectedAccountId)return deny(401,'POCKET_LOGIN_REQUIRED');
  const runtime=configured.runtime(scoped,user.id);
  const result=await wait(()=>restore?runtime.synchronise({purchaseToken:token,signal:controller.signal}):runtime.admitScan({purchaseToken:token,signal:controller.signal}));
  controller.signal.throwIfAborted();
  if(result.allowed!==true||result.accountId!==user.id.toLowerCase())return deny(403,'GOOGLE_CURRENT_ACCESS_REQUIRED');
  return Response.json({entitled:true,scope:'single-request'},{headers});
 }catch{return deny(503,'GOOGLE_ACCESS_UNAVAILABLE');}
 finally{clearTimeout(timer);controller.abort();request.signal.removeEventListener('abort',abort);}
}
export async function hasPocketGoogleSubscription(request:Request,userId:string){return (await checkGoogleRequest(request,userId)).ok;}
