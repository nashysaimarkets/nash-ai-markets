/** Offline control replay of the already-retained d001 response. No provider or database client. */
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {basename,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {stripTypeScriptTypes} from 'node:module';

const args=process.argv.slice(2);
assert.ok(args.length===4&&args[0]==='--retained'&&args[2]==='--out',
  'Usage: --retained /private/retained-primary-response.json --out /local/validation-receipt.json');
assert.equal(basename(args[1]),'monaco-encrypted-40083992183-9e82c6d25dcb-d001-provider-response-primary_precision.json');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const bytes=await readFile(resolve(args[1]));
const retainedSha256='f396f9c82dc772d74c836973ca1a72549c1c6e7687f5feeb87f41c77591ad9b0';
assert.equal(hash(bytes),retainedSha256,'The exact retained response is required; no synthetic substitute');
const response=JSON.parse(bytes);
assert.equal(response.status,'incomplete');
assert.deepEqual(response.incomplete_details,{reason:'max_output_tokens'});
assert.equal(response.usage.output_tokens,1400);
assert.equal(response.usage.output_tokens_details.reasoning_tokens,832);
assert.equal(response.output_text.length,1363);
assert.throws(()=>JSON.parse(response.output_text));

const source=await readFile(new URL('../app/api/pocket/analyse/route.ts',import.meta.url),'utf8');
const start=source.indexOf('    const safePrecision = async');
const end=source.indexOf('    const [response, precisionResult',start);
assert.ok(start>=0&&end>start);
const make=new Function('requestPrecision','recoverPrecisionGeometry',
  stripTypeScriptTypes(source.slice(start,end))+'\nreturn safePrecision;');
const before=structuredClone(response),mockCalls=[];
const safePrecision=make(async(...requestArgs)=>{mockCalls.push(requestArgs);return response;},
  ()=>{throw Error('Incomplete response must never reach geometry recovery');});
const result=await safePrecision('offline-fixture-only','retained-control',null);
assert.equal(result,null);
assert.equal(mockCalls.length,1);
assert.equal(mockCalls[0].length,1,'No rescue request may be synthesized');
assert.deepEqual(response,before,'Provider status and text must remain unchanged');
assert.equal(hash(await readFile(resolve(args[1]))),retainedSha256);

const receipt={
  kind:'POCKET_PRECISION_V2_RETAINED_RESPONSE_OFFLINE_CONTROL',
  status:'PASS',observedAtUtc:new Date().toISOString(),nodeVersion:process.version,
  proposalVersion:'POCKET_PRECISION_OUTPUT_V2',
  baseSourceSha:'9e82c6d25dcb7f589e2328b2efc7910033d8fcdc',
  candidateRouteSha256:hash(source),verificationScriptSha256:hash(await readFile(new URL(import.meta.url))),
  retained:{originalRunId:'40083992183',caseId:'d001',slot:'primary_precision',sha256:retainedSha256,
    status:response.status,incompleteReason:response.incomplete_details.reason,
    inputTokens:response.usage.input_tokens,outputTokens:response.usage.output_tokens,
    reasoningTokens:response.usage.output_tokens_details.reasoning_tokens,
    totalTokens:response.usage.total_tokens,outputTextChars:response.output_text.length,outputTextIsValidJson:false},
  handling:{precisionResult:'UNAVAILABLE',mockPrimaryCalls:1,mockRescueCalls:0,rawResponseUnchanged:true,
    incompleteJsonRepaired:false,completedStatusFabricated:false},
  providerCalls:0,databaseCalls:0,privateKeyReads:0,paidDispatchAuthorised:false,
  limitations:['Retained 1400-token output was not regenerated','No claim that 4000 tokens completes a future response',
    'No live chart accuracy, latency, calibration or quality evidence'],
};
await writeFile(resolve(args[3]),JSON.stringify(receipt,null,2)+'\n',{flag:'wx',mode:0o600});
console.log(JSON.stringify({status:receipt.status,retainedSha256,candidateRouteSha256:receipt.candidateRouteSha256,
  providerCalls:0,databaseCalls:0,mockPrimaryCalls:1,mockRescueCalls:0}));
