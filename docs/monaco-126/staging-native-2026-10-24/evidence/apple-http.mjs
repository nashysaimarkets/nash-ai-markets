import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {readFile,writeFile,open} from 'node:fs/promises';
import assert from 'node:assert/strict';
const root='/workspace/scratch/35c5363ca2aa/staging-native-app',out='/workspace/scratch/35c5363ca2aa/staging-native-evidence';
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
 for(let i=0;i<100;i++){try{if((await fetch(origin+'/api/pocket/subscription-access')).status===401)break;}catch{}await delay(100);}
 const results=[];
 for(const [kind,want] of [[null,401],['anonymous',401],['unconfirmed',401],['expired',401],['revoked',401],['paid',503]]){
 const before=calls.length;const r=await fetch(origin+'/api/pocket/apple-account',{headers:kind?{cookie:cookie(kind)}:{}});const body=await r.json();assert.equal(r.status,want,kind);assert.equal(body.appAccountToken,undefined);assert.equal(r.headers.get('cache-control'),'private, no-store');assert.equal(calls.slice(before).filter(x=>x.path==='/v1/responses').length,0);results.push({kind:kind??'no-cookie',http:r.status,result:'PASS'});
 }
 await writeFile(out+'/APPLE-HTTP.json',JSON.stringify({results,scope:'Actual built Next route and cookie/getUser HTTP; synthetic identity upstream; no Apple credentials or signed purchase. Valid account503 proves missing verifier setup blocks purchase readiness.'},null,2)+'\n');console.log('Apple HTTP6/6PASS');
}finally{child.kill('SIGTERM');await new Promise(r=>child.once('exit',r));await log.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
