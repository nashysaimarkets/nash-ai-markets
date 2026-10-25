import test from 'node:test';
import assert from 'node:assert/strict';
import {checkNativeReadiness} from '../app/lib/server/pocket-native-readiness.ts';
import {verifyPocketAppleAccess} from '../app/lib/server/pocket-apple-access.ts';
const user='7a9d6268-93d5-43ec-bd05-15f074e35bcc';
const config={appleConfiguration:async()=>{},webLedger:async()=>false,legacyOwnership:async()=>false,ownedTransactions:async()=>[]};
test('readiness proves false/empty read-only probes, never owner acceptance',async()=>{
 assert.deepEqual(await checkNativeReadiness(config),{ready:true,checks:{appleConfiguration:true,webLedger:true,legacyOwnership:true,ownedTransactions:true},deviceAcceptance:false,appleApiAcceptance:false,ownerRestoreAcceptance:false});
});
for(const key of Object.keys(config))test(`readiness fails closed and sanitizes ${key}`,async()=>{
 const result=await checkNativeReadiness({...config,[key]:async()=>{throw Error('PRIVATE KEY AND CUSTOMER DATA');}});
 assert.equal(result.ready,false);assert.equal(result.checks[key as keyof typeof result.checks],false);assert.ok(!JSON.stringify(result).includes('PRIVATE'));
});
for(const value of [true,null,{},'false',0])test(`web probe rejects unexpected result ${JSON.stringify(value)}`,async()=>{
 assert.equal((await checkNativeReadiness({...config,webLedger:async()=>value as boolean})).ready,false);
});
for(const value of [false,null,{},['123']])test(`ownership probe rejects unexpected result ${JSON.stringify(value)}`,async()=>{
 assert.equal((await checkNativeReadiness({...config,ownedTransactions:async()=>value})).ready,false);
});
test('noncooperative dependency is bounded and sibling transport aborted',async()=>{
 let signal:AbortSignal|undefined;
 const result=await checkNativeReadiness({...config,appleConfiguration:()=>new Promise(()=>{}),webLedger:async s=>{signal=s;return false;}},10);
 assert.equal(result.ready,false);assert.equal(signal?.aborted,true);
});
const tx={bundleId:'com.nashaimarkets.pocketbullseye',productId:'com.nashaimarkets.pocketbullseye.monthly',environment:'Production',originalTransactionId:'10001',transactionId:'10002',type:'Auto-Renewable Subscription',expiresDate:2000};
const deps={environment:'Production',now:()=>1000,verifyTransaction:async()=>tx,verifyRenewal:async()=>({}),getOwnedTransactionIds:async()=>['10001'],isLegacyOwner:async()=>true,getStatuses:async()=>({bundleId:tx.bundleId,environment:tx.environment,data:[{lastTransactions:[{originalTransactionId:'10001',status:1,signedTransactionInfo:'signed-current'}]}]})};
test('existing production owner with no TestFlight proof recovers via fresh signed Apple status, without purchase/write',async()=>{
 const calls:string[]=[];
 assert.equal(await verifyPocketAppleAccess(user,'',{...deps,getOwnedTransactionIds:async id=>{assert.equal(id,user);calls.push('owner');return ['10001'];},getStatuses:async id=>{assert.equal(id,'10001');calls.push('apple');return deps.getStatuses();},verifyTransaction:async proof=>{assert.equal(proof,'signed-current');calls.push('signature');return tx;}}),true);
 assert.deepEqual(calls,['owner','apple','signature']);
});
test('no ownership record does not make Apple calls or grant access',async()=>{
 assert.equal(await verifyPocketAppleAccess(user,'',{...deps,getOwnedTransactionIds:async()=>[],getStatuses:async()=>{throw Error('must not call');}}),false);
});
test('revoked or different owner cannot refresh a saved ID',async()=>{
 assert.equal(await verifyPocketAppleAccess(user,'',{...deps,isLegacyOwner:async()=>false,getStatuses:async()=>{throw Error('must not call');}}),false);
});
for(const rows of [['10001','10001'],['bad'],['1','2','3','4','5','6'],[null]])test(`invalid mapping rejects before Apple ${JSON.stringify(rows)}`,async()=>{
 await assert.rejects(()=>verifyPocketAppleAccess(user,'',{...deps,getOwnedTransactionIds:async()=>rows as string[],getStatuses:async()=>{throw Error('must not call');}}),/ownership/);
});
for(const change of [{environment:'Sandbox'},{appAccountToken:'another-user'},{revocationDate:900},{expiresDate:999},{productId:'other'},{bundleId:'other'},{originalTransactionId:'different'}])test(`owner mapping never overrides signed claims ${JSON.stringify(change)}`,async()=>{
 assert.equal(await verifyPocketAppleAccess(user,'',{...deps,verifyTransaction:async()=>({...tx,...change})}),false);
});
for(const status of [2,3,5,0])test(`expired/retry/revoked status ${status} cannot recover`,async()=>{
 assert.equal(await verifyPocketAppleAccess(user,'',{...deps,getStatuses:async()=>({bundleId:tx.bundleId,environment:'Production',data:[{lastTransactions:[{originalTransactionId:'10001',status,signedTransactionInfo:'proof'}]}]})}),false);
});
test('invalid supplied proof is never replaced by server-owned fallback',async()=>{
 await assert.rejects(()=>verifyPocketAppleAccess(user,'invalid',{...deps,verifyTransaction:async()=>{throw Error('signature failed');},getOwnedTransactionIds:async()=>{throw Error('must not fallback');}}),/signature failed/);
});
test('ownership/API outages and invalid fresh signatures remain errors',async()=>{
 for(const key of ['getOwnedTransactionIds','getStatuses','verifyTransaction'])await assert.rejects(()=>verifyPocketAppleAccess(user,'',{...deps,[key]:async()=>{throw Error('unavailable');}}),/unavailable/);
});
test('readiness bypasses session middleware only on the exact diagnostic route',async()=>{
 const {readFile}=await import('node:fs/promises'); const {stripTypeScriptTypes}=await import('node:module');
 const source=await readFile(new URL('../middleware.ts',import.meta.url),'utf8');
 const fn=stripTypeScriptTypes(source.slice(source.indexOf('export async function middleware'),source.indexOf('\nexport const config')).replace('export ',''));
 let reads=0; const run=new Function('NextResponse','resolveSupabasePublicConfig',fn+';return middleware;')({next:()=>({})},()=>{reads++;return {url:'',key:''};});
 await run({nextUrl:{pathname:'/api/pocket/native-readiness'}});assert.equal(reads,0);
 await run({nextUrl:{pathname:'/api/pocket/native-readiness/other'},headers:{}});assert.equal(reads,1);
});
