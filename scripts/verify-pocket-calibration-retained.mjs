/** Offline replay of two completed, retained cases through the candidate's
 * actual precision control, merge and calibration. No provider/DB clients. */
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {stripTypeScriptTypes} from 'node:module';
import {recoverPrecisionGeometry} from '../app/api/pocket/precision-fallback.ts';
import {calibratePocketAnalysis} from '../app/api/pocket/analysis-calibration.ts';
import {normalizeInternalDiagnosticObservation} from './pocket-monaco-internal-diagnostics.ts';

const args=process.argv.slice(2);
assert.ok(args.length===8 && args[0]==='--retained-dir' && args[2]==='--bundle'
  && args[4]==='--original-recovery-dir' && args[6]==='--out',
  'Usage: --retained-dir /private/responses --bundle /private/first-six-input.bundle.gz --original-recovery-dir /private/recovery --out /validation.json');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const pins={
  d004:{input:'fd6eb8064864889fcff3e80f13188a34f991a683c86980ac48f0ca7484ca4c05',
    main:'016a49518c06d5ae924201212076ac3145d611e5b297cd522863c55328ec0ad7',
    primary_precision:'5660d3856b0647654e7fff2db86cdf40893d1ead4b4b2d091527db0a22d16c72',
    rescue_precision:'1cc7274afa060112c55519c00148a29416f9dcb6620f96fe6767726a9f57dee5',
    diagnostic:'66c8342e1ed98f757ee98210d7ae6972a1d6d88946decc1fb92a14e70f5f9a72',
    originalDerivative:'8787a2c92f07a5e2bfbff6816006c11ee734591828f494e304058d9454cf9042'},
  d005:{input:'5ed2fc0aef4efd1f573a9ccf7120fdc376776a2da8a5071928bda8d9254887a1',
    main:'7b5b75c5f92242d4d40c1b5e293b778458450803d90e3e00074fef8a539d8409',
    primary_precision:'ea7150cc1d9281867972d60d13171698bb9b4dfc544e8f91657b0b34f96ab14d',
    rescue_precision:'29028c9d15af0e5dc2ffac4b7399f2db3491fddcb5050309facf5ab992634511',
    diagnostic:'7c2e6e07e098e8c25adcaab2f5f8ce64abc19c6b6b4517fc2a9edd0ac4dd42f6',
    originalDerivative:'39a685f16a0c958b986fbf17a82b48e21535e245b763dfd6df204f8bc8c48e23'},
};
const originals=[];
async function pinned(path,expected){
  const bytes=await readFile(path);assert.equal(hash(bytes),expected);
  originals.push({path,sha256:expected});return bytes;
}
const compressed=await pinned(resolve(args[3]),'8b7b3bb3cb0d7122cb6cad0b5936e12c5d5d3f83e725d5fd42c81e5ae1d4e2f0');
const bundle=JSON.parse(gunzipSync(compressed,{maxOutputLength:128*1024*1024}));
assert.deepEqual(bundle.caseIds,['d001','d002','d003','d004','d005','d006']);
const route=await readFile(new URL('../app/api/pocket/analyse/route.ts',import.meta.url),'utf8');
const cut=(start,end)=>{const a=route.indexOf(start),b=route.indexOf(end,a);assert.ok(a>=0&&b>a);return route.slice(a,b);};
const makePrecision=new Function('requestPrecision','recoverPrecisionGeometry',
  stripTypeScriptTypes(cut('    const safePrecision = async','    const [response, precisionResult'))+'\nreturn safePrecision;');
const merge=new Function('initial','precisionResult','chartConfirmation','recoverPrecisionGeometry',
  'let analysis=initial,contextPrecisionResult=null;\n'+stripTypeScriptTypes(cut('    if (analysis && typeof analysis === "object")','    const calibrated = calibratePocketAnalysis'))+'\nreturn analysis;');
const results=[];
for(const [caseId,pin] of Object.entries(pins)){
  const entries=bundle.entries.filter(e=>e.path===`packet/inputs/${caseId}.json`);assert.equal(entries.length,1);
  const inputBytes=Buffer.from(entries[0].data,'base64');assert.equal(hash(inputBytes),pin.input);assert.equal(entries[0].sha256,pin.input);
  const input=JSON.parse(inputBytes),raw={},responseHashes={};
  for(const slot of ['main','primary_precision','rescue_precision']){
    const path=join(resolve(args[1]),`monaco-encrypted-40086015008-f3d86adeddff-${caseId}-provider-response-${slot}.json`);
    const bytes=await pinned(path,pin[slot]);raw[slot]=JSON.parse(bytes);
    assert.equal(raw[slot].status,'completed');JSON.parse(raw[slot].output_text);responseHashes[slot]=hash(bytes);
  }
  const originalDiagnostic=JSON.parse(await pinned(join(resolve(args[1]),`monaco-encrypted-40086015008-f3d86adeddff-${caseId}-diagnostic-output-final.json`),pin.diagnostic));
  assert.equal(originalDiagnostic.diagnostics.postprocessed.status,'UNMEASURED');
  assert.equal(originalDiagnostic.diagnostics.postprocessed.reason,'MALFORMED_OBSERVATIONS');
  for(const slot of Object.keys(responseHashes))assert.equal(originalDiagnostic.rawSha256[slot],responseHashes[slot]);
  const original=JSON.parse(await pinned(join(resolve(args[5]),`${caseId}-RECONSTRUCTED-POSTPROCESSED.json`),pin.originalDerivative));
  assert.equal(Object.hasOwn(original.liquidity,'observations'),false);
  const rawMain=JSON.parse(raw.main.output_text);assert.equal(rawMain.liquidity.state,'NONE');assert.deepEqual(rawMain.liquidity.observations,[]);
  const originalRaw=structuredClone(raw),requestedSlots=[];
  const safePrecision=makePrecision(async(_image,rescue=false)=>{
    const slot=rescue?'rescue_precision':'primary_precision';requestedSlots.push(slot);
    assert.deepEqual(requestedSlots,['primary_precision','rescue_precision'].slice(0,requestedSlots.length));
    return raw[slot];
  },recoverPrecisionGeometry);
  const precision=await safePrecision('offline-retained-image-placeholder',caseId,null);
  assert.deepEqual(requestedSlots,['primary_precision','rescue_precision']);
  const candidate=calibratePocketAnalysis(merge(rawMain,precision,input.chartConfirmation,recoverPrecisionGeometry));
  assert.deepEqual(candidate.liquidity.observations,[]);
  const stripped=structuredClone(candidate);delete stripped.liquidity.observations;
  assert.deepEqual(stripped,original,'No existing geometry, identity or score may change during this witness-field repair');
  const outputBytes=Buffer.from(JSON.stringify(candidate));
  const normalized=normalizeInternalDiagnosticObservation(outputBytes,{width:1400,height:850});
  assert.equal(normalized.status,'NORMALIZED');assert.equal(normalized.witnesses.length,0);assert.equal(normalized.zones.length,0);
  assert.deepEqual(raw,originalRaw);
  results.push({caseId,status:'PASS',inputSha256:pin.input,responseHashes,
    originalDiagnosticSha256:pin.diagnostic,originalDerivativeSha256:pin.originalDerivative,
    originalHostedStatus:'UNMEASURED/MALFORMED_OBSERVATIONS',candidateStatus:normalized.status,
    candidateDerivedSha256:hash(outputBytes),axisAssertions:normalized.axisAnchors.length,
    levelAssertions:normalized.levels.length,observationsCopiedFromExplicitSourceEmptyArray:true,
    unrelatedOutputFieldsUnchanged:true,mockPrecisionCalls:requestedSlots.length,
    semanticAbsenceAccepted:false,geometryAccuracyAccepted:false});
}
for(const original of originals)assert.equal(hash(await readFile(original.path)),original.sha256);
const sources={};
for(const path of ['app/api/pocket/analyse/route.ts','app/api/pocket/analysis-calibration.ts','app/api/pocket/precision-fallback.ts','scripts/pocket-monaco-internal-diagnostics.ts']){
  sources[path]=hash(await readFile(new URL(`../${path}`,import.meta.url)));
}
const receipt={kind:'POCKET_CALIBRATION_RETAINED_RESPONSE_OFFLINE_CONTROL',status:'PASS',observedAtUtc:new Date().toISOString(),
  nodeVersion:process.version,baseCheckpoint:'889feaa0768768d03b86f6db1664cb40321e5adf',sources,
  verificationScriptSha256:hash(await readFile(new URL(import.meta.url))),cases:results,
  providerCalls:0,databaseCalls:0,privateKeyReads:0,heldOutPayloadsRead:0,originalArtifactsModified:false,
  limitations:['Offline candidate derivatives only; original hosted diagnostics remain unchanged',
    'Normalizing assertions does not establish source geometry or trading accuracy',
    'No new output-budget completion or deployed endpoint latency measurement']};
await writeFile(resolve(args[7]),JSON.stringify(receipt,null,2)+'\n',{flag:'wx',mode:0o600});
console.log(JSON.stringify({status:receipt.status,cases:results.map(r=>({caseId:r.caseId,status:r.candidateStatus,axisAssertions:r.axisAssertions,levelAssertions:r.levelAssertions})),providerCalls:0,databaseCalls:0,originalArtifactsModified:false}));
