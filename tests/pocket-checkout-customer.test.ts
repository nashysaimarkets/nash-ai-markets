import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { createPocketCheckoutStripeDriver, ensurePocketCheckoutIntent } from '../app/lib/server/pocket-checkout-intent.ts';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import { validFoundingProPrice, validPocketFoundingPrice } from '../app/lib/stripe-commercial.ts';

type PriceFixture={active:boolean;currency:string;type:string;unit_amount:number|null;recurring:{interval:string;interval_count?:number}|null};
async function runCheckout(data:unknown,error:unknown=null,plan='pocket',verified=true,active:unknown=false,activeError:unknown=null,requestOptions:{origin?:string;cancel?:'before'|'after-access';invalidForm?:boolean;price?:PriceFixture;intent?:'ready'|'baseline'|'missing'|'lost-claim';config?:'missing'|'candidate'|'account'|'mode';swapUser?:boolean;providerAccount?:string;repeat?:boolean}={}) {
 const source=await readFile(process.env.POCKET_QA_CHECKOUT_ROUTE_FILE??new URL('../app/api/stripe/checkout/route.ts',import.meta.url),'utf8');
 const body=source.slice(source.indexOf('function requestOrigin(')).replace('export async function POST','async function POST');
 const sessions:Record<string,unknown>[]=[];const lookups:unknown[]=[];
 const user=verified?{id:'11111111-1111-4111-8111-111111111111',email:'member@example.invalid',email_confirmed_at:'2026-10-18',is_anonymous:false}:null;
 const controller=new AbortController();let reads=0,state='PREPARED';let packet:Record<string,unknown>|undefined;
 const candidate='a'.repeat(40),intentId='22222222-2222-4222-8222-222222222222';
 const configuredPrice={id:'price_qa',livemode:false,active:true,currency:'gbp',type:'recurring',unit_amount:plan==='pocket'?499:1200,recurring:{interval:'month',interval_count:1},...requestOptions.price};
 const rpc=async(name:string,args:Record<string,unknown>)=>{
  lookups.push({name,args});
  if(name==='get_pocket_web_customer')return {data,error};
  if(name==='has_pocket_web_subscription'){if(requestOptions.cancel==='after-access')controller.abort();return {data:active,error:activeError};}
  if(requestOptions.intent==='missing')return {data:null,error:{code:'42883'}};
  if(name==='prepare_pocket_checkout_intent'){
   if(requestOptions.intent!=='ready'&&requestOptions.intent!=='lost-claim')return {data:{kind:'HOLD',reason:'BASELINE_REQUIRED',intent_id:intentId},error:null};
   if(!packet){
    const seed=structuredClone(args.p_seed) as Record<string,unknown>;
    const metadata={...seed.metadata as Record<string,unknown>,pocket_checkout_intent_id:intentId,pocket_candidate_sha:candidate};
    const params={...seed,expires_at:Math.floor(Date.now()/1000)+2700,metadata,subscription_data:{metadata}};
    const text=JSON.stringify(params,null,1);
    packet={intent_id:intentId,user_id:user!.id,customer_id:data,price_id:'price_qa',candidate_sha:candidate,stripe_account_id:'acct_QA',livemode:false,offer:'pocket_founding_650',idempotency_key:'pocket-checkout:'+intentId,parameters_text:text,parameters_sha256:createHash('sha256').update(text).digest('hex')};
   }
   return {data:state==='DISPATCHED'?{kind:'HOLD',reason:'DISPATCH_UNRESOLVED'}:{...packet,kind:state},error:null};
  }
  if(name==='claim_pocket_checkout_intent'){
   if(state!=='PREPARED')return {data:{kind:'HOLD',reason:'DISPATCH_UNRESOLVED'},error:null};
   state='DISPATCHED';if(requestOptions.intent==='lost-claim')return {data:null,error:{code:'response_lost'}};
   return {data:{...packet,kind:'DISPATCH',dispatch_token:'33333333-3333-4333-8333-333333333333',dispatch_count:1},error:null};
  }
  if(name==='record_pocket_checkout_session'){state='READY';packet={...packet,session:args.p_session};return {data:{...packet,kind:state},error:null};}
  throw Error('unexpected RPC');
 };
 const bindings={
  Stripe:class {accounts={retrieve:async()=>({id:requestOptions.providerAccount??'acct_QA'})};prices={retrieve:async()=>configuredPrice};checkout={sessions:{create:async(args:Record<string,unknown>)=>{sessions.push(args);return {id:'cs_test_QA',mode:'subscription',status:'open',customer:args.customer,client_reference_id:args.client_reference_id,metadata:args.metadata,expires_at:args.expires_at,livemode:false,url:'https://checkout.stripe.com/c/pay/cs_test_QA'};}}};},
  createClient:async()=>({auth:{getUser:async()=>({data:{user:requestOptions.swapUser&&++reads>1?{...user,id:'44444444-4444-4444-8444-444444444444'}:user},error:null})}}),
  createAdminClient:()=>({rpc}),
  createPocketCheckoutStripeDriver,ensurePocketCheckoutIntent,
  checkoutOffering:()=>({priceId:'price_qa',offering:{plan,foundingEligible:Boolean(requestOptions.price)}}),
  validFoundingProPrice,validPocketFoundingPrice,
  campaignAttribution:()=>({source:'direct',medium:'none',campaign:'none'}),campaignQuery:()=>'',
  NextResponse:{json:Response.json,redirect:(url:URL|string,status:number)=>new Response(null,{status,headers:{location:String(url)}})},
  console:{error:()=>{}},
 };
 const handler=new Function(...Object.keys(bindings),stripTypeScriptTypes(body)+';return POST;')(...Object.values(bindings));
 const env={STRIPE_SECRET_KEY:'unit-test-only-not-a-key',GIT_COMMIT_SHA:candidate,VERCEL_GIT_COMMIT_SHA:undefined as string|undefined,POCKET_CHECKOUT_STRIPE_ACCOUNT_ID:'acct_QA',POCKET_CHECKOUT_STRIPE_MODE:'test'};
 if(requestOptions.config==='missing')env.POCKET_CHECKOUT_STRIPE_ACCOUNT_ID='';
 if(requestOptions.config==='candidate')env.GIT_COMMIT_SHA='unknown';
 if(requestOptions.config==='account')env.POCKET_CHECKOUT_STRIPE_ACCOUNT_ID='acct_OTHER';
 if(requestOptions.config==='mode')env.POCKET_CHECKOUT_STRIPE_MODE='other';
 const prior=Object.fromEntries(Object.keys(env).map(k=>[k,process.env[k]]));
 for(const [k,v] of Object.entries(env)){if(v===undefined)delete process.env[k];else process.env[k]=v;}
 try{
  const origin=requestOptions.origin??'https://preview.invalid';
  const request=new Request(origin+'/api/stripe/checkout',{method:'POST',headers:{origin,'content-type':requestOptions.invalidForm?'application/json':'application/x-www-form-urlencoded'},body:'offering=pocket_founding_month&customer=cus_attacker&app_user_id=attacker',signal:controller.signal});
  if(requestOptions.cancel==='before')controller.abort();
  const again=requestOptions.repeat?request.clone():null;
  const response=await handler(request);if(again)await handler(again);
  return {response,sessions,lookups,user};
 }finally{for(const [k,v] of Object.entries(prior)){if(v===undefined)delete process.env[k];else process.env[k]=v;}}
}

test('proposed Pocket checkout dispatches only a claimed authenticated UUID-bound intent',async()=>{
 const r=await runCheckout('cus_bound',null,'pocket',true,false,null,{intent:'ready',repeat:true});
 assert.equal(r.sessions.length,1);
 assert.equal(r.sessions[0]!.customer,'cus_bound');
 assert.equal(r.sessions[0]!.customer_email,undefined);
 assert.deepEqual(r.lookups.slice(0,2),[{name:'get_pocket_web_customer',args:{p_user_id:r.user!.id,p_email:r.user!.email}},{name:'has_pocket_web_subscription',args:{p_user_id:r.user!.id}}]);
 assert.equal(r.lookups.filter(x=>(x as {name:string}).name==='claim_pocket_checkout_intent').length,1);
 assert.equal(r.response.headers.get('location'),'https://checkout.stripe.com/c/pay/cs_test_QA');
 assert.equal(r.sessions[0]!.client_reference_id,r.user!.id);
});

test('unbound new Pocket customer stays on HOLD without email-based provisioning',async()=>{
 const r=await runCheckout(null);assert.equal(r.lookups.length,2);assert.equal(r.sessions.length,0);
 assert.match(r.response.headers.get('location')??'',/checkout=unavailable/);
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
  const r=await runCheckout('cus_bound',null,'pro',true,false,null,{origin});
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

test('new founding checkout requires exactly one month per billing cycle',async()=>{
 for(const plan of ['pocket','pro'])for(const intervalCount of [undefined,0,-1,1.5,3,1]){
  const price:PriceFixture={active:true,currency:'gbp',type:'recurring',unit_amount:plan==='pocket'?499:1200,recurring:{interval:'month',...(intervalCount===undefined?{}:{interval_count:intervalCount})}};
  const r=await runCheckout('cus_bound',null,plan,true,false,null,{price,intent:'ready'});
  assert.equal(r.sessions.length,intervalCount===1?1:0,`${plan}: billing interval_count=${intervalCount}`);
  if(intervalCount!==1){assert.equal(r.lookups.length,0);assert.match(r.response.headers.get('location')??'',/checkout=unavailable/);}
 }
});


test('missing RPC or legacy provider baseline cannot fall back to direct Pocket create',async()=>{
 for(const intent of ['missing','baseline'] as const){const r=await runCheckout('cus_bound',null,'pocket',true,false,null,{intent});assert.equal(r.sessions.length,0);assert.match(r.response.headers.get('location')??'',/checkout=unavailable/);}
});
test('missing or mismatched candidate/account/mode remains HOLD before claim',async()=>{
 for(const config of ['missing','candidate','account','mode'] as const){const r=await runCheckout('cus_bound',null,'pocket',true,false,null,{intent:'ready',config});assert.equal(r.sessions.length,0);assert.equal(r.lookups.some(x=>(x as {name:string}).name==='claim_pocket_checkout_intent'),false);}
 const provider=await runCheckout('cus_bound',null,'pocket',true,false,null,{intent:'ready',providerAccount:'acct_OTHER'});assert.equal(provider.sessions.length,0);
});
test('server getUser identity is reverified and cannot switch UUID before dispatch',async()=>{
 const r=await runCheckout('cus_bound',null,'pocket',true,false,null,{intent:'ready',swapUser:true});assert.equal(r.sessions.length,0);assert.equal(r.lookups.some(x=>(x as {name:string}).name==='claim_pocket_checkout_intent'),false);
});
test('lost atomic claim response remains HOLD across repeated actual route requests',async()=>{
 const r=await runCheckout('cus_bound',null,'pocket',true,false,null,{intent:'lost-claim',repeat:true});assert.equal(r.sessions.length,0);assert.equal(r.lookups.filter(x=>(x as {name:string}).name==='claim_pocket_checkout_intent').length,1);
});
