/** Explicit LOCAL synthetic composition control, never a hosted entry or CI
 * gate. It uses one original private input bundle and NO real key/network/DB.
 * A test-only Node load hook changes exactly one pinned fingerprint constant
 * in memory. Every production file remains unchanged; the normal entry rejects
 * this synthetic key. No other source or data validation is substituted. */
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {EventEmitter} from 'node:events';
import {generateRecipientKeyPair,sealInputBundle} from './pocket-monaco-confidential-transport.mjs';

const args=process.argv.slice(2);
assert.ok(args.length===8&&args[0]==='--bundle'&&args[2]==='--expected-bundle-sha'&&args[4]==='--plan'&&args[6]==='--out');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const bundle=readFileSync(resolve(args[1])),planBytes=readFileSync(resolve(args[5]));
assert.equal(hash(bundle),args[3]);
const sourceUrl=new URL('./pocket-scanner-evaluation-v2-source.mjs',import.meta.url).href;
const entryUrl=new URL('./pocket-scanner-evaluation-v2-hosted-entry.mjs',import.meta.url);
const beforeSource=readFileSync(new URL(sourceUrl)),beforeEntry=readFileSync(entryUrl);
const originalFingerprint='107e0cb3265e15aa25e3fa49c91512096f84b43d5fa834761c73c3cce2c99d0e';
const syntheticKey='SYNTHETIC_TEST_ONLY_NO_PROVIDER_CREDENTIAL',syntheticFingerprint=hash(syntheticKey);
let substitutions=0;
const hook=registerHooks({load(url,context,nextLoad){
  const loaded=nextLoad(url,context);
  if(url!==sourceUrl)return loaded;
  assert.equal(substitutions,0);const text=Buffer.from(loaded.source).toString('utf8');
  assert.equal(text.split(originalFingerprint).length-1,1);substitutions++;
  return {...loaded,source:text.replace(originalFingerprint,syntheticFingerprint)};
}});
globalThis.fetch=async()=>{throw Error('SYNTHETIC_CONTROL_NETWORK_FORBIDDEN');};
const {V2}=await import('./pocket-scanner-evaluation-v2-source.mjs');
const {executeProtectedEvaluation,expectedAdmissionFromConfig}=await import('./pocket-scanner-evaluation-v2-hosted-entry.mjs');
const {unpackEvaluationCase}=await import('./pocket-scanner-evaluation-v2-bundle.mjs');
assert.equal(substitutions,1);assert.equal(V2.keyFingerprintSha256,syntheticFingerprint);
const plan=JSON.parse(planBytes);assert.equal(plan.cases[0].caseId,'v2-d001');
const prepared=unpackEvaluationCase({bytes:bundle,expectedBundleSha256:args[3],planBytes,expectedPlanSha256:hash(planBytes),caseId:'v2-d001'});
const recipient=generateRecipientKeyPair(),events=[],slots=new Map(),uploads=[];
const context={repository:V2.repository,event:'push',ref:'refs/heads/monaco-scanner-evaluation-v2-run-v2-d001',runId:'900000001',jobId:'900000002',
  runAttempt:'1',sourceSha:'a'.repeat(40),evidenceSha:'b'.repeat(40),wrapperSha:'c'.repeat(40)};
const config={kind:'POCKET_SCANNER_EVALUATION_V2_RUN_ADMISSION',status:'EXECUTION_APPROVED',caseId:'v2-d001',runtimeSourceSha:context.sourceSha,
  planSha256:hash(planBytes),scopeApproval:{status:'APPROVED',scopeId:V2.scopeId,ownerDirectiveSha256:'d'.repeat(64),planSha256:hash(planBytes),appSourceSha:V2.appSourceSha,
    approvalRef:'https://github.com/nashysaimarkets/nash-ai-markets/issues/126#issuecomment-999999999999',maximumNewMicroUsd:1980000,aggregateCapMicroUsd:5000000},
  admissionEvidenceSha256:'e'.repeat(64),reassessmentEvidenceSha256:'f'.repeat(64),previousCaseReceiptSha256:null,
  neon:{organizationId:'org-icy-butterfly-11039021',projectId:'bitter-grass-28096464',branchId:'br-aged-mode-zaa9u7lr',
    endpointHost:'ep-silent-fire-za1s230f.c-2.eu-west-2.aws.neon.tech',databaseName:'monaco_ledger',roleName:'monaco_ledger_runner',controlPlaneEvidenceSha256:'0'.repeat(64)},
  input:{bundleSha256:args[3],maxWaitMs:300000},output:{retentionDays:7,recipientPublicKeyPem:recipient.publicKeyPem,recipientPublicKeySha256:recipient.publicKeySha256}};
class FakeSql extends EventEmitter{
  constructor(options){super();assert.equal(options.ssl.rejectUnauthorized,true);assert.equal(options.ssl.servername,config.neon.endpointHost);events.push('fake-sql-constructed');}
  async connect(){events.push('fake-sql-connected');}
  async end(){events.push('fake-sql-ended');}
  async query(sql,params){assert.equal(sql,'select public.monaco_scanner_evaluation_v2_rpc($1::jsonb,$2::jsonb,$3::text,$4::jsonb) as result');
    const bound=JSON.parse(params[1]),operation=params[2],value=JSON.parse(params[3]);assert.equal(bound.evaluation.caseId,'v2-d001');events.push(`fake-rpc:${operation}`);
    let result;
    if(operation==='inspect')result={allowed:true,reason:null,scopeId:V2.scopeId,caseId:'v2-d001',attemptId:'v2-d001-attempt-1',caseStatus:null,
      originalCommitmentsMicroUsd:1506400,evaluationCommitmentsMicroUsd:0,aggregateCommittedMicroUsd:1506400,remainingMicroUsd:3493600,
      financiallySettled:false,actualMicroUsd:null,slots:[],admission:expectedAdmissionFromConfig(config)};
    else if(operation==='begin_case'){assert.equal(events.filter(e=>e==='fake-rpc:begin_case').length,1);result={allowed:true,status:'reserved',idempotent:false};}
    else if(operation==='submit_slot'){assert.ok(!slots.has(value.slot));const pin=prepared.requests[value.slot];assert.equal(value.requestId,pin.requestId);assert.equal(value.fingerprint,pin.fingerprint);assert.equal(value.requestSha256,pin.requestSha256);
      slots.set(value.slot,'submitted');result={ok:true,status:'submitted',claimed:true};}
    else if(operation==='receipt_slot'){assert.equal(slots.get(value.slot),'submitted');assert.ok(value.providerRequestId.startsWith('SYNTHETIC_'));slots.set(value.slot,'receipted');result={ok:true,status:'receipted'};}
    else if(operation==='finish_case'){assert.equal(slots.get('main'),'receipted');assert.equal(slots.get('primary_precision'),'receipted');assert.equal(typeof value.diagnosticArtifactId,'string');result={ok:true,status:'completed',accountingStatus:'FULL_RESERVATION_HELD',financiallySettled:false};}
    else throw Error('Unexpected synthetic RPC');
    return {rows:[{result}]};
  }
}
class FakeOpenAI{
  constructor(options){Object.assign(this,options);assert.equal(options.apiKey,syntheticKey);assert.equal(options.maxRetries,0);assert.equal(options.baseURL,'https://api.openai.com/v1');events.push('fake-provider-constructed');
    this.responses={create:async(body,options)=>{
      assert.equal(options.maxRetries,0);const slot=body.text.format.name==='pocket_bullseye_chart_analysis'?'main':'primary_precision';
      assert.deepEqual(body,JSON.parse(Buffer.from(prepared.requests[slot].bytes)));events.push(`fake-provider:${slot}`);
      const geometry={plotBounds:{left:10,top:10,right:90,bottom:90},priceScaleAnchors:[{price:120,y:10},{price:100,y:50},{price:80,y:90}],
        levels:[{kind:'support',label:'SYNTHETIC',price:'90',x:10,x2:90,y:70,y2:70},{kind:'resistance',label:'SYNTHETIC',price:'110',x:10,x2:90,y:30,y2:30}],currentPrice:'100'};
      const output=slot==='main'?{...geometry,instrument:'SYNTHETIC_ONLY',timeframe:'1h',patterns:[],setupScore:{overall:0},
        evidenceQuality:{chartReadability:'CLEAR',candlesReadable:true,scaleReadable:true,instrumentConfidence:'HIGH',timeframeConfidence:'HIGH'},
        liquidity:{state:'NONE',event:'NONE',confidence:'LOW',zones:[],observations:[]}}:geometry;
      const r={id:`SYNTHETIC_RESPONSE_${slot}`,model:V2.model,service_tier:'default',status:'completed',output_text:JSON.stringify(output),
        usage:{input_tokens:100,output_tokens:100,total_tokens:200}};
      Object.defineProperty(r,'_request_id',{value:`SYNTHETIC_REQUEST_${slot}`,enumerable:false});return r;
    }};
  }
}
class FakeArtifact{
  async uploadArtifact(name,files,_directory,options){assert.equal(files.length,1);const bytes=readFileSync(files[0]);
    if(name.startsWith('monaco-encrypted-')){const e=JSON.parse(bytes);assert.ok(e.ciphertext&&!bytes.includes(Buffer.from('SYNTHETIC_RESPONSE_')));assert.equal(options.retentionDays,7);}
    else assert.ok(name.startsWith('monaco-input-handoff-'));
    uploads.push({name,sha256:hash(bytes)});events.push('fake-artifact-upload');return {id:uploads.length,size:bytes.length,digest:hash(bytes)};
  }
}
const result=await executeProtectedEvaluation({config,context,planBytes,caseId:'v2-d001'},{
  runtime:{versions:{openai:'6.48.0',pg:'8.16.3','@actions/artifact':'6.3.1'},OpenAI:FakeOpenAI,Client:FakeSql,ArtifactClient:FakeArtifact},
  credentials:{existingKey:syntheticKey,ledgerPassword:'SYNTHETIC_NOT_A_DATABASE_PASSWORD'},
  receiveInputOnce:async({publicHandoff,run,expectedBundleSha256})=>{events.push('fake-encrypted-input');
    return sealInputBundle({publicHandoff,run,bytes:bundle,expectedBundleSha256});}});
assert.equal(result.status,'COMPLETED');assert.equal(result.transportSendAttempts,2);assert.equal(result.diagnosticCasesRetained,1);
assert.equal(uploads.length,4);assert.deepEqual([...slots.values()],['receipted','receipted']);
assert.ok(events.indexOf('fake-rpc:inspect')<events.indexOf('fake-encrypted-input'));
assert.equal(hash(readFileSync(new URL(sourceUrl))),hash(beforeSource));assert.equal(hash(readFileSync(entryUrl)),hash(beforeEntry));
assert.equal(hash(readFileSync(resolve(args[1]))),args[3]);hook.deregister();
const report={kind:'LOCAL_SYNTHETIC_PROTECTED_V2_COMPOSITION_CONTROL',status:'PASS',node:process.version,
  sourceConstantSubstitutions:1,substitution:'Pinned key fingerprint replaced in memory with SHA256 of a synthetic test key',
  productionSourceUnchanged:true,sourceSha256:hash(beforeSource),entrySha256:hash(beforeEntry),bundleSha256:args[3],planSha256:hash(planBytes),
  realPrivateInputCase:'v2-d001',mockProviderCalls:2,mockDatabase:true,mockArtifactUploads:4,providerCalls:0,hostedDatabaseCalls:0,
  actualProviderCredentialRead:false,liveKeyAuthentication:false,paidExecutionAuthorised:false,
  nonEnumerableProviderRequestIdsPreserved:true,encryptedDataPathVerified:true,heldOutPayloadsRead:0,
  latencyMeaning:'Synthetic local effect timings only',events,limitations:['Not an actual hosted run, provider response, accounting settlement or accuracy result']};
writeFileSync(resolve(args[7]),JSON.stringify(report,null,2)+'\n',{flag:'wx',mode:0o600});
console.log(JSON.stringify({status:report.status,sourceConstantSubstitutions:1,productionSourceUnchanged:true,mockProviderCalls:2,providerCalls:0,hostedDatabaseCalls:0}));
