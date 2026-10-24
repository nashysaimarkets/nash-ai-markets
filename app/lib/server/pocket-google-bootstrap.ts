import {createGoogleSubscriptionRuntime} from '../../api/pocket/google-subscription-runtime.mjs';
import {createGooglePostgresPorts} from '../../api/pocket/google-subscription-postgres.mjs';
type Account={id:string;email?:string;email_confirmed_at?:string;is_anonymous?:boolean};
type Identity={authProject:string;storage:string};
type Config={origin:string;revision:string;identity:Identity;google:{packageName:string;productId:string;basePlanIds:string[];environment:'sandbox';timeoutMs?:number}};
type Ports={authenticate:(request:Request)=>Promise<Account|null>;inspectIdentity:(signal:AbortSignal)=>Promise<Identity>;readObfuscatedAccountId:(accountId:string,signal:AbortSignal)=>Promise<string>;pool:{query:(sql:string,values:string[])=>Promise<unknown>};readAccessToken:(input:{signal:AbortSignal})=>Promise<string>;fetch:typeof fetch};
/** Offline composition only; explicit trusted server ports, no env credentials,
 * connection creation, network on import, installation or activation. */
export function createPocketGoogleBinding(config:Config,ports:Ports){
 if(typeof window!=='undefined')throw Error('Server runtime required');
 const cfg=structuredClone(config),p=Object.freeze({...ports}),url=new URL(cfg.origin);
 if(url.origin!==cfg.origin||url.protocol!=='https:'||url.username||url.password||url.hostname==='pocket.nashaimarkets.com'||url.hostname.includes('-git-')||!/^[a-f0-9]{40}$/.test(cfg.revision)||cfg.google.environment!=='sandbox'||!['authProject','storage'].every(k=>typeof cfg.identity[k as keyof Identity]==='string'&&/^[A-Za-z0-9:_-]{1,160}$/.test(cfg.identity[k as keyof Identity])))throw Error('Unreviewed runtime configuration');
 for(const name of ['authenticate','inspectIdentity','readObfuscatedAccountId','readAccessToken','fetch'] as const)if(typeof p[name]!=='function')throw Error('Missing trusted runtime adapter');
 const db=createGooglePostgresPorts(p.pool);
 async function authenticate(request:Request){
  request.signal.throwIfAborted();const identity=await p.inspectIdentity(request.signal);request.signal.throwIfAborted();
  if(identity?.authProject!==cfg.identity.authProject||identity?.storage!==cfg.identity.storage)throw Error('Backend identity mismatch');
  const account=await p.authenticate(request);request.signal.throwIfAborted();
  if(!account||!account.email||!account.email_confirmed_at||account.is_anonymous||!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(account.id))return null;
  return {...account,id:account.id.toLowerCase()};
 }
 return Object.freeze({origin:cfg.origin,revision:cfg.revision,authenticate,runtime(request:Request,accountId:string){
  return createGoogleSubscriptionRuntime(cfg.google,{...db,fetch:p.fetch,readAccessToken:p.readAccessToken,async readAccount({signal}:{signal:AbortSignal}){
   const scoped=new Request(request.url,{method:request.method,headers:request.headers,signal});
   const account=await authenticate(scoped);if(!account||account.id!==accountId.toLowerCase())throw Error('Account changed');
   const obfuscatedAccountId=await p.readObfuscatedAccountId(account.id,signal);signal.throwIfAborted();
   if(typeof obfuscatedAccountId!=='string'||!obfuscatedAccountId||obfuscatedAccountId.length>64||/[\s\x00-\x1f\x7f]/.test(obfuscatedAccountId))throw Error('Account binding unavailable');
   return {accountId:account.id,obfuscatedAccountId};
  }});
 }});
}
