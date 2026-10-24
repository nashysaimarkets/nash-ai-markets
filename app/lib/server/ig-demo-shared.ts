/** OFFLINE prepared binding: no default client, key, database, credential or activation. */
import {createCipheriv, createDecipheriv, randomBytes} from 'node:crypto';
import {createIgDemoConnection} from './ntp-ig-demo-connection.ts';
import type {IgDemoStoredSession} from './ntp-ig-demo-connection.ts';
import {awaitIgDemoAbortable} from './ntp-ig-demo-read-only.ts';
import {createIgDemoHttp} from './ig-demo-http.ts';
import type {IgDemoChartIdentity} from '../ig-demo-panel.ts';

export type IgDemoSharedState = {epoch: string; sealed: string|null};
export type IgDemoSharedStore = {
  read(owner: string): Promise<IgDemoSharedState|null>;
  /** Atomic increment + deletion. Epochs never reset, even after expiry. */
  revoke(owner: string, expectedEpoch?: string): Promise<IgDemoSharedState|null>;
  save(owner: string, epoch: string, sealed: string): Promise<boolean>;
  reserve(account: string): Promise<boolean>;
};
type Credential = {environment:'DEMO';ownerId:string;apiKey:string;identifier:string;password:string;selectedAccountId:string};
type Access = {ownerId:string;permitted:boolean};
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
function deny(): never {throw new Error('IG_DEMO_SHARED_UNAVAILABLE');}
/** Authenticated encryption binds owner, environment and purpose; supplied key is server-only. */
export function createIgDemoCipher(existingKey: Uint8Array) {
  if(typeof window!=='undefined'||existingKey.byteLength!==32) return deny();
  const key=Buffer.from(existingKey);
  const aad=(owner:string,purpose:'credential'|'session')=>{
    if(!uuid.test(owner)) return deny();
    return Buffer.from(`pocket:ig:DEMO:v1:${owner}:${purpose}`);
  };
  return Object.freeze({
    seal(owner:string,purpose:'credential'|'session',value:unknown):string {
      const nonce=randomBytes(12); const c=createCipheriv('aes-256-gcm',key,nonce);c.setAAD(aad(owner,purpose));
      const plain=Buffer.from(JSON.stringify(value));if(plain.length>16384)return deny();
      const bytes=Buffer.concat([c.update(plain),c.final()]);
      return Buffer.concat([nonce,c.getAuthTag(),bytes]).toString('base64');
    },
    open(owner:string,purpose:'credential'|'session',sealed:string):unknown {
      try {
        if(typeof sealed!=='string'||sealed.length>24000||!sealed.length)return deny();
        const b=Buffer.from(sealed,'base64');if(b.length<29||b.toString('base64')!==sealed)return deny();
        const c=createDecipheriv('aes-256-gcm',key,b.subarray(0,12));c.setAAD(aad(owner,purpose));c.setAuthTag(b.subarray(12,28));
        return JSON.parse(Buffer.concat([c.update(b.subarray(28)),c.final()]).toString('utf8'));
      } catch {return deny();}
    },
  });
}
export type IgDemoSharedOptions={
  origin:string;enabled:boolean;commercialApproval:boolean;displayRights:boolean;
  store:IgDemoSharedStore;cipher:ReturnType<typeof createIgDemoCipher>;
  /** Existing approved managed vault; opaque ciphertext only, never browser inputs. */
  vaultRead:(owner:string)=>Promise<string|null>;
  authorise:(request:Request)=>Promise<Access|null>;
  transport:typeof fetch;
  /** Registered immutable source, same owner, expiring token; screenshots cannot self-attest. */
  provenance?:(owner:string,token:string)=>Promise<{ownerId:string;revision:string;expiresAt:number;identity:IgDemoChartIdentity}|null>;
  sourceRevision:string;now?:()=>number;
};
export function createIgDemoSharedHttp(options:IgDemoSharedOptions) {
  if(typeof window!=='undefined')return deny();
  const now=options.now??Date.now;
  if(!/^[a-f0-9]{40}$/.test(options.sourceRevision))return deny();
  // Per-request closure avoids cross-user request/session capture in a shared server instance.
  return async(request:Request)=>{
    let requestFence:{ownerId:string;epoch:string}|undefined;
    const signal=AbortSignal.any([request.signal,AbortSignal.timeout(10_000)]);
    const wait=<T>(p:Promise<T>)=>awaitIgDemoAbortable(p,signal);
    const access=async(owner:string,required=true)=>{
      const a=await wait(options.authorise(request));
      if(!a||a.ownerId!==owner||(required&&a.permitted!==true))return deny();
      return a;
    };
    const credential=async(owner:string):Promise<Credential>=>{
      await access(owner);
      const sealed=await wait(options.vaultRead(owner));if(!sealed)return deny();
      await access(owner);
      const value=options.cipher.open(owner,'credential',sealed) as Credential;
      if(!value||value.ownerId!==owner||value.environment!=='DEMO'||
        !/^[A-Za-z0-9_-]{1,30}$/.test(value.identifier)||!/^[A-Za-z0-9_-]{1,30}$/.test(value.selectedAccountId)||
        typeof value.password!=='string'||!value.password||value.password.length>350||/[\r\n\0]/.test(value.password)||
        typeof value.apiKey!=='string'||!value.apiKey||value.apiKey.length>4096||/[^\x21-\x7e]/.test(value.apiKey))return deny();
      return value;
    };
    const connection=async(owner:string)=>{
      let observedEpoch:string|undefined;
      const current=async(epoch:string)=>{
        if(!/^[1-9][0-9]*$/.test(epoch))return deny();
        const s=await wait(options.store.read(owner));if(!s||s.epoch!==epoch)return deny();
      };
      const run=async(kind:'connect'|'snapshot',chart?:IgDemoChartIdentity)=>{
        await access(owner);
        if(!options.enabled||!options.commercialApproval||!options.displayRights)return deny();
        if(signal.aborted)return deny();
        const state=await wait(kind==='connect'?options.store.revoke(owner):options.store.read(owner));if(!state)return deny();
        observedEpoch=state.epoch;
        requestFence={ownerId:owner,epoch:state.epoch};
        try {
        const credentials=await credential(owner);
        await current(state.epoch);
        const restored=kind==='snapshot'&&state.sealed?options.cipher.open(owner,'session',state.sealed) as IgDemoStoredSession:undefined;
        if(kind==='snapshot'&&!restored)return deny();
        if(restored&&restored.accountId!==credentials.selectedAccountId)return deny();
        let saved:IgDemoStoredSession|null=null;
        const lifecycle=createIgDemoConnection({ownerId:owner,apiKey:credentials.apiKey,transport:options.transport,
          featureEnabled:true,igCommercialApproval:true,accountPositionDisplayRights:true,now,restoredSession:restored,captureSession:session=>{saved=session;},
          authorise:async()=>{const a=await access(owner);await current(state.epoch);return {ownerId:a.ownerId,premium:true,optedIn:true};},
          reserveRequest:async(account)=>{
            await access(owner);await current(state.epoch);
            if(account!==null&&account!==credentials.selectedAccountId)return false;
            const ok=await wait(options.store.reserve(credentials.selectedAccountId));
            await current(state.epoch);return ok===true;
          }});
          const result=kind==='connect'?await lifecycle.connect(credentials,signal):await lifecycle.snapshot(chart,signal);
          await access(owner);await current(state.epoch);
          if(!saved)return deny();
          if(!await wait(options.store.save(owner,state.epoch,options.cipher.seal(owner,'session',saved))))return deny();
          await current(state.epoch);
          return result;
        } catch {
          // Do not erase a newer connection. Clear only this generation's state.
          await awaitIgDemoAbortable(options.store.revoke(owner,state.epoch),AbortSignal.timeout(2000)).catch(()=>{});
          return deny();
        }
      };
      return {
        // Stored connect obtains credentials only after reserving the shared generation.
        connect:async()=>run('connect') as Promise<Awaited<ReturnType<ReturnType<typeof createIgDemoConnection>['connect']>>>,
        snapshot:async(chart?:IgDemoChartIdentity)=>run('snapshot',chart) as Promise<Awaited<ReturnType<ReturnType<typeof createIgDemoConnection>['snapshot']>>>,
        disconnect:async(cleanupSignal?:AbortSignal)=>{
          if(cleanupSignal?.aborted){
            if(!observedEpoch)return deny();
            await awaitIgDemoAbortable(options.store.revoke(owner,observedEpoch),AbortSignal.timeout(2000));
          }else{
            await access(owner,false);
            await wait(options.store.revoke(owner));
          }
          // Shared token deletion is authoritative; provider logout is not asserted.
          return {environment:'DEMO' as const,status:'REVOKED' as const,providerLogout:'UNCONFIRMED' as const};
        },
      };
    };
    const response=await createIgDemoHttp({origin:options.origin,enabled:options.enabled&&options.commercialApproval&&options.displayRights,allowRevocationWhenDisabled:true,
      authorise:options.authorise,connection,credentials:async()=>deny(),
      connectStored:async(owner)=>{await (await connection(owner)).connect();},
      chartIdentity:async(owner,token)=>{
        if(!options.provenance)return undefined;
        await access(owner);const proof=await wait(options.provenance(owner,token));await access(owner);
        if(!proof||proof.ownerId!==owner||proof.revision!==options.sourceRevision||!Number.isFinite(proof.expiresAt)||proof.expiresAt<=now()||
          proof.identity?.source!=='IG_DEMO'||proof.identity.confirmed!==true||!/^[-A-Za-z0-9._]{1,100}$/.test(proof.identity.epic)||
          !['CFD','SPREADBET','PHYSICAL'].includes(proof.identity.accountType))return undefined;
        return Object.freeze({...proof.identity});
      },
    })(request);
    // Composite connect -> provenance -> snapshot may fail between lifecycle calls.
    // Revoke only the epoch this request acquired under verified identity, not a newer login.
    if(response.status>=400&&requestFence){
      await awaitIgDemoAbortable(options.store.revoke(requestFence.ownerId,requestFence.epoch),AbortSignal.timeout(2000)).catch(()=>{});
    }
    return response;
  };
}
