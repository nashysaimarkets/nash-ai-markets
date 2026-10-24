import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createEvaluationTransport,createEvaluationArtifactSink,openEvaluationArtifact} from '../scripts/pocket-scanner-evaluation-v2-effects.mjs';
import {generateRecipientKeyPair,sealConfidentialRecord} from '../scripts/pocket-monaco-confidential-transport.mjs';
import {V2,sha256} from '../scripts/pocket-scanner-evaluation-v2-source.mjs';
import {identity,material,response} from './support/pocket-scanner-evaluation-v2-fixture.mjs';
function client(){let calls=0;return {project:V2.project,baseURL:'https://api.openai.com/v1',maxRetries:0,apiKey:'SYNTHETIC_INERT_CLIENT_KEY',
  responses:{async create(body,options){calls++;assert.equal(body.max_output_tokens,4000);assert.equal(options.maxRetries,0);return response('primary_precision');}},count:()=>calls};}
function request(){const c=material(),r=c.requests.primary_precision;return {caseId:c.caseId,sourceCaseId:c.sourceCaseId,attemptId:c.attemptId,
  slot:'primary_precision',...r,requestBytes:r.bytes};}
test('v2 SDK adapter sends exact frozen4000 body once and never retries a failed or completed slot',async()=>{
  const c=client(),t=createEvaluationTransport(c,identity()),r=request();await t.send(r);assert.equal(c.count(),1);await assert.rejects(t.send(r));assert.equal(c.count(),1);
  const d=client();let attempts=0;d.responses.create=async()=>{attempts++;throw Error('SYNTHETIC UNKNOWN');};
  const f=createEvaluationTransport(d,identity());await assert.rejects(f.send(r));await assert.rejects(f.send(r));assert.equal(attempts,1);
});
test('client key/project changes and oldcase/payload substitutions cannot reachSDK',async()=>{
  for(const mutate of [c=>c.apiKey='changed',c=>c.project='other',c=>c.maxRetries=1]){const c=client(),t=createEvaluationTransport(c,identity());mutate(c);await assert.rejects(t.send(request()));assert.equal(c.count(),0);}
  const c=client(),t=createEvaluationTransport(c,identity()),r=request();await assert.rejects(t.send({...r,caseId:'d001'}));
  const bytes=Uint8Array.from(r.requestBytes);bytes[0]^=1;await assert.rejects(t.send({...r,requestBytes:bytes}));assert.equal(c.count(),0);
});
test('encrypted v2 wrapper preserves exact rawbytes and rejects bareold or crossscope records',async()=>{
  const bound=identity(),keys=generateRecipientKeyPair(),run={repository:V2.repository,runId:bound.evaluation.runId,runAttempt:'1',sourceSha:bound.sourceSha};
  const r=material().requests.primary_precision,raw=Buffer.from(JSON.stringify(response('primary_precision'))),record={scopeId:V2.scopeId,
    caseId:'v2-d001',sourceCaseId:'d001',attemptId:'v2-d001-attempt-1',planSha256:bound.planSha256,kind:'provider-response',slot:'primary_precision',
    requestId:r.requestId,requestSha256:r.requestSha256,fingerprint:r.fingerprint,bytes:raw,sha256:sha256(raw)};
  let ciphertext,name;const artifactClient={async uploadArtifact(n,paths){name=n;ciphertext=readFileSync(paths[0]);return {id:1,size:ciphertext.length,digest:'f'.repeat(64)};}};
  const sink=createEvaluationArtifactSink({identity:bound,run,artifactClient,recipientPublicKeyPem:keys.publicKeyPem,expectedRecipientPublicKeySha256:keys.publicKeySha256,retentionDays:7});
  const ack=await sink.write(record);assert.equal(ack.logicalCaseId,'v2-d001');assert.equal(ack.physicalSourceCaseId,'d001');assert.equal(ack.sha256,sha256(raw));assert.notEqual(ack.wrappedSha256,ack.sha256);
  assert.ok(name.includes('-d001-provider-response-'));const options={identity:bound,record,wrappedSha256:ack.wrappedSha256,envelopeBytes:ciphertext,
    privateKeyPem:keys.privateKeyPem,run,expectedRecipientPublicKeySha256:keys.publicKeySha256,retentionDays:7};
  assert.deepEqual(openEvaluationArtifact(options),raw);
  assert.throws(()=>openEvaluationArtifact({...options,identity:identity('v2-d002')}));
  assert.throws(()=>openEvaluationArtifact({...options,record:{...record,caseId:'d001'}}));
  const old=sealConfidentialRecord({run,record:{kind:record.kind,caseId:'d001',slot:record.slot,sha256:sha256(raw),requestSha256:r.requestSha256,fingerprint:r.fingerprint},
    bytes:raw,recipientPublicKeyPem:keys.publicKeyPem,expectedRecipientPublicKeySha256:keys.publicKeySha256,retentionDays:7});
  assert.throws(()=>openEvaluationArtifact({...options,envelopeBytes:old,wrappedSha256:sha256(raw)}));
  await assert.rejects(sink.write(record),'Duplicate physical name cannot overwrite a prior result');
});
