import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {stripTypeScriptTypes} from 'node:module';
import {nativeSubscriptionView} from '../app/pocket/native-subscription-view.ts';
const source=await readFile(new URL('../app/pocket/NativeSubscriptionControls.tsx',import.meta.url),'utf8');
const code=stripTypeScriptTypes(source.slice(source.indexOf('  async function run('),source.indexOf('  const retry =')));
function fixture(){
 let resolve!:(v:unknown)=>void;const pending=new Promise(r=>resolve=r);
 const mounted={current:true},revision={current:0};const state={phase:'ERROR',status:null as unknown,busy:false,attempt:0,message:''};
 const bindings={mounted,revision,actionRunning:{current:false},view:{showPurchase:false},setBusy:(v:boolean)=>state.busy=v,setMessage:(v:string)=>state.message=v,setStatus:(v:unknown)=>state.status=v,setPhase:(v:string)=>state.phase=v,setAttempt:(fn:(v:number)=>number)=>state.attempt=fn(state.attempt),restoreAppleSubscription:()=>pending,purchaseAppleSubscription:()=>{throw Error('must not repurchase');},POCKET_PRODUCT:{shortName:'NTP'}};
 const run=new Function(...Object.keys(bindings),code+';return run;')(...Object.values(bindings));
 return {run,resolve,mounted,revision,state};
}
test('password-sheet lifecycle during restore schedules fresh verification instead of silently dropping success',async()=>{const f=fixture();const pending=f.run('restore');f.revision.current++;f.resolve({entitled:true});await pending;assert.equal(f.state.attempt,1);assert.equal(f.state.phase,'CHECKING');assert.equal(f.state.status,null);assert.equal(f.state.busy,false);});
test('unmounted restore cannot refresh or grant access',async()=>{const f=fixture();const pending=f.run('restore');f.mounted.current=false;f.resolve({entitled:true});await pending;assert.equal(f.state.attempt,0);assert.equal(f.state.status,null);});
test('uninterrupted verified restore renders success',async()=>{const f=fixture();const pending=f.run('restore');f.resolve({entitled:true});await pending;assert.equal(f.state.phase,'READY');assert.deepEqual(f.state.status,{entitled:true});assert.equal(f.state.attempt,0);});
test('web subscriber is labelled correctly with no Apple purchase or misleading Apple price',()=>{const v=nativeSubscriptionView({isNative:true,entitled:true,accessSource:'web',freeUseConsumed:true,productId:'fixture',displayName:'Apple Monthly',displayPrice:'£4.99',productAvailable:true},'READY');assert.equal(v.heading,'EXISTING SUBSCRIPTION VERIFIED');assert.equal(v.showPurchase,false);assert.equal(v.productLabel,null);});
test('unlinked existing Apple proof never offers repurchase',()=>{const v=nativeSubscriptionView({isNative:true,entitled:false,signedTransactionInfo:'existing-proof',freeUseConsumed:true,productId:'fixture',displayName:'Apple Monthly',displayPrice:'£4.99',productAvailable:true},'READY');assert.equal(v.showPurchase,false);});
const bridge=await readFile(new URL('../app/pocket/apple-storekit.ts',import.meta.url),'utf8');
const purchaseCode=stripTypeScriptTypes(bridge.slice(bridge.indexOf('export async function purchaseAppleSubscription'),bridge.indexOf('export async function restoreAppleSubscription')).replace(/^export /,''));
for(const entitled of [true,false])test('direct purchase cannot charge an existing Apple subscriber '+entitled,async()=>{
 let calls=0;const buy=new Function('isAppleNativeApp','nativeMetadata','native','APPLE_MONTHLY_PRODUCT_ID','account','verifyStatus',purchaseCode+';return purchaseAppleSubscription;')(()=>true,(p:unknown)=>p,{getStatus:async()=>({signedTransactionInfo:'existing-proof'}),purchase:async()=>{calls++;}},'fixture',async(proof:string)=>{assert.equal(proof,'existing-proof');return{appAccountToken:'fixture',entitled};},(s:unknown)=>s);
 await assert.rejects(buy(),/existing|active/);assert.equal(calls,0);
});
test('new subscriber purchase retains verified account token binding',async()=>{
 let calls=0;const buy=new Function('isAppleNativeApp','nativeMetadata','native','APPLE_MONTHLY_PRODUCT_ID','account','verifyStatus',purchaseCode+';return purchaseAppleSubscription;')(()=>true,(p:unknown)=>p,{getStatus:async()=>({}),purchase:async(options:unknown)=>{calls++;assert.deepEqual(options,{productId:'fixture',appAccountToken:'verified-user'});return{entitled:true};}},'fixture',async()=>({appAccountToken:'verified-user',entitled:false}),(s:unknown)=>s);
 assert.deepEqual(await buy(),{entitled:true});assert.equal(calls,1);
});
