/** Unmounted engineering adapter. Its transport accepts inert mock data only.
 * No credential, URL, provider client, arbitrary callback, or live RPC can be injected.
 * Uses the scanner's pure envelope/geometry code and the existing durable RPC protocol.
 * This disposable journal models those RPC transitions; it is NOT a deployed SQL ledger.
 */
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, openSync, closeSync, fsyncSync, renameSync, rmSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, relative, isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { types } from 'node:util';
import { verifyPocketBenchmarkEnvelope, type BenchmarkCallSlot } from '../app/api/pocket/torture/provider-spend.ts';
import { recoverPrecisionGeometry } from '../app/api/pocket/precision-fallback.ts';
import { calibratePocketAnalysis } from '../app/api/pocket/analysis-calibration.ts';

export const OFFLINE_ONLY = 'MONACO_ENGINEERING_ONLY_NO_PROVIDER' as const;
export const MODEL = 'gpt-5-mini-2025-08-07';
export const SLOTS = Object.freeze(['main', 'primary_precision', 'rescue_precision'] as const);
export const COSTS = Object.freeze({ main: 114000, primary_precision: 102800, rescue_precision: 102800 } as const);
const CASE_BOUND = 319600;
type Slot = BenchmarkCallSlot;
type Json = Record<string, unknown>;
export const sha256 = (bytes: string | Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));
function check(ok: unknown, message: string): asserts ok { if (!ok) throw Error(message); }
const isHash = (v: unknown) => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v);
const money = (v: unknown) => Number.isSafeInteger(v) && (v as number) >= 0;
const root = fileURLToPath(new URL('../', import.meta.url));
export const SOURCE_PINS: Readonly<Record<string, string>> = Object.freeze({
  'app/api/pocket/analyse/route.ts': '5a59b0cde257ad8ab885af9c9171198fe9732ad3a286efda301c6226903b7294',
  'app/api/pocket/analysis-calibration.ts': 'b6a7d92ef764293570b8fe70795a32a65e006029bfd2245e967744ca69c37f25',
  'app/api/pocket/precision-fallback.ts': 'a440dfd6d78aade5bbfb95e5ffdbe8e73d22e5cf72fc39355476e037725db711',
  'app/api/pocket/liquidity-chain.ts': 'f4f3280c36782d74593d13c2df437f5be23c862a35be63ef53d7a6c275da9262',
  'app/pocket/liquidity-evidence.ts': 'c294e785cbccc121e4b1a68556e20fbad7d8fc63487be64a47974d44f00c6a4f',
  'app/pocket/axis-verification.ts': '6e0a2e2d53cc062c9275107494ac658b217cf03e4e6f74756c4f48ec01c9f252',
  'app/api/pocket/torture/provider-spend.ts': '3d52facf8fd8d9f2784ecafd41ea2911c812394d658cfc9669c43031791e58ce',
  'app/api/pocket/torture/spend-ledger.ts': 'a172c2b431372ca5dc828b5e7722f0fabb5650eddea298a4cfc88a2e5a115fe6',
  'app/api/pocket/torture/spending-hold.ts': '7a2fb995a4cf49eeb9d822a3653e61bf2427351786734afb1c38f0f0f8d5081d',
  'app/api/pocket/torture/runtime-metadata.mjs': '2f62f1ffbe63d254d1f52ece19c021484050595577f178a7ea002698b37fbcce',
  'supabase/migrations/20261014113000_pocket_benchmark_pilot.sql': '2c0586c0cc785ac896374e3d0d6989a2e2e4c924c7ebd176c67c0565ca49f2b3',
});
export function verifyScannerSources() {
  for (const [path, hash] of Object.entries(SOURCE_PINS)) check(sha256(readFileSync(join(root, path))) === hash, `Scanner source drift: ${path}`);
}
export type Artifact = { sha256: string; bytes: Uint8Array };
export type CaseMaterial = {
  caseId: string; scope: 'A' | 'B'; manifestSha256: string;
  artifacts: Record<'input' | 'image' | 'bars' | 'sourceZip' | 'licence' | 'calibration', Artifact>;
  requests: Record<Slot, { sha256: string; fingerprint: string; bytes: Uint8Array }>;
};
export const PACKET_PINS = Object.freeze({
  manifest: 'df8b9e3eeaaaebff5197cbb13ddae45d362281cd3479ee398339953ab1293b21',
  requests: '19c4c86cb652fbd6562e3f7d249f65cedb65c7b80d31177c861d5e7dfe399ad4',
} as const);
/** Read an existing packet; never regenerate, select, relabel or write it. */
export function loadPreparedCase(packetDirectory:string,caseId:string):CaseMaterial {
  const directory=realpathSync(packetDirectory);
  function read(path:string,hash:string):Artifact {
    check(typeof path==='string'&&!isAbsolute(path),'Relative packet path required');
    const full=realpathSync(resolve(directory,path));const rel=relative(directory,full);
    check(rel && rel!=='..' && !rel.startsWith(`..${process.platform==='win32'?'\\':'/'}`) && !isAbsolute(rel),'Artifact escapes private packet');
    const bytes=readFileSync(full);check(isHash(hash)&&sha256(bytes)===hash,'Pinned packet artifact hash mismatch');return {bytes,sha256:hash};
  }
  const manifest=JSON.parse(Buffer.from(read('BENCHMARK50.json',PACKET_PINS.manifest).bytes).toString('utf8'));
  const requests=JSON.parse(Buffer.from(read('request-previews/REQUEST-PREVIEWS.json',PACKET_PINS.requests).bytes).toString('utf8'));
  const c=manifest.cases.find((row:Json)=>row.caseId===caseId);check(c,'Case outside frozen packet');
  const mappings={input:[c.inputPath,c.inputSha256],image:[c.imagePath,c.rasterSha256],bars:[c.barsPath,c.barsSha256],sourceZip:[c.sourcePath,c.sourceZipSha256],licence:[c.licencePath,c.licenceSha256],calibration:[c.calibrationPath,c.calibrationSha256]};
  return {caseId,scope:c.split==='development'?'A':'B',manifestSha256:PACKET_PINS.manifest,
    artifacts:Object.fromEntries(Object.entries(mappings).map(([k,[path,hash]])=>[k,read(path,hash)])) as CaseMaterial['artifacts'],
    requests:Object.fromEntries(SLOTS.map(slot=>{const rows=requests.calls.filter((row:Json)=>row.caseId===caseId&&row.slot===slot);check(rows.length===1,'Exact slot inventory required');const r=rows[0];
      check(r.inputSha256===c.inputSha256,'Input/inventory mismatch');return [slot,{...read(`request-previews/${r.path}`,r.envelopeFileSha256),fingerprint:r.providerSpendFingerprint}];})) as CaseMaterial['requests']};
}
export type Binding = {
  mode: typeof OFFLINE_ONLY; scope: 'A' | 'B'; caseIds: string[]; manifestSha256: string;
  candidateSha: string; scannerSourcesSha256: string; requestInventorySha256: string;
  referenceSha256: string | null; protocolSha256: string | null; freezeSha256: string | null;
  model: string; ledgerKey: string; capMicroUsd: number; priorExposureMicroUsd: number | null;
  caseDigests: Record<string, string>;
};
export type Review = { kind: 'primary' | 'independent' | 'protocol' | 'finance' | 'security' | 'run';
  reviewer: string; decision: 'APPROVED'; bindingSha256: string; evidenceSha256: string;
  /** Only engineering fixtures are admitted here; never represent these as human sign-off. */
  syntheticEngineeringFixture: true };
export type Admission = { binding: Binding; reviews: Review[] };
export function materialDigest(m: CaseMaterial) {
  return sha256(JSON.stringify({caseId:m.caseId,scope:m.scope,manifestSha256:m.manifestSha256,
    artifacts:Object.fromEntries(Object.entries(m.artifacts).map(([k,v])=>[k,v.sha256])),
    requests:Object.fromEntries(SLOTS.map(s=>[s,{sha256:m.requests[s].sha256,fingerprint:m.requests[s].fingerprint}]))}));
}
export function assertAdmission(admission: Admission | undefined, material: CaseMaterial) {
  check(admission?.binding?.mode === OFFLINE_ONLY, 'Mandatory offline benchmark scope missing');
  const b = admission.binding;
  check(b.scope === material.scope && ['A','B'].includes(b.scope), 'A/B scope mismatch');
  check(b.model === MODEL && b.candidateSha==='f5e820b0bd7bf095153e31d692a10fb3640ba16e', 'Exact candidate/model required');
  check(b.scannerSourcesSha256 === sha256(JSON.stringify(SOURCE_PINS)), 'Exact scanner source inventory required');
  for (const value of [b.manifestSha256,b.requestInventorySha256,b.referenceSha256,b.protocolSha256,b.freezeSha256]) check(isHash(value), 'References/protocol/freeze or exact inventory missing');
  check(b.manifestSha256 === material.manifestSha256 && b.caseDigests[material.caseId] === materialDigest(material), 'Exact case source/request binding mismatch');
  const expected = Array.from({length:b.scope==='A'?6:44},(_,i)=>`${b.scope==='A'?'d':'e'}${String(i+1).padStart(3,'0')}`);
  check(JSON.stringify(b.caseIds) === JSON.stringify(expected) && b.caseIds.includes(material.caseId), 'Named A/B case allowlist required');
  check(Object.keys(b.caseDigests).length===expected.length && expected.every(id=>isHash(b.caseDigests[id])), 'Complete scope case digests required');
  check(b.ledgerKey === `offline-${b.scope}` && money(b.capMicroUsd) && b.capMicroUsd > 0 && money(b.priorExposureMicroUsd), 'Separate budget and verified prior exposure required');
  check(b.capMicroUsd <= (b.scope==='A'?5000000:14062400) && b.priorExposureMicroUsd! + expected.length*CASE_BOUND <= b.capMicroUsd, 'Complete scope budget/headroom insufficient');
  const digest=sha256(JSON.stringify(b));
  for (const kind of ['primary','independent','protocol','finance','security','run'] as const) {
    const rows=admission.reviews.filter(r=>r.kind===kind);
    check(rows.length===1 && rows[0]!.decision==='APPROVED' && rows[0]!.syntheticEngineeringFixture===true
      && rows[0]!.reviewer.trim().length>0 && rows[0]!.bindingSha256===digest && isHash(rows[0]!.evidenceSha256), `Missing bound ${kind} approval/reference (offline fixture only)`);
  }
  check(admission.reviews.find(r=>r.kind==='primary')!.reviewer !== admission.reviews.find(r=>r.kind==='independent')!.reviewer, 'Separate reference reviewers required');
  check(admission.reviews.length===6, 'Unknown/duplicate approval');
  verifyScannerSources();
  for (const name of ['input','image','bars','sourceZip','licence','calibration'] as const) {
    const a=material.artifacts[name]; check(a && isHash(a.sha256) && sha256(a.bytes)===a.sha256, `Exact ${name} hash mismatch`);
  }
  const input=JSON.parse(Buffer.from(material.artifacts.input.bytes).toString('utf8'));
  check(input.intention==='UNSURE' && input.chartConfirmation?.contextMatch==='NOT_PROVIDED'
    && Object.keys(input).every(k=>['image','precisionImage','intention','chartConfirmation'].includes(k)), 'Neutral reviewed input scope required');
  const imageUrl=`data:image/png;base64,${Buffer.from(material.artifacts.image.bytes).toString('base64')}`;
  check(input.image===imageUrl, 'Input/image mismatch');
  const envelopes={} as Record<Slot, Json>;
  for (const slot of SLOTS) {
    const r=material.requests[slot]; check(r && sha256(r.bytes)===r.sha256, `Exact ${slot} request hash mismatch`);
    const envelope=JSON.parse(Buffer.from(r.bytes).toString('utf8'));
    const plan={slot,model:MODEL,serviceTier:'default',maxOutputTokens:slot==='main'?7000:1400,
      maxInputTextChars:30000,maxSchemaBytes:30000,maxImages:2,maxImageBytes:8000000,maxImageWidth:4096,maxImageHeight:4096,maxImagePixels:33554432,
      maxCostMicroUsd:COSTS[slot],costBoundEvidenceRef:'PR137-pinned-full-context-bounds'};
    const facts=verifyPocketBenchmarkEnvelope(slot,envelope,{plan:{[slot]:plan}} as never);
    check(facts && facts.fingerprint===r.fingerprint, 'Spend fingerprint mismatch');
    const urls=envelope.input[0].content.filter((c:Json)=>c.type==='input_image').map((c:Json)=>c.image_url);
    check(JSON.stringify(urls)===JSON.stringify(slot==='rescue_precision' && input.precisionImage?[imageUrl,input.precisionImage]:[imageUrl]), 'Request/input image scope mismatch');
    envelopes[slot]=envelope;
  }
  return {binding:clone(b),envelopes,input};
}

type Receipt = { _request_id: string; id: string; model: string; service_tier: string;
  usage: {input_tokens:number;output_tokens:number;total_tokens:number}; output_text: string; status?: string };
export type MockStep = { slot: Slot; response?: Receipt; fail?: 'transport' | 'lost_receipt'; pause?: boolean };
type Transport = Readonly<{kind:typeof OFFLINE_ONLY}>;
const mocks=new WeakMap<Transport,{steps:MockStep[];sends:Slot[];release:(()=>void)|null;waiting:Promise<void>|null}>();
function inertData(value:unknown, seen=new Set<object>(),depth=0):void {
  check(depth<32,'Mock data nesting limit');
  if(value===null||typeof value==='string'||typeof value==='boolean')return;
  if(typeof value==='number'){check(Number.isFinite(value),'Finite mock data required');return;}
  check(typeof value==='object','Mock data only');
  check(!types.isProxy(value),'No mock proxies');
  check(!seen.has(value),'Cyclic mock data');seen.add(value);
  const proto=Object.getPrototypeOf(value);check(proto===Object.prototype||proto===Array.prototype||proto===null,'Plain mock data only');
  for(const key of Reflect.ownKeys(value)){
    check(typeof key==='string'&&key!=='toJSON','No executable mock data');
    const descriptor=Object.getOwnPropertyDescriptor(value,key)!;
    check('value' in descriptor&&!descriptor.get&&!descriptor.set,'No mock accessors');
    inertData(descriptor.value,seen,depth+1);
  }
  seen.delete(value);
}
export function createMockTransport(steps: MockStep[]) {
  // JSON data only: reject functions, clients, accessors, executable callbacks and unknown keys.
  inertData(steps);check(Array.isArray(steps),'Mock steps array required');const raw=JSON.stringify(steps);
  const data:MockStep[]=JSON.parse(raw);
  for(const s of data)check(SLOTS.includes(s.slot)&&Object.keys(s).every(k=>['slot','response','fail','pause'].includes(k))&&(!s.fail||['transport','lost_receipt'].includes(s.fail)),'Invalid mock step');
  const token=Object.freeze({kind:OFFLINE_ONLY}); const state={steps:data,sends:[] as Slot[],release:null as (()=>void)|null,waiting:null as Promise<void>|null};mocks.set(token,state);
  return {transport:token,sends:()=>[...state.sends],release:()=>state.release?.()};
}
type CallState={status:'reserved'|'submitted'|'voided';requestHash:string;fingerprint:string;cost:number;receipt?:Receipt;receiptSha256?:string};
type CaseState={scope:'A'|'B';digest:string;calls:Record<Slot,CallState>;status:'ACTIVE'|'UNCERTAIN'|'CANCELLED'|'TECHNICAL_FAILURE'|'MOCK_COMPLETE';raw:Partial<Record<Slot,Receipt>>;analysis?:unknown;budgetAccounted:boolean;latencyMs:number|null;cancelled:boolean};
type Journal={kind:typeof OFFLINE_ONLY;version:1;bindings:Partial<Record<'A'|'B',Binding>>;activeCase:string|null;cases:Record<string,CaseState>;events:{rpc:string;caseId:string;slot?:Slot}[]};
export type Store=Readonly<{kind:typeof OFFLINE_ONLY;directory:string}>;
const stores=new WeakSet<Store>();
function token(path:string):Store {const s=Object.freeze({kind:OFFLINE_ONLY,directory:path});stores.add(s);return s;}
function persist(path:string,state:Journal) {
  const text=JSON.stringify(state);const temp=join(path,'next.json');
  writeFileSync(temp,JSON.stringify({sha256:sha256(text),state}),{mode:0o600,flag:'wx'});
  const fd=openSync(temp,'r');try{fsyncSync(fd);}finally{closeSync(fd);}renameSync(temp,join(path,'journal.json'));
  const dir=openSync(path,'r');try{fsyncSync(dir);}finally{closeSync(dir);}
}
export function createDisposableStore():Store {
  const path=mkdtempSync(join(tmpdir(),'monaco-offline-'));
  persist(path,{kind:OFFLINE_ONLY,version:1,bindings:{},activeCase:null,cases:{},events:[]});return token(path);
}
export function reopenDisposableStore(path:string):Store {
  const actual=realpathSync(path);check(dirname(actual)===realpathSync(tmpdir()) && actual.startsWith(join(realpathSync(tmpdir()),'monaco-offline-')), 'Only disposable offline directory allowed');
  const s=token(actual);snapshot(s);return s;
}
export function snapshot(store:Store):Journal {
  check(stores.has(store),'Branded disposable storage required');const wrapper=JSON.parse(readFileSync(join(store.directory,'journal.json'),'utf8'));
  check(wrapper.state?.kind===OFFLINE_ONLY && wrapper.state.version===1 && sha256(JSON.stringify(wrapper.state))===wrapper.sha256,'Journal integrity failure');return clone(wrapper.state);
}
export function disposeStore(store:Store){check(stores.has(store),'Disposable storage required');rmSync(store.directory,{recursive:true,force:true});stores.delete(store);}
function transact<T>(store:Store, action:(state:Journal)=>T):T {
  check(stores.has(store),'Branded disposable storage required');const lock=join(store.directory,'lock');mkdirSync(lock); // fail closed on concurrent/stale lock; never steal it
  try{const state=snapshot(store);const result=action(state);persist(store.directory,state);return result;}finally{rmSync(lock,{recursive:true,force:true});}
}
function exposure(state:Journal,scope:'A'|'B') {
  return state.bindings[scope]!.priorExposureMicroUsd!+Object.values(state.cases).filter(c=>c.scope===scope).reduce((n,c)=>n+Object.values(c.calls).filter(x=>x.status!=='voided').reduce((a,x)=>a+x.cost,0),0);
}
function voidUnused(state:Journal,id:string){for(const slot of SLOTS)if(state.cases[id]!.calls[slot].status==='reserved'){
  state.cases[id]!.calls[slot].status='voided';state.events.push({rpc:'void_pocket_benchmark_call',caseId:id,slot});}}
function account(state:Journal,id:string){const c=state.cases[id]!;
  if(c.budgetAccounted)return true; // idempotent recovery must not release a later chart's lease
  if(Object.values(c.calls).some(x=>x.status==='reserved'||x.status==='submitted'&&!x.receipt))return false;
  // Existing full-reservation-v2 requires both base passes. Partial cancellation
  // cannot release the chart lease merely because the one known receipt arrived.
  if(!c.calls.main.receipt || !c.calls.primary_precision.receipt)return false;
  check(exposure(state,c.scope)<=state.bindings[c.scope]!.capMicroUsd,'Aggregate cap exceeded');
  check(state.activeCase===id,'Accounting requires its own active chart lease');
  c.budgetAccounted=true;state.activeCase=null;state.events.push({rpc:'account_pocket_benchmark_reserved_case',caseId:id});return true;
}
function receiptValid(r:Receipt,slot:Slot){return r && typeof r._request_id==='string' && r._request_id.trim() && typeof r.id==='string' && r.id.trim()
  && r.model===MODEL && r.service_tier==='default' && money(r.usage?.input_tokens) && money(r.usage?.output_tokens)
  && r.usage.input_tokens+r.usage.output_tokens===r.usage.total_tokens && r.usage.total_tokens<=400000
  && r.usage.output_tokens<=(slot==='main'?7000:1400) && typeof r.output_text==='string';}
function saveReceipt(state:Journal,id:string,slot:Slot,r:Receipt){const c=state.cases[id]!;const call=c.calls[slot];
  check(call.status==='submitted' && receiptValid(r,slot),'Receipt identity/model/tier/usage invalid; reserve retained');
  if(call.receipt){check(JSON.stringify(call.receipt)===JSON.stringify(r),'Immutable receipt conflict');return;}
  check(!Object.values(state.cases).some(row=>Object.values(row.calls).some(x=>x.receipt?._request_id===r._request_id||x.receipt?.id===r.id)),'Duplicate receipt identity');
  call.receipt=clone(r);call.receiptSha256=sha256(JSON.stringify(r));c.raw[slot]=clone(r);state.events.push({rpc:'record_pocket_benchmark_receipt',caseId:id,slot});
}
/** Manual receipt recovery cannot dispatch, refund, resume cancelled work or create acceptance. */
export function recoverReceipt(store:Store,id:string,slot:Slot,requestHash:string,fingerprint:string,receipt:Receipt){
  return transact(store,state=>{const c=state.cases[id];check(c,'Case missing');
    check(c.calls[slot].requestHash===requestHash && c.calls[slot].fingerprint===fingerprint,'Recovery request binding mismatch');
    saveReceipt(state,id,slot,receipt);if(c.status!=='ACTIVE')account(state,id);
    return {recovered:true,financiallySettled:false,actualMicroUsd:null,measurement:'UNMEASURED'};});
}
/** Identical condition to the pinned safePrecision initializer. No semantic answer/tuning dependency. */
export function needsRescue(outputText:string){
  try{const p=JSON.parse(outputText);if(!p||!Array.isArray(p.levels))return false;
    const price=(v:unknown)=>{const s=typeof v==='string'?v.trim().replaceAll(',',''):'';return s&&/^-?\d+(?:\.\d+)?$/.test(s)?Number(s):NaN;};
    const current=price(p.currentPrice);const prices=p.levels.flatMap((v:unknown)=>v&&typeof v==='object'?[price((v as Json).price)]:[]).filter(Number.isFinite);
    return p.levels.length===0||!Number.isFinite(current)||!prices.some((v:number)=>v<current)||!prices.some((v:number)=>v>current);
  }catch{return false;}
}
function parseRecord(text:string){const v=JSON.parse(text);check(v&&typeof v==='object'&&!Array.isArray(v),'Malformed scanner object');return v as Json;}
function calibrated(raw:Partial<Record<Slot,Receipt>>,input:Json){
  check(Object.values(raw).every(r=>r.status==='completed'),'Incomplete/failed response is unmeasured');
  const main=parseRecord(raw.main!.output_text);let precision:Json|null=null;
  try{precision=parseRecord(raw.primary_precision!.output_text);}catch{/* Same fail-closed pure geometry fallback as scanner. */}
  if(raw.rescue_precision){try{const rescue=parseRecord(raw.rescue_precision.output_text);precision=recoverPrecisionGeometry(precision??{},rescue)??rescue;}catch{/* Preserve first precision. */}}
  precision=recoverPrecisionGeometry(main,precision);
  const merged:Json=precision?{...main,plotBounds:precision.plotBounds,priceScaleAnchors:precision.priceScaleAnchors,levels:precision.levels,currentPrice:precision.currentPrice,contextBattlefield:null}:{...main,priceScaleAnchors:[],levels:[]};
  if(input.chartConfirmation){const facts=input.chartConfirmation as Json;Object.assign(merged,{instrument:facts.instrument,timeframe:facts.timeframe,currentPrice:facts.currentPrice});}
  return calibratePocketAnalysis(merged);
}
export async function runOfflineCase(args:{admission?:Admission;material:CaseMaterial;store:Store;transport:Transport;signal?:AbortSignal}) {
  // Snapshot mutable caller data before the first await; no post-admission TOCTOU.
  const {store,transport,signal}=args;
  const m=structuredClone(args.material);const a=args.admission?clone(args.admission):undefined;
  check(mocks.has(transport),'Only branded inert mock transport allowed');check(stores.has(store),'Only disposable storage allowed');
  const admitted=assertAdmission(a,m);const b=admitted.binding;const id=m.caseId;const started=performance.now();
  if(signal?.aborted)return {status:'CANCELLED_BEFORE_CLAIM',measurement:'UNMEASURED',providerCalls:0 as const};
  transact(store,state=>{
    check(!state.activeCase,'One-chart concurrency: previous case unresolved');check(!state.cases[id],'Duplicate case dispatch rejected');
    if(state.bindings[b.scope])check(JSON.stringify(state.bindings[b.scope])===JSON.stringify(b),'Durable scope cannot be reseeded');else state.bindings[b.scope]=b;
    check(exposure(state,b.scope)+CASE_BOUND<=b.capMicroUsd,'Separate aggregate budget exceeded');
    state.cases[id]={scope:b.scope,digest:materialDigest(m),status:'ACTIVE',budgetAccounted:false,raw:{},latencyMs:null,cancelled:false,
      calls:Object.fromEntries(SLOTS.map(slot=>[slot,{status:'reserved',cost:COSTS[slot],requestHash:m.requests[slot].sha256,fingerprint:m.requests[slot].fingerprint}])) as Record<Slot,CallState>};
    state.activeCase=id;state.events.push({rpc:'claim_pocket_benchmark_case',caseId:id});
  });
  const mock=mocks.get(transport)!;
  async function dispatch(slot:Slot){
    check(!signal?.aborted,'Cancelled');
    transact(store,state=>{const c=state.cases[id]!;check(state.activeCase===id&&c.status==='ACTIVE'&&c.calls[slot].status==='reserved','Duplicate dispatch or missing durable scope');
      c.calls[slot].status='submitted';state.events.push({rpc:'submit_pocket_benchmark_call',caseId:id,slot});});
    const step=mock.steps.shift();mock.sends.push(slot);check(step?.slot===slot,'Mock script transport mismatch; outcome uncertain');
    if(step.pause){mock.waiting=new Promise<void>(r=>{mock.release=r;});const wait=mock.waiting;
      await new Promise<void>((res,rej)=>{const abort=()=>rej(Error('Cancelled after submission'));signal?.addEventListener('abort',abort,{once:true});
        wait.then(()=>{signal?.removeEventListener('abort',abort);res();},rej);if(signal?.aborted)abort();});mock.release=null;mock.waiting=null;}
    if(step.fail==='transport')throw Error('Mock transport uncertain outcome');
    check(step.response,'Missing mock receipt; outcome uncertain');
    if(step.fail==='lost_receipt')throw Error('Mock receipt persistence interruption');
    transact(store,state=>saveReceipt(state,id,slot,step.response!));return step.response;
  }
  try{
    // One chart and one call in flight. Serial order is an offline safety profile, not route latency parity.
    await dispatch('main');const first=await dispatch('primary_precision');
    if(needsRescue(first.output_text))await dispatch('rescue_precision');
    check(!signal?.aborted,'Cancelled');
    transact(store,state=>{const c=state.cases[id]!;voidUnused(state,id);c.analysis=calibrated(c.raw,admitted.input);c.status='MOCK_COMPLETE';c.latencyMs=performance.now()-started;account(state,id);});
  }catch(error){
    transact(store,state=>{const c=state.cases[id]!;voidUnused(state,id);c.cancelled=signal?.aborted===true;
      const uncertain=Object.values(c.calls).some(x=>x.status==='submitted'&&!x.receipt);
      c.status=uncertain?'UNCERTAIN':c.cancelled?'CANCELLED':'TECHNICAL_FAILURE';c.latencyMs=performance.now()-started;account(state,id);});
    return {status:snapshot(store).cases[id]!.status,measurement:'UNMEASURED',reason:error instanceof Error?error.message:'Offline failure',providerCalls:0 as const};
  }
  return {status:'MOCK_COMPLETE',measurement:'SYNTHETIC_ENGINEERING_ONLY',providerCalls:0 as const,financiallySettled:false as const,actualMicroUsd:null};
}
