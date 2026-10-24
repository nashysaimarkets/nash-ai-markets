/** Synthetic source evidence must never become accepted scanner evidence. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {finishContinuationCase} from '../scripts/pocket-monaco-continuation-case.mjs';
import {finishFrozenFirstSixCase} from '../scripts/pocket-monaco-first-six-executor.ts';
import {createContinuationLedgerBridge} from '../scripts/pocket-monaco-continuation-bridge.mjs';
import {createNeonSqlPort} from '../scripts/pocket-monaco-neon-port.ts';
import {INTERNAL_DIAGNOSTIC_PROTOCOL} from '../scripts/pocket-monaco-internal-diagnostics.ts';
import {needsRescue,verifyScannerSources} from '../scripts/pocket-monaco-offline-executor.ts';
import {identity,balance,hash,truncated} from './support/pocket-monaco-continuation-fixture.mjs';
import {PINS} from '../scripts/pocket-monaco-setup-preflight.mjs';

const artifact=s=>({bytes:Buffer.from(s),sha256:hash(s)});
function c(){return {caseId:'d002',input:{chartConfirmation:{contextMatch:'NOT_PROVIDED'}},
  material:{artifacts:{input:artifact('synthetic-input'),image:artifact('synthetic-image')}},
  objectiveReference:artifact('{}'),protocol:artifact(JSON.stringify(INTERNAL_DIAGNOSTIC_PROTOCOL)),sourceIdentity:{synthetic:true}};}
const completed=()=>({status:'completed',output_text:'{}'});
test('completed responses preserve exact existing calibration/scoring composition',()=>{
 const raw={main:completed(),primary_precision:completed()},before=structuredClone(raw),input=c();
 const expected=finishFrozenFirstSixCase(input,raw,1),actual=finishContinuationCase(input,raw,1);
 assert.deepEqual(actual.rawMain,expected.rawMain);assert.deepEqual(actual.postprocessed,expected.postprocessed);
 assert.equal(actual.rawMain.status,'UNMEASURED');assert.equal(actual.expertAccepted,false);assert.deepEqual(raw,before);
});
test('incomplete primary or rescue never becomes calibrated geometry or completed status',()=>{
 for(const slot of ['primary_precision','rescue_precision']){
  const raw={main:completed(),primary_precision:completed(),[slot]:truncated(completed())},before=structuredClone(raw);
  const out=finishContinuationCase(c(),raw,1);
  assert.equal(out.postprocessed.status,'UNMEASURED');assert.equal(out.postprocessed.reason,'PROVIDER_OUTPUT_INCOMPLETE');
  assert.equal(out.providerOutcomes[slot].status,'incomplete');assert.deepEqual(raw,before);
  assert.equal(out.expertAccepted,false);assert.equal(out.tradingInterpretation,'UNSCORED');
 }
});
test('incomplete main has explicit unmeasured raw and postprocessed outcomes',()=>{
 const out=finishContinuationCase(c(),{main:truncated(completed())},1);
 assert.equal(out.rawMain.status,'UNMEASURED');assert.equal(out.rawMain.reason,'PROVIDER_MAIN_MAX_OUTPUT_TOKENS');
 assert.equal(out.postprocessed.status,'UNMEASURED');assert.deepEqual(Object.keys(out.providerOutcomes),['main']);
});
test('unknown incomplete status, d001 and held-out case refuse diagnostic composition',()=>{
 for(const id of ['d001','e001'])assert.throws(()=>finishContinuationCase({...c(),caseId:id},{main:completed()},1));
 assert.throws(()=>finishContinuationCase(c(),{main:{status:'incomplete',output_text:'{}'}},1));
 verifyScannerSources();assert.equal(needsRescue('{"synthetic":'),false);
});
test('the existing SQL port receives actual successor identity including every continuation field',async()=>{
 const i=identity(),calls=[];
 const n={organizationId:PINS.organization,projectId:PINS.projectId,branchId:PINS.branchId,
  endpointHost:PINS.host,databaseName:PINS.database,roleName:PINS.role,controlPlaneEvidenceSha256:'f'.repeat(64)};
 const sql={async query(text,values){calls.push({text,values});const operation=values[2];
  return {rows:[{result:operation==='inspect_monaco_isolated_runner'?balance(i):{allowed:true,status:'reserved',idempotent:false}}]};}};
 const bridge=createContinuationLedgerBridge(createNeonSqlPort(sql,n,i),'synthetic-existing-ledger',i);
 const claim=await bridge.claim('d002');assert.equal(claim.claim.allowed,true);
 for(const row of calls){assert.deepEqual(JSON.parse(row.values[1]),i);
  if(row.values[2]==='inspect_monaco_isolated_runner')assert.deepEqual(JSON.parse(row.values[3]).p_identity,i);}
 const plan=JSON.parse(calls.find(x=>x.values[2]==='claim_pocket_benchmark_case').values[3]).p_plan;
 assert.deepEqual(plan.map(x=>x.maxOutputTokens),[7000,1400,1400]);
 assert.deepEqual(plan.map(x=>x.maxCostMicroUsd),[114000,102800,102800]);
});
test('successor bridge rejects any d001 or held-out mutation before the SQL mutation',async()=>{
 const i=identity(),calls=[];
 const port={async rpc(name,args){calls.push({name,args});return {data:balance(i),error:null};}};
 const bridge=createContinuationLedgerBridge(port,'synthetic-existing-ledger',i);
 for(const id of ['d001','e001']){
  await assert.rejects(()=>bridge.claim(id));await assert.rejects(()=>bridge.voidUnused(id,'rescue_precision'));
  await assert.rejects(()=>bridge.account(id));
 }
 assert.ok(calls.every(c=>c.name==='inspect_monaco_isolated_runner'));
});
