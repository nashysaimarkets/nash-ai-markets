/** New integration checks against the unchanged original source tree. No
 * private packet is loaded; only invalid/synthetic material is supplied.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createFrozenFirstSixExecutor,prepareFrozenFirstSix,finishFrozenFirstSixCase} from '../scripts/pocket-monaco-first-six-executor.ts';
import {SOURCE_PINS,verifyScannerSources,sha256} from '../scripts/pocket-monaco-offline-executor.ts';
import {loadFrozenRunnerPlan,FROZEN_PLAN_SHA256} from '../scripts/pocket-monaco-runner-bridge.ts';
import {dispatchRealInternalDiagnostics} from '../scripts/pocket-monaco-diagnostic-provider.ts';
import {INTERNAL_DIAGNOSTIC_PROTOCOL} from '../scripts/pocket-monaco-internal-diagnostics.ts';
import {PINS} from '../scripts/pocket-monaco-setup-preflight.mjs';

const root=new URL('../',import.meta.url);
const artifact=text=>{const bytes=Buffer.from(text);return {bytes,sha256:sha256(bytes)};};
test('new adapter imports original modules; frozen source/plan/integration bytes remain exact',()=>{
  verifyScannerSources();assert.equal(Object.keys(SOURCE_PINS).length,11);
  const bytes=readFileSync(new URL('docs/monaco-126/internal-diagnostics/FIRST-SIX-PROVIDER-PLAN.json',root));
  assert.equal(sha256(bytes),FROZEN_PLAN_SHA256);const plan=JSON.parse(bytes);
  for(const [path,hash] of Object.entries(plan.integrationSourceHashes))assert.equal(sha256(readFileSync(new URL(path,root))),hash);
  assert.deepEqual(loadFrozenRunnerPlan().caseIds,['d001','d002','d003','d004','d005','d006']);
  assert.throws(()=>dispatchRealInternalDiagnostics(),/DISABLED/);
});
test('strict adapter refuses changed/absent frozen manifest and held-out scope without a packet read',()=>{
  const input={materials:['d001','d002','d003','d004','d005','d006'].map(caseId=>({caseId})),
    packetManifest:artifact('synthetic, not a packet'),objectiveReference:artifact('{}'),protocol:artifact('{}')};
  assert.throws(()=>prepareFrozenFirstSix(input),/FROZEN_FIRST_SIX/);
  input.materials[0].caseId='e001';assert.throws(()=>prepareFrozenFirstSix(input),/FROZEN_FIRST_SIX/);
});
test('actual ledger bridge composition rejects invalid material before any injected effect',async()=>{
  let effects=0;
  const port={async rpc(){effects++;throw Error('must not be called');}};
  const executor=createFrozenFirstSixExecutor({port,ledgerKey:'synthetic-existing-allowance',
    identity:{environment:PINS.environment,sourceSha:'a'.repeat(40),backendRef:PINS.backend,projectRef:PINS.project,
      keyTrackingId:PINS.keyTrackingId,keyFingerprintSha256:sha256('synthetic'),planSha256:PINS.planSha256},
    transport:{async send(){effects++;throw Error('must not be called');}},
    privateArtifacts:{async write(){effects++;throw Error('must not be called');}}});
  const result=await executor.run({materials:[]});assert.equal(result.reason,'PREPARATION_REFUSED');assert.equal(effects,0);
});
test('original calibration/scorer integration does not turn invalid source evidence into acceptance',()=>{
  const input=artifact('synthetic-input'),image=artifact('synthetic-image');
  const c={caseId:'d003',input:{chartConfirmation:{contextMatch:'NOT_PROVIDED'}},
    material:{artifacts:{input,image}},objectiveReference:artifact('{}'),
    protocol:artifact(JSON.stringify(INTERNAL_DIAGNOSTIC_PROTOCOL)),sourceIdentity:{synthetic:true}};
  const raw={main:{status:'completed',output_text:'{}'},primary_precision:{status:'completed',output_text:'{}'}};
  const result=finishFrozenFirstSixCase(c,raw,1);
  assert.equal(result.rawMain.status,'UNMEASURED');assert.equal(result.postprocessed.status,'UNMEASURED');
  assert.equal(result.expertAccepted,false);assert.equal(result.humanReviewed,false);
  assert.deepEqual(INTERNAL_DIAGNOSTIC_PROTOCOL.weakPatternCaseIds,['d003']);
});
