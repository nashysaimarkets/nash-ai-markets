import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
const root=process.argv[2]??process.cwd();
const src=readFileSync(root+'/app/pocket/apple-storekit.ts','utf8');const start=src.indexOf('async function verifyStatus(');const end=src.indexOf('export async function getAppleProductStatus',start);assert.ok(start>=0&&end>start);
const code=stripTypeScriptTypes(src.slice(start,end));
const product={isNative:true,entitled:true,freeUseConsumed:true,productId:'test-product',displayName:'Pocket',displayPrice:'£4.99',signedTransactionInfo:'test-only-proof'};
const make=({entitled=true,state={isActive:true},readState,account}={})=>{const calls=[];const app={getState:async()=>{calls.push('state');return readState?readState():state;}};const auth=async proof=>{calls.push('account');assert.equal(proof,product.signedTransactionInfo);return account?account():{entitled};};const verify=new Function('account','App',code+';return verifyStatus;')(auth,app);return{run:()=>verify(product),calls};};
let passed=0,failed=0;const cases=[];async function check(name,fn){try{await fn();passed++;cases.push({name,status:'PASS'});}catch(e){failed++;cases.push({name,status:'FAIL',error:e.message});}}
await check('active direct verification retains a current server-approved entitlement',async()=>{const h=make();const r=await h.run();assert.equal(r.entitled,true);assert.deepEqual(h.calls,['account','state']);});
await check('active local StoreKit entitlement cannot override server denial',async()=>{const h=make({entitled:false});assert.equal((await h.run()).entitled,false);});
await check('background direct Restore/access result is rejected',async()=>{await assert.rejects(make({state:{isActive:false}}).run());});
await check('unknown foreground observation is rejected',async()=>{for(const state of [{},null,{isActive:'true'}])await assert.rejects(make({state}).run());});
await check('failed foreground observation is rejected',async()=>{await assert.rejects(make({readState:async()=>{throw new Error('App state unavailable');}}).run());});
await check('background transition during server verification cannot become READY',async()=>{let release;let active=true;const pending=new Promise(r=>release=r);const h=make({readState:async()=>({isActive:active}),account:()=>pending});const call=h.run();active=false;release({entitled:true});await assert.rejects(call);assert.deepEqual(h.calls,['account','state']);});
await check('actual Restore delegates fresh signed evidence and rejects background completion',async()=>{
const begin=src.indexOf('export async function restoreAppleSubscription');const finish=src.indexOf('/** StoreKit events',begin);assert.ok(begin>=0&&finish>begin);const restoreCode=stripTypeScriptTypes(src.slice(begin,finish).replace(/^export /,''));let local=0,server=0;const restore=new Function('native','isAppleNativeApp','account','App','webStatus','APPLE_MONTHLY_PRODUCT_ID',code+';'+restoreCode+';return restoreAppleSubscription;')({restore:async p=>{local++;assert.equal(p.productId,'test-product');return product;}},()=>true,async proof=>{server++;assert.equal(proof,product.signedTransactionInfo);return{entitled:true};},{getState:async()=>({isActive:false})},{},'test-product');await assert.rejects(restore());assert.equal(local,1);assert.equal(server,1);
});
await check('actual foreground Restore retains server denial and makes no purchase call',async()=>{
const begin=src.indexOf('export async function restoreAppleSubscription');const finish=src.indexOf('/** StoreKit events',begin);const restoreCode=stripTypeScriptTypes(src.slice(begin,finish).replace(/^export /,''));const restore=new Function('native','isAppleNativeApp','account','App','webStatus','APPLE_MONTHLY_PRODUCT_ID',code+';'+restoreCode+';return restoreAppleSubscription;')({restore:async()=>product,purchase:()=>{throw new Error('purchase must not run');}},()=>true,async()=>({entitled:false}),{getState:async()=>({isActive:true})},{},'test-product');assert.equal((await restore()).entitled,false);
});
process.stdout.write(JSON.stringify({passed,failed,cases},null,2)+'\n');process.exitCode=failed?1:0;
