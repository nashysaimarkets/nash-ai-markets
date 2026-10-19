import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {stripTypeScriptTypes} from 'node:module';
const modulePath=process.env.POCKET_CHECKOUT_QA_PGLITE_MODULE;
assert.ok(modulePath,'Explicit isolated PGlite module required');
const {PGlite}=await import(modulePath);
const root=resolve(process.argv[2]||process.cwd());
const {createPocketCheckoutStripeDriver,ensurePocketCheckoutIntent}=await import(pathToFileURL(join(root,'app/lib/server/pocket-checkout-intent.ts')));
const {validFoundingProPrice,validPocketFoundingPrice}=await import(pathToFileURL(join(root,'app/lib/stripe-commercial.ts')));
const db=new PGlite();
const user={id:'55555555-5555-4555-8555-555555555555',email:'five@example.test',email_confirmed_at:new Date().toISOString(),is_anonymous:false};
const environment={STRIPE_SECRET_KEY:'independent-unit-only-not-a-key',VERCEL_GIT_COMMIT_SHA:'a'.repeat(40),GIT_COMMIT_SHA:'a'.repeat(40),POCKET_CHECKOUT_STRIPE_ACCOUNT_ID:'acct_QA',POCKET_CHECKOUT_STRIPE_MODE:'test'};
const previous=Object.fromEntries(Object.keys(environment).map(key=>[key,process.env[key]]));
let mode='baseline',controller,creates=0,claims=0,persists=0;
try{
 for(const [key,value]of Object.entries(environment))process.env[key]=value;
 for(const name of ['tests/sql/support/pocket-checkout-intent-bootstrap.sql','supabase/proposed/pocket-checkout-intent.sql'])await db.exec(await readFile(join(root,name),'utf8'));
 await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())',[user.id,user.email]);
 await db.query('insert into private.pocket_web_identities values($1,$2)',[user.id,'cus_QA5']);
 await db.exec('set role service_role');
 const sqlRpc=async(name,args)=>{
  // Existing account lookup is mocked; proposed SQL independently rechecks the
  // actual synthetic UUID/customer/email pair before prepare and claim.
  if(name==='get_pocket_web_customer')return{data:'cus_QA5',error:null};
  if(name==='has_pocket_web_subscription')return{data:(await db.query('select private.has_pocket_web_subscription($1) as v',[args.p_user_id])).rows[0].v,error:null};
  const orders={prepare_pocket_checkout_intent:['p_user_id','p_email','p_customer_id','p_price_id','p_candidate_sha','p_stripe_account_id','p_livemode','p_offer','p_seed'],claim_pocket_checkout_intent:['p_user_id','p_intent_id','p_parameters_sha256','p_customer_id','p_candidate_sha','p_stripe_account_id','p_livemode'],record_pocket_checkout_session:['p_user_id','p_intent_id','p_dispatch_token','p_parameters_sha256','p_session']};
  const order=orders[name];assert.ok(order,'only the three proposed RPCs may execute');
  const values=order.map(key=>typeof args[key]==='object'?JSON.stringify(args[key]):args[key]);
  const result=(await db.query(`select public.${name}(${order.map((_,i)=>'$'+(i+1)).join(',')}) as v`,values)).rows[0].v;
  if(name==='prepare_pocket_checkout_intent'&&mode==='cancel')controller.abort();
  if(name==='claim_pocket_checkout_intent')claims++;
  if(name==='record_pocket_checkout_session'){persists++;if(mode==='lost-record-ack')return{data:null,error:{message:'synthetic committed acknowledgement lost'}};}
  return{data:result,error:null};
 };
 const bindings={
  Stripe:class{accounts={retrieve:async()=>({id:'acct_QA'})};prices={retrieve:async()=>({id:'price_QA',livemode:false,active:true,currency:'gbp',type:'recurring',unit_amount:499,recurring:{interval:'month',interval_count:1}})};checkout={sessions:{create:async p=>{creates++;return{id:'cs_test_INDEPENDENT',mode:'subscription',status:'open',livemode:false,customer:p.customer,client_reference_id:p.client_reference_id,metadata:p.metadata,expires_at:p.expires_at,url:'https://checkout.stripe.com/c/pay/cs_test_INDEPENDENT'};}}};},
  createClient:async()=>({auth:{getUser:async()=>({data:{user},error:null})}}),createAdminClient:()=>({rpc:sqlRpc}),
  checkoutOffering:()=>({priceId:'price_QA',offering:{plan:'pocket',foundingEligible:true}}),validFoundingProPrice,validPocketFoundingPrice,
  campaignAttribution:()=>({source:'direct',medium:'none',campaign:'none'}),campaignQuery:()=>'',
  createPocketCheckoutStripeDriver,ensurePocketCheckoutIntent,
  NextResponse:{json:Response.json,redirect:(url,status)=>new Response(null,{status,headers:{location:String(url)}})},console:{error:()=>{}},
 };
 const source=await readFile(join(root,'app/api/stripe/checkout/route.ts'),'utf8');
 const code=source.slice(source.indexOf('function requestOrigin(')).replace('export async function POST','async function POST');
 const handler=new Function(...Object.keys(bindings),stripTypeScriptTypes(code)+';return POST;')(...Object.values(bindings));
 const run=async nextMode=>{mode=nextMode;controller=new AbortController();return handler(new Request('https://preview.invalid/api/stripe/checkout',{method:'POST',headers:{origin:'https://preview.invalid','content-type':'application/x-www-form-urlencoded'},body:'offering=pocket_founding_month&customer=cus_ATTACK&app_user_id=attacker',signal:controller.signal}));};
 assert.match((await run('baseline')).headers.get('location'),/checkout=unavailable/);assert.equal(creates,0);
 await db.exec('reset role');
 const intent=(await db.query('select intent_id from private.pocket_checkout_intents')).rows[0].intent_id;
 await db.exec('set role pocket_checkout_verifier');
 await db.query("select public.attest_pocket_checkout_baseline($1,$2,'cus_QA5','acct_QA',false,repeat('a',40),repeat('5',64),repeat('f',64),clock_timestamp()-interval '3 seconds',clock_timestamp()-interval '2 seconds',clock_timestamp()-interval '1 second',true,0,0)",[intent,user.id]);
 await db.exec('reset role');await db.exec('set role service_role');
 assert.match((await run('cancel')).headers.get('location'),/checkout=unavailable/);assert.equal(claims,0);assert.equal(creates,0);
 assert.match((await run('lost-record-ack')).headers.get('location'),/checkout=unavailable/);assert.equal(creates,1);assert.equal(persists,1);
 const recovered=await run('reuse');assert.equal(recovered.headers.get('location'),'https://checkout.stripe.com/c/pay/cs_test_INDEPENDENT');assert.equal(creates,1);assert.equal(claims,1);assert.equal(persists,1);
 console.log('PASS: actual route+helper+proposed SQL: default baseline HOLD, cancellation-before-claim, committed result/lost acknowledgement HOLD, persisted READY reuse; 1 total mocked create. No provider or PG multi-session evidence.');
}finally{
 for(const [key,value]of Object.entries(previous)){if(value===undefined)delete process.env[key];else process.env[key]=value;}
 await db.close();
}
