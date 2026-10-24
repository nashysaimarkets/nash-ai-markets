import {randomUUID} from 'node:crypto';
import {awaitIgDemoAbortable} from './ntp-ig-demo-read-only.ts';
import type {createIgDemoConnection} from './ntp-ig-demo-connection.ts';
import type {IgDemoChartIdentity} from '../ig-demo-panel.ts';
import {parseIgDemoPanel} from '../ig-demo-workspace.ts';

type Connection = ReturnType<typeof createIgDemoConnection>;
export type IgDemoHttpDependencies = Readonly<{
  origin: string;
  enabled: boolean;
  /** Server validates session UUID and rights. No email/browser claim may grant access. */
  authorise: (request: Request) => Promise<{ownerId:string; permitted:boolean}|null>;
  /** Resolve the same owner-bound lifecycle across requests; requires distributed fencing before hosting. */
  connection: (ownerId: string) => Promise<Connection>;
  /** Managed server vault only. Browser must never submit credentials or account IDs. */
  /** Return only independently registered chart provenance owned by this UUID. */
  chartIdentity?: (ownerId:string, chartToken:string) => Promise<IgDemoChartIdentity|undefined>;
  credentials: (ownerId: string) => Promise<Parameters<Connection['connect']>[0]>;
}>;
const headers={'Cache-Control':'private, no-store','Vary':'Cookie','X-Content-Type-Options':'nosniff'};
const reply=(body:unknown,status=200)=>Response.json(body,{status,headers});
/** Authenticated same-origin boundary, deliberately not bound to real services yet. */
export function createIgDemoHttp(deps: IgDemoHttpDependencies) {
  const origin = new URL(deps.origin).origin;
  return async (request: Request): Promise<Response> => {
    if(!deps.enabled) return reply({error:'IG_DEMO_NOT_CONFIGURED'},503);
    if(request.method!=='POST') return reply({error:'METHOD_NOT_ALLOWED'},405);
    if(request.headers.get('origin')!==origin || request.headers.get('x-pocket-ig-demo')!=='1' || request.headers.get('content-type')!=='application/json') return reply({error:'REQUEST_DENIED'},403);
    const signal=AbortSignal.any([request.signal,AbortSignal.timeout(12_000)]);
    try {
      const reader=request.body?.getReader();
      if(!reader) return reply({error:'INVALID_REQUEST'},400);
      let text=''; let size=0; const decoder=new TextDecoder('utf-8',{fatal:true});
      try { while(true) { const part=await awaitIgDemoAbortable(reader.read(),signal); if(part.done) break; size+=part.value.byteLength; if(size>256) return reply({error:'INVALID_REQUEST'},400); text+=decoder.decode(part.value,{stream:true}); } text+=decoder.decode(); }
      finally { void reader.cancel().catch(()=>{}); reader.releaseLock(); }
      const body=JSON.parse(text);
      if(!body || Object.keys(body).some(k=>!['action','chartToken'].includes(k)) || (body.chartToken!==undefined && (typeof body.chartToken!=='string' || !/^[A-Za-z0-9:_-]{1,96}$/.test(body.chartToken))) || !['connect','refresh','disconnect'].includes(body.action)) return reply({error:'INVALID_REQUEST'},400);
      const user=await awaitIgDemoAbortable(deps.authorise(request),signal);
      if(!user || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(user.ownerId)) return reply({error:'AUTH_REQUIRED'},401);
      if(body.action!=='disconnect' && !user.permitted) return reply({error:'ACCESS_DENIED'},403);
      const connection=await awaitIgDemoAbortable(deps.connection(user.ownerId),signal);
      if(body.action==='disconnect') return reply(await connection.disconnect(signal));
      const stillAuthorised=async()=>{
        const current=await awaitIgDemoAbortable(deps.authorise(request),signal);
        return current?.ownerId===user.ownerId && current.permitted===true;
      };
      if(body.action==='connect') {
        if(!await stillAuthorised()) return reply({error:'ACCESS_DENIED'},403);
        const credential=await awaitIgDemoAbortable(deps.credentials(user.ownerId),signal);
        if(!await stillAuthorised()) return reply({error:'ACCESS_DENIED'},403);
        await connection.connect(credential,signal);
      }
      // Only a server-registered, owner-bound source can establish broker product identity.
      const chart=body.chartToken && deps.chartIdentity ? await awaitIgDemoAbortable(deps.chartIdentity(user.ownerId,body.chartToken),signal) : undefined;
      const snapshot=await connection.snapshot(chart,signal);
      const after=await awaitIgDemoAbortable(deps.authorise(request),signal);
      if(!after || after.ownerId!==user.ownerId || !after.permitted) {
        await connection.disconnect(AbortSignal.abort());
        return reply({error:'ACCESS_DENIED'},403);
      }
      return reply(parseIgDemoPanel(snapshot));
    } catch(error) {
      if(error instanceof SyntaxError) return reply({error:'INVALID_REQUEST'},400);
      const code=error instanceof Error ? error.message : '';
      return reply({error:request.signal.aborted?'CANCELLED':'IG_DEMO_UNAVAILABLE',incident:randomUUID()},code==='IG_DEMO_HTTP_429'||code==='IG_DEMO_RATE_LIMITED'?429:503);
    }
  };
}
