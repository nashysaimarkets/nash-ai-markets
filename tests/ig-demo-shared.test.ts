import assert from 'node:assert/strict';
import test from 'node:test';
import {createIgDemoCipher,createIgDemoSharedHttp} from '../app/lib/server/ig-demo-shared.ts';
import type {IgDemoSharedStore,IgDemoSharedState,IgDemoSharedOptions} from '../app/lib/server/ig-demo-shared.ts';
import {createIgDemoPostgresStore} from '../app/lib/server/ig-demo-postgres.ts';
const owner='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222',revision='a'.repeat(40);
const request=(action:string,chartToken?:string)=>new Request('https://preview.invalid/api/pocket/ig-demo',{method:'POST',headers:{origin:'https://preview.invalid','content-type':'application/json','x-pocket-ig-demo':'1'},body:JSON.stringify({action,...(chartToken?{chartToken}:{})})});
function harness(){
 let now=Date.now(),allowed=true,calls=0,budget=100;const states=new Map<string,IgDemoSharedState>();
 const cipher=createIgDemoCipher(Buffer.alloc(32,7));
 const creds={environment:'DEMO',ownerId:owner,apiKey:'fixture-key',identifier:'demo',password:'fixture-password',selectedAccountId:'DEMO1'};
 let sealed=cipher.seal(owner,'credential',creds);
 const store:IgDemoSharedStore={read:async id=>states.get(id)??null,revoke:async (id,expected)=>{if(expected!==undefined&&states.get(id)?.epoch!==expected)return null;const s={epoch:String(BigInt(states.get(id)?.epoch??'0')+BigInt(1)),sealed:null};states.set(id,s);return s;},save:async(id,epoch,sealed)=>{if(states.get(id)?.epoch!==epoch)return false;states.set(id,{epoch,sealed:sealed||null});return true;},reserve:async()=>budget-->0};
 const options:IgDemoSharedOptions={origin:'https://preview.invalid',enabled:true,commercialApproval:true,displayRights:true,store,cipher,
 vaultRead:async()=>sealed,authorise:async()=>({ownerId:owner,permitted:allowed}),sourceRevision:revision,now:()=>now,
 transport:async(url,init)=>{calls++;assert.ok(String(url).startsWith('https://demo-api.ig.com/'));assert.ok(['POST','GET','DELETE'].includes(init?.method??'GET'));assert.ok(!String(url).includes('/otc'));
 if(init?.method==='POST')return new Response(JSON.stringify({currentAccountId:'DEMO1'}),{headers:{CST:'fixture-cst','X-SECURITY-TOKEN':'fixture-token'}});
 return Response.json(String(url).endsWith('/session')?{accountId:'DEMO1'}:String(url).endsWith('/accounts')?{accounts:[{accountId:'DEMO1',accountType:'CFD',currency:'GBP',status:'ENABLED',preferred:true}]}:{positions:[{market:{epic:'IX.D.SPTRD.DAILY.IP'},position:{dealId:'D1',direction:'BUY',size:1,level:5000,currency:'GBP'}}]});}};
 return {options,states,cipher,creds,seal:(s:string)=>sealed=s,calls:()=>calls,budget:(v:number)=>budget=v,advance:()=>now+=300001,revokeAccess:()=>allowed=false};
}
test('two server instances share encrypted session, quota and revocation',async()=>{
 const h=harness(),a=createIgDemoSharedHttp(h.options),b=createIgDemoSharedHttp(h.options);
 assert.equal((await a(request('connect'))).status,200);
 assert.ok(h.states.get(owner)?.sealed);assert.ok(!h.states.get(owner)!.sealed!.includes('fixture'));
 const read=await b(request('refresh'));assert.equal(read.status,200);assert.ok(!JSON.stringify(await read.json()).includes('fixture'));
 assert.equal((await b(request('disconnect'))).status,200);const count=h.calls();assert.equal(h.states.get(owner)?.sealed,null);
 assert.equal((await a(request('refresh'))).status,503);assert.equal(h.calls(),count);
});
test('cipher rejects cross owner/purpose, tampering and wrong key',()=>{
 const h=harness(),sealed=h.cipher.seal(owner,'session',{x:1});
 assert.throws(()=>h.cipher.open(other,'session',sealed));assert.throws(()=>h.cipher.open(owner,'credential',sealed));
 assert.throws(()=>h.cipher.open(owner,'session',sealed.slice(0,-4)+'AAAA'));assert.throws(()=>createIgDemoCipher(Buffer.alloc(32,9)).open(owner,'session',sealed));
});
test('LIVE, missing and mismatched credentials fail before broker transport',async()=>{
 for(const changes of [{environment:'LIVE'},{ownerId:other},{apiKey:''},{selectedAccountId:'bad/id'}]){
 const h=harness();h.seal(h.cipher.seal(owner,'credential',{...h.creds,...changes}));assert.equal((await createIgDemoSharedHttp(h.options)(request('connect'))).status,503);assert.equal(h.calls(),0);}
});
test('quota exhaustion is shared; no request without reservation',async()=>{
 const h=harness();h.budget(0);assert.equal((await createIgDemoSharedHttp(h.options)(request('connect'))).status,503);assert.equal(h.calls(),0);
});
test('vault/store outage and missing commercial rights fail closed',async()=>{
 for(const override of [{vaultRead:async()=>{throw Error('secret upstream');}},{commercialApproval:false},{store:{...harness().options.store,read:async()=>{throw Error('db password');}}}]){
 const h=harness();const r=await createIgDemoSharedHttp({...h.options,...override})(request('connect'));assert.ok(r.status>=400);assert.equal(h.calls(),0);assert.ok(!JSON.stringify(await r.json()).includes('password'));}
});
test('expired persisted session cannot be revived on another instance',async()=>{
 const h=harness();assert.equal((await createIgDemoSharedHttp(h.options)(request('connect'))).status,200);h.advance();const count=h.calls();assert.equal((await createIgDemoSharedHttp(h.options)(request('refresh'))).status,503);assert.equal(h.calls(),count);
});
test('late login cannot overwrite cross-instance disconnect',async()=>{
 const h=harness();let release!:()=>void;let entered!:()=>void;const ready=new Promise<void>(r=>entered=r);const gate=new Promise<void>(r=>release=r);const original=h.options.transport;
 h.options.transport=async(url,init)=>{if(init?.method==='POST'){entered();await gate;}return original(url,init);};
 const pending=createIgDemoSharedHttp(h.options)(request('connect'));await ready;
 assert.equal((await createIgDemoSharedHttp(h.options)(request('disconnect'))).status,200);release();assert.equal((await pending).status,503);assert.equal(h.states.get(owner)?.sealed,null);
});
test('provenance binds owner, immutable revision, expiry and exact product',async()=>{
 for(const changes of [{},{ownerId:other},{revision:'b'.repeat(40)},{expiresAt:0}]){
 const h=harness();h.options.provenance=async()=>({ownerId:owner,revision,expiresAt:Date.now()+100000,identity:{source:'IG_DEMO',confirmed:true,epic:'IX.D.SPTRD.DAILY.IP',accountType:'CFD'},...changes});
 const r=await createIgDemoSharedHttp(h.options)(request('connect','chart-1'));assert.equal(r.status,200);const body=await r.json();assert.equal(body.positions[0].chartContext,Object.keys(changes).length?'HOLD_CHART_IDENTITY':'EXACT_IG_PRODUCT');}
});
test('withdrawn consent still permits shared disconnect without vault reads',async()=>{
 const h=harness();await createIgDemoSharedHttp(h.options)(request('connect'));h.revokeAccess();h.options.vaultRead=async()=>{throw Error('must not read');};assert.equal((await createIgDemoSharedHttp(h.options)(request('disconnect'))).status,200);assert.equal(h.states.get(owner)?.sealed,null);
});
test('Postgres binding parameterises owner and serialises quota transaction; no database used',async()=>{
 const queries:{sql:string;p?:unknown[]}[]=[];let releases=0;
 const pool={connect:async()=>({query:async(sql:string,p?:unknown[])=>{queries.push({sql,p});return {rows:sql.startsWith('SELECT count')?[{app_used:0,account_used:0}]:[]};},release:()=>releases++})};
 const bound=createIgDemoPostgresStore(pool,'app',{application:20,account:10});assert.equal(await bound.store.reserve('DEMO1'),true);
 const lock=queries.findIndex(x=>x.sql.includes('pg_advisory_xact_lock')),read=queries.findIndex(x=>x.sql.startsWith('SELECT count')),insert=queries.findIndex(x=>x.sql.startsWith('INSERT'));
 assert.ok(lock>0&&read>lock&&insert>read);assert.equal(queries.at(-1)?.sql,'COMMIT');assert.equal(releases,1);
 assert.ok(queries.every(x=>!x.sql.includes('DEMO1')));assert.equal(await bound.store.reserve('bad/account'),false);
});
test('Postgres quota denial does not insert and transaction errors rollback/redact',async()=>{
 let queries:string[]=[];let released=0;let fail=false;
 const pool={connect:async()=>({query:async(sql:string)=>{queries.push(sql);if(fail&&sql.startsWith('SELECT count'))throw Error('password=secret');return {rows:sql.startsWith('SELECT count')?[{app_used:20,account_used:1}]:[]};},release:()=>released++})};
 const b=createIgDemoPostgresStore(pool,'app',{application:20,account:10});assert.equal(await b.store.reserve('DEMO1'),false);assert.ok(!queries.some(x=>x.startsWith('INSERT')));
 fail=true;queries=[];await assert.rejects(()=>b.store.reserve('DEMO1'),/IG_DEMO_STORE_UNAVAILABLE/);assert.equal(queries.at(-1),'ROLLBACK');assert.equal(released,2);
});
test('disconnect fences connect while managed-vault read is pending',async()=>{
 const h=harness();let release!:()=>void,entered!:()=>void;const gate=new Promise<void>(r=>release=r),ready=new Promise<void>(r=>entered=r);const original=h.options.vaultRead;
 h.options.vaultRead=async id=>{entered();await gate;return original(id);};
 const pending=createIgDemoSharedHttp(h.options)(request('connect'));await ready;
 const logout=await createIgDemoSharedHttp(h.options)(request('disconnect'));assert.equal(logout.status,200);release();assert.equal((await pending).status,503);assert.equal(h.calls(),0);assert.equal(h.states.get(owner)?.sealed,null);
});
test('failure cleanup bumps epoch so late same-generation save cannot revive session',async()=>{
 const h=harness();await createIgDemoSharedHttp(h.options)(request('connect'));const before=h.states.get(owner)!;
 h.options.transport=async()=>new Response(null,{status:401});assert.equal((await createIgDemoSharedHttp(h.options)(request('refresh'))).status,503);
 assert.notEqual(h.states.get(owner)?.epoch,before.epoch);assert.equal(await h.options.store.save(owner,before.epoch,before.sealed!),false);assert.equal(h.states.get(owner)?.sealed,null);
});
test('corrupt or expired encrypted session is conditionally revoked before transport',async()=>{
 for(const expire of [false,true]){const h=harness();await createIgDemoSharedHttp(h.options)(request('connect'));const count=h.calls();if(expire)h.advance();else h.states.set(owner,{...h.states.get(owner)!,sealed:'bad'});
 assert.equal((await createIgDemoSharedHttp(h.options)(request('refresh'))).status,503);assert.equal(h.states.get(owner)?.sealed,null);assert.equal(h.calls(),count);}
});
test('feature/rights disabled still permits authenticated shared deletion only',async()=>{
 const h=harness();await createIgDemoSharedHttp(h.options)(request('connect'));h.options.enabled=false;h.options.commercialApproval=false;h.options.vaultRead=async()=>{throw Error('must not read vault');};const count=h.calls();
 const handler=createIgDemoSharedHttp(h.options);assert.equal((await handler(request('connect'))).status,503);assert.equal((await handler(request('disconnect'))).status,200);assert.equal(h.states.get(owner)?.sealed,null);assert.equal(h.calls(),count);
});
test('pool connection failure redacted at storage boundary',async()=>{
 const b=createIgDemoPostgresStore({connect:async()=>{throw Error('credential leak');}},'app',{application:20,account:10});await assert.rejects(()=>b.store.read(owner),e=>e instanceof Error&&e.message==='IG_DEMO_STORE_UNAVAILABLE');
});
test('two Postgres adapter instances share rolling application/account quotas using isolated transaction simulation',async()=>{
 // Test double only: no PostgreSQL connection or database mutation.
 let now=1000000,tail=Promise.resolve();const charges:{account:string;at:number}[]=[];
 const pool={connect:async()=>{let unlock:(()=>void)|undefined;
 return {query:async(sql:string,p?:unknown[])=>{
   if(sql.includes('pg_advisory_xact_lock')){const before=tail;tail=new Promise<void>(r=>unlock=r);await before;}
   if(sql.startsWith('DELETE FROM')){for(let i=charges.length-1;i>=0;i--)if(charges[i].at<=now-60000)charges.splice(i,1);}
   if(sql.startsWith('SELECT count'))return {rows:[{app_used:charges.length,account_used:charges.filter(x=>x.account===p?.[1]).length}]};
   if(sql.startsWith('INSERT INTO ig_demo_private.requests'))charges.push({account:p?.[1] as string,at:now});
   if(sql==='COMMIT'||sql==='ROLLBACK')unlock?.();return {rows:[]};
 },release(){unlock?.();}};}};
 const a=createIgDemoPostgresStore(pool,'shared-app',{application:12,account:8}),b=createIgDemoPostgresStore(pool,'shared-app',{application:12,account:8});
 const results=await Promise.all(Array.from({length:40},(_,i)=>(i%2?a:b).store.reserve(i%3?'DEMO1':'DEMO2')));
 assert.equal(results.filter(Boolean).length,12);assert.ok(charges.filter(x=>x.account==='DEMO1').length<=8);assert.ok(charges.filter(x=>x.account==='DEMO2').length<=8);
 now+=60001;assert.equal(await a.store.reserve('DEMO1'),true);assert.equal(charges.length,1);
});
test('cancel during vault read clears fenced state and cannot invoke transport',async()=>{
 const h=harness();let entered!:()=>void;const ready=new Promise<void>(r=>entered=r);h.options.vaultRead=async()=>{entered();return new Promise(()=>{});};
 const abort=new AbortController();const r=new Request(request('connect'),{signal:abort.signal});const pending=createIgDemoSharedHttp(h.options)(r);await ready;abort.abort();assert.equal((await pending).status,503);assert.equal(h.states.get(owner)?.sealed,null);assert.equal(h.calls(),0);
});
test('truthy malformed access flag cannot read vault or connect',async()=>{
 const h=harness();let reads=0;h.options.authorise=async()=>({ownerId:owner,permitted:'yes' as unknown as boolean});h.options.vaultRead=async()=>{reads++;return null;};assert.equal((await createIgDemoSharedHttp(h.options)(request('connect'))).status,403);assert.equal(reads,0);assert.equal(h.calls(),0);
});
test('HTTP final owner logout conditionally erases the observed session without new auth',async()=>{
 const h=harness();let saves=0;const save=h.options.store.save;
 h.options.store.save=async(...args)=>{const result=await save(...args);if(++saves===2)h.options.authorise=async()=>null;return result;};
 // Capture request callback via indirection so a concurrent logout changes its result.
 const original=h.options.authorise;let loggedOut=false;h.options.authorise=async r=>loggedOut?null:original(r);
 h.options.store.save=async(...args)=>{const result=await save(...args);if(++saves===2)loggedOut=true;return result;};
 const response=await createIgDemoSharedHttp(h.options)(request('connect'));assert.equal(response.status,403);assert.equal(h.states.get(owner)?.sealed,null);
});
test('identity loss between persisted connect and auto-snapshot revokes request fence',async()=>{
 const h=harness();let loggedOut=false;const auth=h.options.authorise,save=h.options.store.save;h.options.authorise=async r=>loggedOut?null:auth(r);
 h.options.store.save=async(...args)=>{const result=await save(...args);loggedOut=true;return result;};
 assert.equal((await createIgDemoSharedHttp(h.options)(request('connect'))).status,503);assert.equal(h.states.get(owner)?.sealed,null);
});
test('provenance callback outage after connect clears persisted request session',async()=>{
 const h=harness();h.options.provenance=async()=>{throw Error('lookup unavailable');};assert.equal((await createIgDemoSharedHttp(h.options)(request('connect','chart-1'))).status,503);assert.equal(h.states.get(owner)?.sealed,null);
});
