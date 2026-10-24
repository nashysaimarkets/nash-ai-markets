import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {readFile,writeFile,open} from 'node:fs/promises';
import assert from 'node:assert/strict';
const root='/workspace/scratch/35c5363ca2aa/build-auth-app',out='/workspace/scratch/35c5363ca2aa/build-auth-evidence';
const origin='http://127.0.0.1:43212',upstream='http://127.0.0.1:43211';
const image='data:image/png;base64,'+(await readFile('../d002-offline-evidence/original.png')).toString('base64');
const retained={};for(const s of ['main','primary_precision','rescue_precision'])retained[s]=JSON.parse(await readFile('../scan-two-resume/private-result/provider-response-'+s+'.json','utf8'));
const main=JSON.parse(retained.main.output_text);
const preflight={status:'READY',instrument:'BTC',instrumentConfidence:'HIGH',timeframe:'1h',timeframeConfidence:'HIGH',currentPrice:'83250.07',currentPriceConfidence:'HIGH',priceScaleVisible:true,candlesReadable:true,enoughHistory:true,sameInstrument:null,issues:[],guidance:'Check chart facts.'};
const lab={instrument:'BTC',timeframe:'1h',currentPrice:'83250.07',confidence:'LOW',levelStory:'Model claim only',limitation:'Unverified role',levels:[],priceScaleAnchors:[],plotBounds:null,evidenceQuality:{scaleReadable:true,candlesReadable:true}};
const ids=Object.fromEntries(['paid','unpaid','expired','unconfirmed','anonymous','rpc-error','rpc-malformed','same-email-new-id','revoked'].map((k,i)=>[k,`00000000-0000-4000-8000-${String(i+1).padStart(12,'0')}`]));
const tokenKind=new Map();
function session(kind){const exp=Math.floor(Date.now()/1000)+(kind==='expired'?-1000:3600);const access=[{alg:'HS256',typ:'JWT'},{sub:ids[kind],exp,role:'authenticated',email:'fixture@example.invalid',kind},'offline-signature'].map((v,i)=>i<2?Buffer.from(JSON.stringify(v)).toString('base64url'):v).join('.');tokenKind.set(access,kind);return {access_token:access,refresh_token:'offline-refresh-'+kind,expires_at:exp,expires_in:3600,token_type:'bearer',user:{id:ids[kind],email:'fixture@example.invalid'}};}
function cookie(kind){return 'sb-127-auth-token=base64-'+Buffer.from(JSON.stringify(session(kind))).toString('base64url');}
let precisionOrdinal=0;let mode='normal',calls=[],tests=[],held=[],serial=0;
function response(status,text){return {id:'resp_offline',object:'response',status,output:[{type:'message',role:'assistant',content:[{type:'output_text',text,annotations:[]}]}],usage:{input_tokens:0,output_tokens:0,total_tokens:0}};}
const server=createServer(async(req,res)=>{let body='';for await(const c of req)body+=c;const path=new URL(req.url,upstream).pathname;const entry={path,method:req.method,mode};calls.push(entry);res.setHeader('content-type','application/json');
 const send=(status,data)=>{res.statusCode=status;res.end(JSON.stringify(data));};
 if(path==='/auth/v1/user') {const kind=tokenKind.get((req.headers.authorization??'').replace(/^Bearer /,''));entry.kind=kind??'unknown';if(!kind||['revoked','expired'].includes(kind))return send(401,{code:'bad_jwt',message:'Invalid fixture session'});return send(200,{id:ids[kind],aud:'authenticated',role:'authenticated',email:'fixture@example.invalid',email_confirmed_at:kind==='unconfirmed'?null:'2026-01-01T00:00:00Z',is_anonymous:kind==='anonymous',app_metadata:{},user_metadata:{},created_at:'2026-01-01T00:00:00Z'});}
 if(path==='/auth/v1/token')return send(400,{error:'invalid_grant',error_description:'Offline refresh expired'});
 if(path==='/rest/v1/rpc/has_pocket_web_subscription'){const p=JSON.parse(body);entry.userId=p.p_user_id;const kind=Object.keys(ids).find(k=>ids[k]===p.p_user_id);if(kind==='rpc-error')return send(500,{message:'Fixture ledger unavailable'});return send(200,kind==='rpc-malformed'?{active:true}:kind==='paid');}
 if(path==='/v1/responses') {const b=JSON.parse(body);entry.schema=b.text?.format?.name;entry.completed=false;
  if(mode==='pending'){held.push({res,entry});res.on('close',()=>{entry.closed=true;});return;}
  let data;if(entry.schema==='pocket_bullseye_chart_analysis')data=mode==='malformed'?response('completed','{"verdict":["WAIT"]}'):mode==='incomplete'?response('incomplete',retained.main.output_text):retained.main;
  else if(entry.schema==='pocket_bullseye_precision_overlays') data=retained[precisionOrdinal++%2===0?'primary_precision':'rescue_precision'];
  else if(entry.schema==='pocket_bullseye_level_lab')data=response(mode==='incomplete'?'incomplete':'completed',mode==='malformed'?'{}':JSON.stringify(lab));
  else if(entry.schema==='pocket_chart_preflight')data=response(mode==='incomplete'?'incomplete':'completed',mode==='malformed'?'{}':JSON.stringify(preflight));
  else return send(500,{error:{message:'Unexpected schema'}});
  entry.completed=true;return send(200,data);
 }
 return send(500,{error:'Unexpected local endpoint'});
});await new Promise(r=>server.listen(43211,'127.0.0.1',r));
const log=await open(out+'/SERVER.txt','w');
const child=spawn(process.execPath,['node_modules/next/dist/bin/next','start','-H','127.0.0.1','-p','43212'],{cwd:root,env:{PATH:process.env.PATH,NODE_OPTIONS:'--require='+out+'/runtime-network.cjs',NEXT_TELEMETRY_DISABLED:'1',NEXT_PUBLIC_SUPABASE_URL:upstream,NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_offline_fixture',SUPABASE_SERVICE_ROLE_KEY:'sb_secret_offline_fixture',OPENAI_API_KEY:'offline-fixture-not-a-credential',OPENAI_BASE_URL:upstream+'/v1',POCKET_FIRST_FREE_ENABLED:'false',POCKET_BENCHMARK_PILOT_ENABLED:'false',POCKET_REAL_BENCHMARK_DISPATCH:'false'},stdio:['ignore',log.fd,log.fd]});
const delay=ms=>new Promise(r=>setTimeout(r,ms));
try {
 for(let i=0;i<100;i++){try{if((await fetch(origin+'/api/pocket/subscription-access')).status===401)break;}catch{}await delay(100);if(i===99)throw Error('server did not start');}
 async function req(path,kind,body={image},extra={}){const before=calls.length;const r=await fetch(origin+'/api/pocket/'+path,{method:path==='subscription-access'?'GET':'POST',headers:{...(kind?{cookie:kind==='bad'?'sb-127-auth-token=broken':cookie(kind)}:{}),'content-type':'application/json','x-forwarded-for':'192.0.2.'+(++serial),...extra},...(path==='subscription-access'?{}:{body:typeof body==='string'?body:JSON.stringify(body)})});const data=await r.json();return {status:r.status,data,calls:calls.slice(before),headers:Object.fromEntries(r.headers)};}
 for(const path of ['subscription-access','analyse','levels','preflight'])for(const [kind,want] of [[null,401],['bad',401],['unpaid',403],['expired',401],['revoked',401],['unconfirmed',401],['anonymous',401],['rpc-error',503],['rpc-malformed',503],['same-email-new-id',403]]){
  const r=await req(path,kind);assert.equal(r.status,want,`${path}/${kind} ${JSON.stringify(r.data)}`);assert.equal(r.calls.filter(x=>x.path==='/v1/responses').length,0);tests.push({name:`${path}/${kind??'no-cookie'}`,status:'PASS',http:r.status});
 }
 for(const [name,path,kind,body,headers,want] of [['paid-access','subscription-access','paid',{}, {},200],['forged-client-access','analyse','unpaid',{image,userId:ids.paid,entitled:true},{},403],['forged-apple-proof','analyse','unpaid',{image},{'x-pocket-apple-transaction':'forged-proof'},503],['unauth-malformed-body','analyse',null,'{',{},401],['paid-malformed-upload','analyse','paid','{',{},400]]){const r=await req(path,kind,body,headers);assert.equal(r.status,want,name);assert.equal(r.calls.filter(x=>x.path==='/v1/responses').length,0);tests.push({name,status:'PASS',http:r.status});}
 for(const path of ['analyse','levels','preflight']){
  mode='normal';const r=await req(path,'paid');assert.equal(r.status,200,`${path} ${JSON.stringify(r.data)}`);assert(r.calls.some(x=>x.path==='/v1/responses'));if(path==='analyse'){assert.equal(r.data.analysis.levels[0]?.provenance,'UNVERIFIED');await writeFile(out+'/HTTP-RETAINED-REPORT.json',JSON.stringify(r.data.analysis));}tests.push({name:`${path}/valid`,status:'PASS',http:r.status});
  for(const m of ['malformed','incomplete']){mode=m;const x=await req(path,'paid');tests.push({name:`${path}/${m}`,status:x.status>=400?'PASS':'FAIL',http:x.status,unexpectedBody:x.status<400?x.data:undefined});}
 }
 for(const path of ['levels','preflight','analyse']) {
 mode='pending';held=[];const controller=new AbortController();const before=calls.length;
 const pending=fetch(origin+'/api/pocket/'+path,{method:'POST',headers:{cookie:cookie('paid'),'content-type':'application/json','x-forwarded-for':'192.0.2.'+(++serial)},body:JSON.stringify({image}),signal:controller.signal}).catch(e=>({name:e.name}));
 const expected=path==='analyse'?2:1;
 for(let i=0;i<200&&held.length<expected;i++)await delay(25);assert.equal(held.length,expected);controller.abort();const aborted=await pending;
 for(let i=0;i<200&&!held.every(h=>h.entry.closed);i++)await delay(10);
 const closed=held.every(h=>h.entry.closed);const count=calls.slice(before).filter(x=>x.path==='/v1/responses').length;
 for(const h of held){if(!h.res.destroyed)h.res.end(JSON.stringify(response('completed',JSON.stringify(lab))));}
 assert.equal(aborted.name,'AbortError');assert.equal(closed,true,path+' upstream still connected');assert.equal(count,expected);
 tests.push({name:path+'/client-cancellation',status:'PASS',upstreamSocketsClosed:closed,localProviderRequests:count,noRetryOrRescue:true});
 }
 mode='normal';
 if(process.env.RUN_BROWSER==='1'){
 const pins=JSON.parse(await readFile('../accuracy-offline-evidence/INPUTS.json','utf8'));
 const fixtures=JSON.parse(await readFile('../claims-evidence/fixtures.json','utf8'));
 const setCase=async(i)=>{const f=fixtures[i];for(const slot of ['main','primary_precision','rescue_precision']){const pin=pins.find(p=>p.case===(i===1?'v2-d002':'original-'+f.case)&&p.slot===slot);retained[slot]=pin?JSON.parse(await readFile(pin.path,'utf8')):response('incomplete','');}precisionOrdinal=0;Object.assign(preflight,f.confirmation,{sameInstrument:null});};
 await (await import('./browser-http.mjs')).run({origin,cookie,fixtures,setCase,out,resetMode:()=>{mode='normal';}});
 }
 assert(calls.filter(x=>x.path.includes('/rpc/')).every(x=>Object.values(ids).includes(x.userId)));
 await writeFile(out+'/HTTP.json',JSON.stringify({baseSource:'60f096f0f1451316426d26a264468b5a4505b822',patchScope:'strict preflight and abort propagation',tests,calls,passed:tests.filter(x=>x.status==='PASS').length,failed:tests.filter(x=>x.status==='FAIL').length,scope:'Actual compiled Next HTTP/middleware/cookie/SDK boundaries; isolated local identity/entitlement/provider upstream fixtures, not hosted GoTrue/RLS or live subscription evidence',paidCalls:0,liveWrites:0},null,2)+'\n');
 console.log(JSON.stringify({passed:tests.filter(x=>x.status==='PASS').length,failed:tests.filter(x=>x.status==='FAIL')}));
}finally{child.kill('SIGTERM');await new Promise(r=>child.once('exit',r));await log.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
