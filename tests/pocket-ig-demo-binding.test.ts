import assert from 'node:assert/strict';
import test from 'node:test';
import {createIgDemoCipher} from '../app/lib/server/ig-demo-shared.ts';
import {createPocketIgDemoBinding} from '../app/lib/server/pocket-ig-demo-bootstrap.ts';
import type {PocketIgDemoConfig,PocketIgDemoPorts,PocketIgDemoBinding} from '../app/lib/server/pocket-ig-demo-bootstrap.ts';
import {bindPocketIgDemoRuntime,handlePocketIgDemoRequest,readPocketIgDemoAvailability} from '../app/lib/server/pocket-ig-demo-access.ts';
import {POST} from '../app/api/pocket/ig-demo/route.ts';

const origin='https://ntp-preview.invalid',revision='a'.repeat(40);
const owner='abcdefab-abcd-4abc-8abc-abcdefabcdef';
const other='22222222-2222-4222-8222-222222222222';
const request=(action:string,extra:Record<string,unknown>={})=>new Request(`${origin}/api/pocket/ig-demo`,{
  method:'POST',headers:{host:'ntp-preview.invalid',origin,'content-type':'application/json','x-pocket-ig-demo':'1'},
  body:JSON.stringify({action,...extra}),
});

function fixture(){
  const config:PocketIgDemoConfig={origin,revision,environment:'DEMO',application:'fixture-ntp',
    identity:{authProject:'fixture-auth',storage:'fixture-storage',keyId:'fixture-key-id'},
    limits:{application:60,account:30},enabled:true,commercialApproval:true,displayRights:true};
  const state:{identity:Awaited<ReturnType<PocketIgDemoPorts['inspectIdentity']>>;account:Awaited<ReturnType<PocketIgDemoPorts['authenticate']>>;access:Awaited<ReturnType<PocketIgDemoPorts['readAccess']>>;permissionError:boolean;quotaFull:boolean;connections:number;authReads:number;permissionReads:number}={
    identity:{...config.identity,origin,revision,application:config.application,runtimeRole:'ig_demo_runtime'},
    account:{id:owner.toUpperCase(),email:'fixture@example.invalid',email_confirmed_at:'2026-10-25T00:00:00Z'},
    access:{ownerId:owner.toUpperCase(),premium:true,optedIn:true},permissionError:false,quotaFull:false,
    connections:0,authReads:0,permissionReads:0,
  };
  const cipher=createIgDemoCipher(Buffer.alloc(32,7));
  const credential=cipher.seal(owner,'credential',{environment:'DEMO',ownerId:owner,apiKey:'fixture-api-key',identifier:'fixture',password:'fixture-password',selectedAccountId:'DEMO1'});
  const sessions=new Map<string,{epoch:string;sealed:string|null}>();
  const calls:string[]=[],queries:{sql:string;parameters?:unknown[]}[]=[];
  let charges=0;
  // Deliberate SQL-port simulation. Uses the actual PostgreSQL adapter but opens no database/network.
  const pool={connect:async()=>{state.connections++;return {query:async(sql:string,parameters?:unknown[])=>{
    queries.push({sql,parameters});
    const p=parameters??[],id=String(p[1]??'');
    if(sql==='BEGIN'||sql==='COMMIT'||sql==='ROLLBACK'||sql.startsWith('SET LOCAL '))return {rows:[]};
    if(sql.startsWith("SELECT set_config")){assert.equal(p[0],config.application);return {rows:[]};}
    if(sql.includes('pg_advisory_xact_lock'))return {rows:[]};
    if(sql.startsWith('SELECT epoch::text, sealed FROM'))return {rows:sessions.has(id)?[{...sessions.get(id)!}]:[]};
    if(sql.startsWith('INSERT INTO ig_demo_private.sessions')){
      assert.equal(id,owner);const s={epoch:String(BigInt(sessions.get(id)?.epoch??'0')+BigInt(1)),sealed:null};sessions.set(id,s);return {rows:[{...s}]};
    }
    if(sql.startsWith('UPDATE ig_demo_private.sessions SET epoch')){
      const s=sessions.get(id);if(!s||s.epoch!==p[2])return {rows:[]};
      const next={epoch:String(BigInt(s.epoch)+BigInt(1)),sealed:null};sessions.set(id,next);return {rows:[{...next}]};
    }
    if(sql.startsWith('UPDATE ig_demo_private.sessions SET sealed')){
      const s=sessions.get(id);if(!s||s.epoch!==p[2])return {rows:[]};
      s.sealed=p[3] as string|null;return {rows:[{epoch:s.epoch}]};
    }
    if(sql.startsWith('SELECT sealed FROM ig_demo_private.credentials')){assert.equal(id,owner);return {rows:[{sealed:credential}]};}
    if(sql.startsWith('SELECT revision,expires_at'))return {rows:[]};
    if(sql.startsWith('DELETE FROM ig_demo_private.requests'))return {rows:[]};
    if(sql.startsWith('SELECT count'))return {rows:[{app_used:state.quotaFull?60:charges,account_used:state.quotaFull?30:charges}]};
    if(sql.startsWith('INSERT INTO ig_demo_private.requests')){charges++;return {rows:[]};}
    throw Error(`Unexpected fixture statement: ${sql}`);
  },release(){}};}};
  const ports:PocketIgDemoPorts={pool,cipher,
    inspectIdentity:async()=>({...state.identity}),
    authenticate:async()=>{state.authReads++;return state.account;},
    readAccess:async({ownerId,signal})=>{assert.equal(ownerId,owner);signal.throwIfAborted();state.permissionReads++;if(state.permissionError)throw Error('private upstream failure');return state.access;},
    transport:async(url,init)=>{
      calls.push(`${init?.method??'GET'} ${url}`);
      assert.ok(String(url).startsWith('https://demo-api.ig.com/gateway/deal/'));
      assert.ok(!String(url).includes('/otc'));
      if(init?.method==='POST')return Response.json({currentAccountId:'DEMO1'},{headers:{CST:'fixture-cst','X-SECURITY-TOKEN':'fixture-security-token'}});
      return Response.json(String(url).endsWith('/session')?{accountId:'DEMO1'}:String(url).endsWith('/accounts')?
        {accounts:[{accountId:'DEMO1',accountType:'CFD',currency:'GBP',status:'ENABLED',preferred:true}]}:
        {positions:[{market:{epic:'IX.D.SPTRD.DAILY.IP',bid:999},position:{dealId:'D1',direction:'BUY',size:1,level:5000,currency:'GBP'}}]});
    },
  };
  return {config,ports,state,calls,queries,sessions};
}

test('unconfigured actual route remains503 despite browser and environment flags',async()=>{
  const previous=process.env.IG_DEMO_ENABLED;process.env.IG_DEMO_ENABLED='true';
  try {
    assert.equal((await POST()).status,503);
    const response=await POST(request('connect',{enabled:true,commercialApproval:true,ownerId:owner}));
    assert.equal(response.status,503);assert.deepEqual(await response.json(),{error:'IG_DEMO_NOT_CONFIGURED'});
    assert.deepEqual(await readPocketIgDemoAvailability(new Headers({host:'ntp-preview.invalid'})),{igDemoAvailable:false});
  }finally{if(previous===undefined)delete process.env.IG_DEMO_ENABLED;else process.env.IG_DEMO_ENABLED=previous;}
});

test('serialized or forged structural binding cannot install or enable the route',async()=>{
  const forged={origin,revision,handle:async()=>Response.json({ok:true}),availability:async()=>({igDemoAvailable:true})} as PocketIgDemoBinding;
  assert.throws(()=>bindPocketIgDemoRuntime(forged),/BINDING_UNAVAILABLE/);
  assert.equal((await handlePocketIgDemoRequest(request('connect'),forged)).status,503);
  assert.deepEqual(await readPocketIgDemoAvailability(new Headers({host:'ntp-preview.invalid'}),forged),{igDemoAvailable:false});
});

test('factory performs no IO and page availability does not read credentials or broker',async()=>{
  const h=fixture(),binding=createPocketIgDemoBinding(h.config,h.ports);
  assert.equal(h.state.connections,0);assert.equal(h.state.authReads,0);assert.equal(h.calls.length,0);
  assert.deepEqual(await readPocketIgDemoAvailability(new Headers({host:'ntp-preview.invalid'}),binding),{igDemoAvailable:true,igDemoDisconnectAvailable:true,igDemoOwnerScope:owner});
  assert.equal(h.state.connections,0);assert.equal(h.calls.length,0);assert.equal(h.state.authReads,1);
});

test('composed route uses real lifecycle, cipher, SQL adapter and fixed DEMO transport with canonical UUID',async()=>{
  const h=fixture(),binding=createPocketIgDemoBinding(h.config,h.ports);
  const connected=await handlePocketIgDemoRequest(request('connect'),binding);
  assert.equal(connected.status,200);const body=await connected.json();
  assert.equal(body.account.accountId,'DEMO1');assert.equal(body.positions[0].chartContext,'HOLD_CHART_IDENTITY');
  assert.equal(body.riskContext,'HOLD_MARKET_SPEC_UNVERIFIED');
  assert.equal(connected.headers.get('cache-control'),'private, no-store');
  assert.ok(!JSON.stringify(body).includes('fixture-'));assert.ok(!JSON.stringify(body).includes('bid'));
  assert.ok(h.sessions.get(owner)?.sealed);assert.equal(h.sessions.size,1);
  assert.equal((await handlePocketIgDemoRequest(request('refresh'),binding)).status,200);
  const calls=h.calls.length,disconnected=await handlePocketIgDemoRequest(request('disconnect'),binding);
  assert.equal(disconnected.status,200);assert.equal((await disconnected.json()).providerLogout,'UNCONFIRMED');
  assert.equal(h.sessions.get(owner)?.sealed,null);assert.equal(h.calls.length,calls);
  assert.ok(h.calls.every(c=>/^(GET|POST) https:\/\/demo-api\.ig\.com\/gateway\/deal\/(session|accounts|positions)$/.test(c)));
});

test('page availability ignores forwarded-host and rejects absent/foreign actual Host',async()=>{
  for(const headers of [{},{host:'evil.invalid','x-forwarded-host':'ntp-preview.invalid'},{'x-forwarded-host':'ntp-preview.invalid'},{host:'ntp-preview.invalid@evil.invalid'}]){
    const h=fixture(),binding=createPocketIgDemoBinding(h.config,h.ports);
    assert.deepEqual(await readPocketIgDemoAvailability(new Headers(headers as Record<string,string>),binding),{igDemoAvailable:false});
    assert.equal(h.state.authReads,0);assert.equal(h.calls.length,0);
  }
});

test('missing rights or availability never enables connect but authenticated disconnect still revokes',async()=>{
  for(const key of ['enabled','commercialApproval','displayRights'] as const){
    const h=fixture(),active=createPocketIgDemoBinding(h.config,h.ports);
    assert.equal((await active.handle(request('connect'))).status,200);
    const calls=h.calls.length,off=createPocketIgDemoBinding({...h.config,[key]:false},h.ports);
    assert.deepEqual(await off.availability(new Headers({host:'ntp-preview.invalid'})),{igDemoAvailable:false,igDemoDisconnectAvailable:true,igDemoOwnerScope:owner});
    assert.equal((await off.handle(request('refresh'))).status,503);
    assert.equal((await off.handle(request('disconnect'))).status,200);
    assert.equal(h.sessions.get(owner)?.sealed,null);assert.equal(h.calls.length,calls);
  }
});

test('withdrawn or unavailable paid access still allows authenticated local revocation',async()=>{
  for(const unavailableAccess of [false,true]){
    const h=fixture(),binding=createPocketIgDemoBinding(h.config,h.ports);
    await binding.handle(request('connect'));const calls=h.calls.length;
    h.state.access={ownerId:owner,premium:false,optedIn:false};h.state.permissionError=unavailableAccess;
    assert.deepEqual(await binding.availability(new Headers({host:'ntp-preview.invalid'})),{igDemoAvailable:false,igDemoDisconnectAvailable:true,igDemoOwnerScope:owner});
    assert.equal((await binding.handle(request('refresh'))).status,403);
    assert.equal((await binding.handle(request('disconnect'))).status,200);
    assert.equal(h.sessions.get(owner)?.sealed,null);assert.equal(h.calls.length,calls);
  }
});

test('source, auth, storage, key, namespace or restricted-role mismatch denies before SQL/provider',async()=>{
  const changes=[{origin:'https://other.invalid'},{revision:'b'.repeat(40)},{authProject:'other-auth'},
    {storage:'other-store'},{keyId:'other-key'},{application:'other-app'},{runtimeRole:'postgres'}];
  for(const change of changes){
    const h=fixture(),binding=createPocketIgDemoBinding(h.config,h.ports);
    Object.assign(h.state.identity,change);
    assert.equal((await binding.handle(request('connect'))).status,503);
    assert.deepEqual(await binding.availability(new Headers({host:'ntp-preview.invalid'})),{igDemoAvailable:false});
    assert.equal(h.state.connections,0);assert.equal(h.calls.length,0);
  }
});

test('anonymous, unconfirmed or malformed identities cannot query shared storage',async()=>{
  for(const account of [null,{id:owner,email:'a@b.invalid'},
    {id:owner,email:'a@b.invalid',email_confirmed_at:'yes',is_anonymous:true},
    {id:'not-a-uuid',email:'a@b.invalid',email_confirmed_at:'yes'}]){
    const h=fixture(),binding=createPocketIgDemoBinding(h.config,h.ports);h.state.account=account;
    assert.equal((await binding.handle(request('connect'))).status,401);
    assert.equal(h.state.connections,0);assert.equal(h.calls.length,0);
  }
});

test('wrong-owner and malformed truthy grants deny before shared state or provider work',async()=>{
  for(const grant of [{ownerId:other,premium:true,optedIn:true},{ownerId:owner,premium:'yes',optedIn:true},{ownerId:owner,premium:true,optedIn:1}]){
    const h=fixture(),binding=createPocketIgDemoBinding(h.config,h.ports);
    h.state.access=grant as unknown as NonNullable<typeof h.state.access>;
    assert.equal((await binding.handle(request('connect'))).status,403);
    assert.equal(h.state.connections,0);assert.equal(h.calls.length,0);
  }
});

test('host/origin injection, browser credentials and unsupported actions cannot dispatch',async()=>{
  for(const req of [new Request(request('connect'),{headers:{host:'evil.invalid',origin,'content-type':'application/json','x-pocket-ig-demo':'1'}}),
    new Request('https://evil.invalid/api/pocket/ig-demo',{method:'POST',body:'{}'}),
    request('connect',{password:'private'}),request('connect',{ownerId:other}),request('trade')]){
    const h=fixture(),binding=createPocketIgDemoBinding(h.config,h.ports);
    assert.ok((await binding.handle(req)).status>=400);assert.equal(h.calls.length,0);assert.equal(h.state.connections,0);
  }
});

test('constructor rejects non-DEMO, noncanonical origin, malformed rights and quota expansion',()=>{
  const changes=[{environment:'LIVE'},{origin:'http://ntp-preview.invalid'},{origin:`${origin}/path`},
    {revision:'latest'},{enabled:'true'},{limits:{application:61,account:31}}];
  for(const change of changes){const h=fixture();assert.throws(()=>createPocketIgDemoBinding({...h.config,...change} as PocketIgDemoConfig,h.ports));}
});

test('configuration snapshot cannot later be toggled by mutable objects',async()=>{
  const h=fixture();const config={...h.config,enabled:false};const binding=createPocketIgDemoBinding(config,h.ports);
  config.enabled=true;
  assert.equal((await binding.handle(request('connect'))).status,503);assert.equal(h.calls.length,0);
  assert.deepEqual(await binding.availability(new Headers({host:'ntp-preview.invalid'})),{igDemoAvailable:false,igDemoDisconnectAvailable:true,igDemoOwnerScope:owner});
});

test('cancellation while trusted identity inspection stalls cannot dispatch late auth/SQL/provider',async()=>{
  const h=fixture();let enter!:()=>void,release!:(value:typeof h.state.identity)=>void;
  const entered=new Promise<void>(r=>enter=r),pending=new Promise<typeof h.state.identity>(r=>release=r);
  const binding=createPocketIgDemoBinding(h.config,{...h.ports,inspectIdentity:async()=>{enter();return pending;}});
  const controller=new AbortController(),response=binding.handle(new Request(request('connect'),{signal:controller.signal}));
  await entered;controller.abort();assert.equal((await response).status,503);
  release(h.state.identity);await Promise.resolve();
  assert.equal(h.state.authReads,0);assert.equal(h.state.connections,0);assert.equal(h.calls.length,0);
});

test('quota exhaustion in existing shared SQL adapter prevents provider request',async()=>{
  const h=fixture();h.state.quotaFull=true;const binding=createPocketIgDemoBinding(h.config,h.ports);
  assert.equal((await binding.handle(request('connect'))).status,503);assert.equal(h.calls.length,0);
  assert.equal(h.sessions.get(owner)?.sealed,null);
});

test('actual mounted POST delegates once to trusted composed binding and cannot be rebound',async()=>{
  const h=fixture(),binding=createPocketIgDemoBinding(h.config,h.ports);bindPocketIgDemoRuntime(binding);
  const result=await POST(request('connect'));assert.equal(result.status,200);assert.equal((await result.json()).environment,'DEMO');
  assert.deepEqual(await readPocketIgDemoAvailability(new Headers({host:'ntp-preview.invalid'})),{igDemoAvailable:true,igDemoDisconnectAvailable:true,igDemoOwnerScope:owner});
  assert.throws(()=>bindPocketIgDemoRuntime(createPocketIgDemoBinding(h.config,h.ports)),/BINDING_UNAVAILABLE/);
  assert.equal((await POST(request('disconnect'))).status,200);
});
