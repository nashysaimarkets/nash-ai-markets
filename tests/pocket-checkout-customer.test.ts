import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';

async function runCheckout(data:unknown,error:unknown=null,plan='pocket',verified=true,active:unknown=false,activeError:unknown=null,requestOptions:{origin?:string;cancel?:'before'|'after-access';invalidForm?:boolean}={}) {
 const source=await readFile(new URL('../app/api/stripe/checkout/route.ts',import.meta.url),'utf8');
 const body=source.slice(source.indexOf('function requestOrigin(')).replace('export async function POST','async function POST');
 const sessions:Record<string,unknown>[]=[];const lookups:unknown[]=[];
 const user=verified?{id:'11111111-1111-4111-8111-111111111111',email:'member@example.invalid',email_confirmed_at:'2026-10-18',is_anonymous:false}:null;
 const controller=new AbortController();
 const bindings={
  Stripe:class {checkout={sessions:{create:async(args:Record<string,unknown>)=>{sessions.push(args);return {url:'https://checkout.stripe.invalid/test'};}}};},
  createClient:async()=>({auth:{getUser:async()=>({data:{user}})}}),
  createAdminClient:()=>({rpc:async(name:string,args:unknown)=>{lookups.push({name,args});if(name==='has_pocket_web_subscription'&&requestOptions.cancel==='after-access')controller.abort();return name==='has_pocket_web_subscription'?{data:active,error:activeError}:{data,error};}}),
  checkoutOffering:()=>({priceId:'price_qa',offering:{plan,foundingEligible:false}}),
  campaignAttribution:()=>({source:'direct',medium:'none',campaign:'none'}),campaignQuery:()=>'',
  NextResponse:{json:Response.json,redirect:(url:URL|string,status:number)=>new Response(null,{status,headers:{location:String(url)}})},
  console:{error:()=>{}},
 };
 const handler=new Function(...Object.keys(bindings),stripTypeScriptTypes(body)+';return POST;')(...Object.values(bindings));
 const prior=process.env.STRIPE_SECRET_KEY;process.env.STRIPE_SECRET_KEY='unit-test-only-not-a-key';
 try{
  const origin=requestOptions.origin??'https://preview.invalid';
  const request=new Request(origin+'/api/stripe/checkout',{method:'POST',headers:{origin,'content-type':requestOptions.invalidForm?'application/json':'application/x-www-form-urlencoded'},body:'offering=pocket_founding_month&customer=cus_attacker&app_user_id=attacker',signal:controller.signal});
  if(requestOptions.cancel==='before')controller.abort();
  const response=await handler(request);
  return {response,sessions,lookups,user};
 }finally{if(prior===undefined)delete process.env.STRIPE_SECRET_KEY;else process.env.STRIPE_SECRET_KEY=prior;}
}

test('repeat Pocket checkout reuses only the authenticated UUID-bound Stripe customer',async()=>{
 const r=await runCheckout('cus_bound');
 assert.equal(r.sessions.length,1);
 assert.equal(r.sessions[0]!.customer,'cus_bound');
 assert.equal(r.sessions[0]!.customer_email,undefined);
 assert.deepEqual(r.lookups,[{name:'get_pocket_web_customer',args:{p_user_id:r.user!.id,p_email:r.user!.email}},{name:'has_pocket_web_subscription',args:{p_user_id:r.user!.id}}]);
 assert.equal(r.sessions[0]!.client_reference_id,r.user!.id);
});

test('new Pocket customer may use verified email only after authoritative no-binding result',async()=>{
 const r=await runCheckout(null);assert.equal(r.lookups.length,2);assert.equal(r.sessions.length,1);
 assert.equal(r.sessions[0]!.customer,undefined);assert.equal(r.sessions[0]!.customer_email,r.user!.email);
});

test('an already active Pocket member returns to the app without another subscription checkout',async()=>{
 const r=await runCheckout('cus_bound',null,'pocket',true,true);
 assert.equal(r.sessions.length,0);
 assert.equal(r.response.headers.get('location'),'https://preview.invalid/pocket?subscription=active');
});

test('unknown active-subscription state cannot create a second Pocket subscription',async()=>{
 for(const [active,error] of [[null,null],['true',null],[false,{code:'offline'}]]){
  const r=await runCheckout('cus_bound',null,'pocket',true,active,error);
  assert.equal(r.sessions.length,0);
  assert.match(r.response.headers.get('location')??'',/checkout=unavailable/);
 }
});

test('missing identity migration, database failure or malformed customer cannot open checkout',async()=>{
 for(const [data,error] of [[null,{code:'42883'}],[undefined,null],[{},null],['',null],['cus attacker',null]]){
  const r=await runCheckout(data,error);assert.equal(r.sessions.length,0);
  assert.match(r.response.headers.get('location')??'',/checkout=unavailable/);
 }
});

test('anonymous Pocket checkout is denied; anonymous legacy terminal checkout retains its scope',async()=>{
 const denied=await runCheckout(null,null,'pocket',false);assert.equal(denied.sessions.length,0);assert.equal(denied.lookups.length,0);
 const legacy=await runCheckout(null,null,'pro',false);assert.equal(legacy.sessions.length,1);assert.equal(legacy.lookups.length,0);
});

test('plaintext localhost lookalike hosts cannot create a checkout session',async()=>{
 for(const origin of ['http://localhost.attacker.invalid','http://localhost-evil.invalid','http://localhost.evil:4000']){
  const r=await runCheckout('cus_bound',null,'pocket',true,false,null,{origin});
  assert.equal(r.response.status,403);assert.equal(r.sessions.length,0);assert.equal(r.lookups.length,0);
 }
});

test('exact development loopback origins retain checkout behavior',async()=>{
 for(const origin of ['http://localhost:4173','http://127.0.0.1:4173','http://[::1]:4173']){
  const r=await runCheckout('cus_bound',null,'pocket',true,false,null,{origin});
  assert.equal(r.response.status,303);assert.equal(r.sessions.length,1);
 }
});

test('checkout cancellation before work or after account lookup never creates a session',async()=>{
 for(const cancel of ['before','after-access'] as const){
  const r=await runCheckout('cus_bound',null,'pocket',true,false,null,{cancel});
  assert.equal(r.response.status,409);assert.equal(r.sessions.length,0);
  if(cancel==='before')assert.equal(r.lookups.length,0);
 }
});

test('malformed checkout form returns an explicit error before customer or session work',async()=>{
 const r=await runCheckout('cus_bound',null,'pocket',true,false,null,{invalidForm:true});
 assert.equal(r.response.status,400);assert.equal(r.sessions.length,0);assert.equal(r.lookups.length,0);
});
