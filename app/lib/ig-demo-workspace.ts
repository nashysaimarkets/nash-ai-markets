import type { IgDemoPanelSnapshot } from './ig-demo-panel.ts';
export type IgDemoWorkspaceState = Readonly<{ snapshot: IgDemoPanelSnapshot | null; busy: boolean; message?: 'UNAVAILABLE' | 'EXPIRED' | 'RATE_LIMITED' | 'CANCELLED'; logout?: 'CONFIRMED' | 'UNCONFIRMED' }>;
export type IgDemoAction = 'connect' | 'refresh' | 'disconnect';
/** Browser accepts only the redacted contract. Unknown fields are rejected, never persisted. */
export function parseIgDemoPanel(raw: unknown, now = Date.now()): IgDemoPanelSnapshot {
  const fail = (): never => { throw Error('IG_DEMO_INVALID_VIEW'); };
  const obj = (v: unknown, keys: string[]): Record<string, unknown> => {
    if (!v || typeof v !== 'object' || Array.isArray(v) || Object.keys(v).some(k => !keys.includes(k))) return fail();
    return v as Record<string, unknown>;
  };
  const id = (v: unknown): string => typeof v === 'string' && /^[A-Za-z0-9._:-]{1,96}$/.test(v) ? v : fail();
  const currency = (v: unknown): string => typeof v === 'string' && /^[A-Z]{3}$/.test(v) ? v : fail();
  const n = (v: unknown): number => typeof v === 'number' && Number.isFinite(v) ? v : fail();
  const p = obj(raw, ['environment','status','connectionId','generation','observedAt','expiresAt','account','positions','riskContext']);
  if (p.environment !== 'DEMO' || p.status !== 'CONNECTED' || p.riskContext !== 'HOLD_MARKET_SPEC_UNVERIFIED' || !Number.isSafeInteger(p.generation) || n(p.generation) < 1) return fail();
  if (typeof p.expiresAt !== 'string' || typeof p.observedAt !== 'string') return fail();
  const end = Date.parse(p.expiresAt), start = Date.parse(p.observedAt);
  if (!Number.isFinite(end) || !Number.isFinite(start) || end <= now || start > now + 5000 || end <= start || end - start > 300_000) return fail();
  const a = obj(p.account, ['accountId','accountType','currency']);
  if (a.accountType !== 'CFD' && a.accountType !== 'SPREADBET' && a.accountType !== 'PHYSICAL') return fail();
  if (!Array.isArray(p.positions) || p.positions.length > 100) return fail();
  const seen = new Set<string>();
  const positions = p.positions.map(v => {
    const x = obj(v, ['dealId','epic','direction','size','openLevel','currency','chartContext']);
    const dealId = id(x.dealId); if (seen.has(dealId)) return fail(); seen.add(dealId);
    if (x.direction !== 'BUY' && x.direction !== 'SELL') return fail();
    if (!['EXACT_IG_PRODUCT','HOLD_CHART_IDENTITY','HOLD_DIFFERENT_PRODUCT'].includes(String(x.chartContext)) || n(x.size) <= 0) return fail();
    return Object.freeze({dealId, epic:id(x.epic), direction:x.direction, size:n(x.size), openLevel:n(x.openLevel), currency:currency(x.currency), chartContext:x.chartContext}) as IgDemoPanelSnapshot['positions'][number];
  });
  return Object.freeze({environment:'DEMO', status:'CONNECTED', connectionId:id(p.connectionId), generation:n(p.generation), observedAt:p.observedAt, expiresAt:p.expiresAt, account:Object.freeze({accountId:id(a.accountId), accountType:a.accountType, currency:currency(a.currency)}), positions:Object.freeze(positions), riskContext:'HOLD_MARKET_SPEC_UNVERIFIED'});
}
/** One browser request generation; never stores credentials, account data or consent locally. */
export function createIgDemoWorkspace(send: (action: IgDemoAction, signal: AbortSignal) => Promise<unknown>, changed: (s: IgDemoWorkspaceState) => void, timeoutMs = 12_000) {
  let epoch = 0, pending: AbortController | undefined;
  let expiry: ReturnType<typeof setTimeout> | undefined;
  let state: IgDemoWorkspaceState = {snapshot:null,busy:false};
  const emit = (next: IgDemoWorkspaceState) => { state = next; changed(next); };
  function clear() { epoch++; pending?.abort(); pending=undefined; clearTimeout(expiry); }
  return {
    state: () => state,
    reset() { clear(); emit({snapshot:null,busy:false}); },
    cancel() { clear(); emit({snapshot:null,busy:false,message:'CANCELLED'}); },
    async run(action: IgDemoAction) {
      clear(); const current = epoch; const controller = new AbortController(); pending=controller;
      emit({snapshot:null,busy:true});
      let timedOut = false;
      const timer = setTimeout(() => { timedOut=true; controller.abort(); }, timeoutMs);
      try {
        const response = await new Promise<unknown>((resolve,reject) => {
          controller.signal.addEventListener('abort',()=>reject(Error('CANCELLED')),{once:true});
          send(action,controller.signal).then(resolve,reject);
        });
        if (current !== epoch) return;
        if (action === 'disconnect') {
          const v = response as {status?:unknown; providerLogout?:unknown};
          if (v?.status !== 'REVOKED' || !['CONFIRMED','UNCONFIRMED'].includes(String(v.providerLogout))) throw Error('INVALID');
          emit({snapshot:null,busy:false,logout:v.providerLogout as 'CONFIRMED'|'UNCONFIRMED'});
        } else {
          const snapshot = parseIgDemoPanel(response);
          emit({snapshot,busy:false});
          expiry=setTimeout(()=>{ if(current===epoch) {clear(); emit({snapshot:null,busy:false,message:'EXPIRED'});} },Math.max(0,Date.parse(snapshot.expiresAt)-Date.now()));
        }
      } catch (error) {
        if (current === epoch) emit({snapshot:null,busy:false,message: !timedOut && controller.signal.aborted ? 'CANCELLED' : error instanceof Error && error.message==='RATE_LIMITED' ? 'RATE_LIMITED' : 'UNAVAILABLE'});
      } finally { clearTimeout(timer); if(current===epoch) pending=undefined; }
    },
  };
}
