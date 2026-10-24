import assert from 'node:assert/strict';
import test from 'node:test';
import {createIgDemoWorkspace,parseIgDemoPanel} from '../app/lib/ig-demo-workspace.ts';
export const fixture=()=>({environment:'DEMO',status:'CONNECTED',connectionId:'test',generation:1,observedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+60_000).toISOString(),account:{accountId:'DEMO1',accountType:'CFD',currency:'GBP'},positions:[{dealId:'D1',epic:'IX.D.SPTRD.DAILY.IP',direction:'BUY',size:1,openLevel:5000,currency:'GBP',chartContext:'HOLD_CHART_IDENTITY'}],riskContext:'HOLD_MARKET_SPEC_UNVERIFIED'});
test('strict view rejects LIVE, tokens, malformed numbers, duplicates and expired data',()=>{
 assert.equal(parseIgDemoPanel(fixture()).account.accountId,'DEMO1');
 for(const patch of [{environment:'LIVE'},{cst:'SECRET'},{generation:0},{expiresAt:new Date(0).toISOString()},{account:{...fixture().account,password:'SECRET'}},{positions:[fixture().positions[0],fixture().positions[0]]},{positions:[{...fixture().positions[0],size:NaN}]},{positions:[{...fixture().positions[0],bid:5000}]}]) assert.throws(()=>parseIgDemoPanel({...fixture(),...patch}));
});
test('connect/refresh/disconnect use one state and remove account data',async()=>{
 const actions:string[]=[];const c=createIgDemoWorkspace(async a=>{actions.push(a);return a==='disconnect'?{status:'REVOKED',providerLogout:'CONFIRMED'}:fixture();},()=>{});
 await c.run('connect');assert.ok(c.state().snapshot);await c.run('refresh');await c.run('disconnect');assert.equal(c.state().snapshot,null);assert.deepEqual(actions,['connect','refresh','disconnect']);c.reset();
});
test('late response cannot resurrect chart-change, logout or cancellation state',async()=>{
 for(const action of ['reset','cancel'] as const){let resolve!:(v:unknown)=>void;const c=createIgDemoWorkspace(()=>new Promise(r=>resolve=r),()=>{});const p=c.run('connect');c[action]();resolve(fixture());await p;assert.equal(c.state().snapshot,null);assert.equal(c.state().busy,false);}
});
test('newer disconnect wins over delayed connect',async()=>{
 let resolve!:(v:unknown)=>void;const c=createIgDemoWorkspace(a=>a==='connect'?new Promise(r=>resolve=r):Promise.resolve({status:'REVOKED',providerLogout:'UNCONFIRMED'}),()=>{});
 const p=c.run('connect');await c.run('disconnect');resolve(fixture());await p;assert.equal(c.state().logout,'UNCONFIRMED');assert.equal(c.state().snapshot,null);
});
test('noncooperative timeout and hostile failure remove old data',async()=>{
 const c=createIgDemoWorkspace(()=>new Promise(()=>{}),()=>{},5);await c.run('connect');assert.equal(c.state().message,'UNAVAILABLE');assert.equal(c.state().busy,false);
 const x=createIgDemoWorkspace(async()=>{throw Error('SECRET');},()=>{});await x.run('refresh');assert.equal(JSON.stringify(x.state()).includes('SECRET'),false);
});
test('expiry clears snapshot without polling',async()=>{
 const c=createIgDemoWorkspace(async()=>({...fixture(),expiresAt:new Date(Date.now()+30).toISOString()}),()=>{});await c.run('connect');await new Promise(r=>setTimeout(r,50));assert.equal(c.state().message,'EXPIRED');assert.equal(c.state().snapshot,null);c.reset();
});
