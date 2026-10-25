import test from 'node:test';import assert from 'node:assert/strict';
import {verifyPocketNativeManifest as verify} from '../scripts/pocket-native-manifest.mjs';
const revision='a'.repeat(40),url='https://immutable.invalid/pocket';
const checks={appleConfiguration:true,webLedger:true,legacyOwnership:true,ownedTransactions:true};
const payload={revision,ready:true,checks,deviceAcceptance:false};
test('release gate checks actual readiness path and exact source',async()=>{
 await verify(url,revision,{requireReadiness:true,transport:async(target,init)=>{assert.equal(target.pathname,'/api/pocket/native-readiness');assert.equal(init.redirect,'error');return Response.json(payload);}});
});
for(const body of [{revision},{...payload,ready:false},{...payload,revision:'b'.repeat(40)},{...payload,deviceAcceptance:true},...Object.keys(checks).map(key=>({...payload,checks:{...checks,[key]:false}}))])test('incomplete/inaccurate readiness cannot admit signing '+JSON.stringify(body),async()=>{
 await assert.rejects(()=>verify(url,revision,{requireReadiness:true,transport:async()=>Response.json(body)}));
});
test('owner-failed backend503 is a hard signing gate',async()=>{await assert.rejects(()=>verify(url,revision,{requireReadiness:true,transport:async()=>Response.json({code:'POCKET_APPLE_CONFIGURATION'},{status:503})}),/HTTP_ERROR/);});
