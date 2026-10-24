import assert from 'node:assert/strict';
import test from 'node:test';
import {createIgDemoHttp} from '../app/lib/server/ig-demo-http.ts';
import {createIgDemoConnection} from '../app/lib/server/ntp-ig-demo-connection.ts';
import {POST} from '../app/api/pocket/ig-demo/route.ts';
const owner='11111111-1111-4111-8111-111111111111';
const other='22222222-2222-4222-8222-222222222222';
function harness(){
 let user:{ownerId:string;permitted:boolean}|null={ownerId:owner,permitted:true}; const calls:string[]=[]; let vaultReads=0;
 const connection=createIgDemoConnection({ownerId:owner,apiKey:'mock-key',featureEnabled:true,igCommercialApproval:true,accountPositionDisplayRights:true,
 authorise:async()=>user?{ownerId:user.ownerId,premium:user.permitted,optedIn:true}:null,reserveRequest:async()=>true,
 transport:async(url,init)=>{calls.push(`${init?.method} ${url}`);if(init?.method==='POST')return new Response(JSON.stringify({currentAccountId:'DEMO1'}),{headers:{CST:'mock-cst','X-SECURITY-TOKEN':'mock-token'}});
 if(init?.method==='DELETE')return new Response(null,{status:204});
 const data=String(url).endsWith('/session')?{accountId:'DEMO1'}:String(url).endsWith('/accounts')?{accounts:[{accountId:'DEMO1',accountType:'CFD',currency:'GBP',status:'ENABLED',preferred:true}]}:{positions:[{market:{epic:'IX.D.SPTRD.DAILY.IP',bid:1},position:{dealId:'D1',direction:'BUY',size:1,level:5000,currency:'GBP'}}]};return Response.json(data);}});
 const deps={origin:'http://localhost',enabled:true,authorise:async()=>user,connection:async(id:string)=>{assert.equal(id,owner);return connection;},credentials:async()=>{vaultReads++;return {identifier:'demo',password:'mock-password',selectedAccountId:'DEMO1'};}};
 return {deps,calls,connection,user:(v:typeof user)=>user=v,vaultReads:()=>vaultReads,handle:createIgDemoHttp(deps)};
}
const req=(body:unknown,headers:Record<string,string>={})=>new Request('http://localhost/api/pocket/ig-demo',{method:'POST',headers:{origin:'http://localhost','content-type':'application/json','x-pocket-ig-demo':'1',...headers},body:JSON.stringify(body)});
test('real lifecycle through HTTP boundary projects redacted account positions then revokes',async()=>{
 const h=harness();const r=await h.handle(req({action:'connect'}));assert.equal(r.status,200);const p=await r.json();assert.equal(p.account.accountId,'DEMO1');assert.equal(p.positions[0].chartContext,'HOLD_CHART_IDENTITY');assert.equal(r.headers.get('cache-control'),'private, no-store');assert.equal(JSON.stringify(p).includes('mock-'),false);assert.equal(JSON.stringify(p).includes('bid'),false);
 assert.equal((await h.handle(req({action:'refresh'}))).status,200);assert.equal(h.vaultReads(),1);assert.equal((await (await h.handle(req({action:'disconnect'}))).json()).providerLogout,'CONFIRMED');
 assert.ok(h.calls.every(x=>x.includes('https://demo-api.ig.com/gateway/deal/')));assert.ok(h.calls.every(x=>!x.includes('/otc')));
});
test('CSRF, injected owner/credentials, untrusted chart proof and invalid actions dispatch zero requests',async()=>{
 for(const request of [req({action:'connect'},{origin:'https://evil.invalid'}),req({action:'connect'},{'x-pocket-ig-demo':''}),req({action:'connect',ownerId:other}),req({action:'connect',password:'SECRET'}),req({action:'refresh',chart:{confirmed:true}}),req({action:'trade'}),req({action:'connect'},{'content-type':'text/plain'})]){const h=harness();assert.ok((await h.handle(request)).status>=400);assert.equal(h.calls.length,0);assert.equal(h.vaultReads(),0);}
});
test('anonymous/unpaid/wrong-owner cannot connect, revoked entitlement can disconnect',async()=>{
 for(const u of [null,{ownerId:owner,permitted:false},{ownerId:other,permitted:true}]){const h=harness();h.user(u);assert.ok((await h.handle(req({action:'connect'}))).status>=400);assert.equal(h.calls.length,0);}
 const h=harness();await h.handle(req({action:'connect'}));h.user({ownerId:owner,permitted:false});assert.equal((await h.handle(req({action:'disconnect'}))).status,200);assert.equal(h.connection.state().status,'REVOKED');
});
test('disabled actual customer route cannot be enabled by request',async()=>{const r=await POST();assert.equal(r.status,503);assert.deepEqual(await r.json(),{error:'IG_DEMO_NOT_CONFIGURED'});const h=harness();assert.equal((await createIgDemoHttp({...h.deps,enabled:false})(req({action:'connect'}))).status,503);assert.equal(h.calls.length,0);});
test('cancelled slow authorisation settles without vault or transport',async()=>{
 const h=harness();const abort=new AbortController();const r=new Request(req({action:'connect'}),{signal:abort.signal});const p=createIgDemoHttp({...h.deps,authorise:()=>new Promise(()=>{})})(r);abort.abort();assert.equal((await p).status,503);assert.equal(h.calls.length,0);assert.equal(h.vaultReads(),0);
});
test('server-owned provenance enables exact matching; mismatch stays HOLD',async()=>{
 for(const epic of ['IX.D.SPTRD.DAILY.IP','ES']){const h=harness();const handle=createIgDemoHttp({...h.deps,chartIdentity:async(id,token)=>{assert.equal(id,owner);assert.equal(token,'chart-1');return {source:'IG_DEMO',confirmed:true,epic,accountType:'CFD'};}});const r=await handle(req({action:'connect',chartToken:'chart-1'}));assert.equal(r.status,200);assert.equal((await r.json()).positions[0].chartContext,epic==='ES'?'HOLD_DIFFERENT_PRODUCT':'EXACT_IG_PRODUCT');}
});
test('streamed oversize request stops before consuming entire hostile body',async()=>{
 const h=harness();let count=0;let cancelled=false;
 const stream=new ReadableStream({pull(c){count++;c.enqueue(new Uint8Array(16384));if(count===100)c.close();},cancel(){cancelled=true;}});
 const request=new Request('http://localhost/api/pocket/ig-demo',{method:'POST',headers:{origin:'http://localhost','content-type':'application/json','x-pocket-ig-demo':'1'},body:stream,duplex:'half'} as RequestInit);
 assert.equal((await h.handle(request)).status,400);assert.ok(count<4);assert.ok(cancelled);assert.equal(h.calls.length,0);
});
test('loopback HTTP POST exercises boundary with lifecycle fixtures and same-origin denial',async()=>{
 const {createServer}=await import('node:http');const h=harness();
 const server=createServer(async(incoming,outgoing)=>{
  const chunks:Buffer[]=[];for await(const c of incoming)chunks.push(c);
  const request=new Request('http://localhost/api/pocket/ig-demo',{method:'POST',headers:incoming.headers as Record<string,string>,body:Buffer.concat(chunks)});
  const response=await h.handle(request);outgoing.writeHead(response.status,Object.fromEntries(response.headers));outgoing.end(await response.text());
 });
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));const address=server.address();assert.ok(address && typeof address==='object');
 try {const url=`http://127.0.0.1:${address.port}`;const good=await fetch(url,{method:'POST',headers:{origin:'http://localhost','content-type':'application/json','x-pocket-ig-demo':'1'},body:JSON.stringify({action:'connect'})});assert.equal(good.status,200);assert.equal((await good.json()).account.accountId,'DEMO1');const before=h.calls.length;const denied=await fetch(url,{method:'POST',headers:{origin:'https://evil.invalid','content-type':'application/json','x-pocket-ig-demo':'1'},body:JSON.stringify({action:'refresh'})});assert.equal(denied.status,403);assert.equal(h.calls.length,before);}finally{server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));}
});
