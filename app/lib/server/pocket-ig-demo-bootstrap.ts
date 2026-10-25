import {createIgDemoSharedHttp} from './ig-demo-shared.ts';
import type {createIgDemoCipher} from './ig-demo-shared.ts';
import {createIgDemoPostgresStore} from './ig-demo-postgres.ts';
import type {IgDemoPgPool} from './ig-demo-postgres.ts';
import {awaitIgDemoAbortable} from './ntp-ig-demo-read-only.ts';

type Account = Readonly<{id:string;email?:string;email_confirmed_at?:string;is_anonymous?:boolean}>;
type Identity = Readonly<{authProject:string;storage:string;keyId:string}>;
export type PocketIgDemoConfig = Readonly<{
  origin:string; revision:string; environment:'DEMO'; application:string;
  identity:Identity; limits:Readonly<{application:number;account:number}>;
  enabled:boolean; commercialApproval:boolean; displayRights:boolean;
}>;
export type PocketIgDemoPorts = Readonly<{
  authenticate:(request:Request)=>Promise<Account|null>;
  /** Actual host/source/backend/key/least-privilege identity, inspected by trusted server code. */
  inspectIdentity:(signal:AbortSignal)=>Promise<Identity & {origin:string;revision:string;application:string;runtimeRole:'ig_demo_runtime'}>;
  /** Current server-owned subscription and recorded consent; never request-body assertions. */
  readAccess:(input:{ownerId:string;request:Request;signal:AbortSignal})=>Promise<{ownerId:string;premium:boolean;optedIn:boolean}|null>;
  pool:IgDemoPgPool;
  /** Existing managed-key cipher, constructed server-side. This factory does not create/read keys. */
  cipher:ReturnType<typeof createIgDemoCipher>;
  transport:typeof fetch;
}>;
export type PocketIgDemoAvailability = Readonly<{igDemoAvailable:boolean;igDemoDisconnectAvailable?:boolean;igDemoOwnerScope?:string}>;
export type PocketIgDemoBinding = Readonly<{
  origin:string;revision:string;
  handle:(request:Request)=>Promise<Response>;
  availability:(requestHeaders:Headers)=>Promise<PocketIgDemoAvailability>;
}>;
const bindings = new WeakSet<object>();
const unavailable: PocketIgDemoAvailability = Object.freeze({igDemoAvailable:false});
const uuid=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
const identityName=/^[A-Za-z0-9:_-]{1,160}$/;
const headers={'Cache-Control':'private, no-store','Vary':'Cookie','X-Content-Type-Options':'nosniff'};
const deny=()=>Response.json({error:'IG_DEMO_BACKEND_UNVERIFIED'},{status:503,headers});
export function isPocketIgDemoBinding(value:unknown):value is PocketIgDemoBinding {
  return !!value && typeof value==='object' && bindings.has(value);
}

/** Composes accepted DEMO modules only. No default credentials, network, SQL, installation or activation. */
export function createPocketIgDemoBinding(config:PocketIgDemoConfig,ports:PocketIgDemoPorts):PocketIgDemoBinding {
  if(typeof window!=='undefined')throw Error('IG_DEMO_SERVER_ONLY');
  const snapshot=structuredClone(config),url=new URL(snapshot.origin);
  if(url.protocol!=='https:'||url.origin!==snapshot.origin||url.username||url.password||
    !/^[a-f0-9]{40}$/.test(snapshot.revision)||snapshot.environment!=='DEMO'||
    !/^[-A-Za-z0-9_]{1,64}$/.test(snapshot.application)||
    !['authProject','storage','keyId'].every(k=>typeof snapshot.identity?.[k as keyof Identity]==='string'&&identityName.test(snapshot.identity[k as keyof Identity]))||
    !['enabled','commercialApproval','displayRights'].every(k=>typeof snapshot[k as keyof PocketIgDemoConfig]==='boolean')) {
    throw Error('IG_DEMO_UNREVIEWED_CONFIGURATION');
  }
  for(const key of ['authenticate','inspectIdentity','readAccess','transport'] as const) {
    if(typeof ports?.[key]!=='function')throw Error('IG_DEMO_TRUSTED_ADAPTER_REQUIRED');
  }
  if(typeof ports.pool?.connect!=='function'||typeof ports.cipher?.seal!=='function'||typeof ports.cipher?.open!=='function') {
    throw Error('IG_DEMO_TRUSTED_ADAPTER_REQUIRED');
  }
  const cfg=Object.freeze({...snapshot,identity:Object.freeze({...snapshot.identity}),limits:Object.freeze({...snapshot.limits})});
  const p=Object.freeze({...ports});
  const cipher=Object.freeze({seal:p.cipher.seal.bind(p.cipher),open:p.cipher.open.bind(p.cipher)});
  const db=createIgDemoPostgresStore(Object.freeze({connect:p.pool.connect.bind(p.pool)}),cfg.application,cfg.limits);
  const enabled=cfg.enabled&&cfg.commercialApproval&&cfg.displayRights;
  const hostMatches=(host:string|null)=>{
    if(!host||/[\s/@?#\\]/.test(host))return false;
    try{return new URL(`https://${host}`).origin===cfg.origin;}catch{return false;}
  };
  const requestMatches=(request:Request)=>new URL(request.url).origin===cfg.origin&&
    (!request.headers.has('host')||hostMatches(request.headers.get('host')));
  async function authorise(request:Request) {
    request.signal.throwIfAborted();
    if(!requestMatches(request))throw Error('IG_DEMO_BACKEND_UNVERIFIED');
    const identity=await awaitIgDemoAbortable(p.inspectIdentity(request.signal),request.signal);
    if(identity?.origin!==cfg.origin||identity.revision!==cfg.revision||identity.application!==cfg.application||
      identity.runtimeRole!=='ig_demo_runtime'||identity.authProject!==cfg.identity.authProject||
      identity.storage!==cfg.identity.storage||identity.keyId!==cfg.identity.keyId)throw Error('IG_DEMO_BACKEND_UNVERIFIED');
    const account=await awaitIgDemoAbortable(p.authenticate(request),request.signal);
    if(!account||typeof account.id!=='string'||!uuid.test(account.id)||!account.email||!account.email_confirmed_at||account.is_anonymous)return null;
    const ownerId=account.id.toLowerCase();
    // Unavailable/withdrawn paid consent may deny reads, but authenticated token deletion must remain possible.
    const accessSignal=AbortSignal.any([request.signal,AbortSignal.timeout(2000)]);
    let permission:Awaited<ReturnType<PocketIgDemoPorts['readAccess']>>=null;
    try {
      const scoped=new Request(request.url,{method:request.method,headers:request.headers,signal:accessSignal});
      permission=await awaitIgDemoAbortable(p.readAccess({ownerId,request:scoped,signal:accessSignal}),accessSignal);
    } catch {request.signal.throwIfAborted();}
    request.signal.throwIfAborted();
    return {ownerId,permitted:typeof permission?.ownerId==='string'&&uuid.test(permission.ownerId)&&
      permission.ownerId.toLowerCase()===ownerId&&permission.premium===true&&permission.optedIn===true};
  }
  const shared=createIgDemoSharedHttp(Object.freeze({
    origin:cfg.origin,enabled:cfg.enabled,commercialApproval:cfg.commercialApproval,displayRights:cfg.displayRights,
    sourceRevision:cfg.revision,store:db.store,cipher,vaultRead:db.vaultRead,provenance:db.provenance,
    authorise,transport:p.transport,
  }));
  const binding:PocketIgDemoBinding=Object.freeze({origin:cfg.origin,revision:cfg.revision,
    async handle(request:Request) {
      if(!requestMatches(request))return deny();
      const signal=AbortSignal.any([request.signal,AbortSignal.timeout(10_000)]);
      try{return await shared(new Request(request,{signal}));}catch{return deny();}
    },
    async availability(requestHeaders:Headers) {
      if(!hostMatches(requestHeaders.get('host')))return unavailable;
      // The trusted origin supplies the URL. An arbitrary forwarded host cannot enable the panel.
      const request=new Request(`${cfg.origin}/pocket`,{headers:requestHeaders,signal:AbortSignal.timeout(10_000)});
      try {
        const access=await authorise(request);
        // Do not assert that a broker session exists. Authenticated owners may always revoke their saved access.
        return access?Object.freeze({igDemoAvailable:enabled&&access.permitted===true,igDemoDisconnectAvailable:true,igDemoOwnerScope:access.ownerId}):unavailable;
      }catch{return unavailable;}
    },
  });
  bindings.add(binding);
  return binding;
}
