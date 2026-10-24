/** V2 transport and explicit authenticated scope wrapper around the accepted
 * encryption primitive. Original physical source IDs never become ledger IDs. */
import {createEncryptedArtifactSink,openConfidentialRecord} from './pocket-monaco-confidential-transport.mjs';
import {V2,SLOTS,need,sha256,sourceCaseId,attemptId,scopedFingerprint,validateEnvelope,exactKeys} from './pocket-scanner-evaluation-v2-source.mjs';
import {validateEvaluationIdentity} from './pocket-scanner-evaluation-v2-bridge.mjs';

export function createEvaluationTransport(client,identity){
  const bound=validateEvaluationIdentity(identity),e=bound.evaluation,attempted=new Set();
  const admitted=()=>need(client?.project===V2.project&&client.baseURL==='https://api.openai.com/v1'
    &&client.maxRetries===0&&typeof client.responses?.create==='function'
    &&typeof client.apiKey==='string'&&client.apiKey.trim().length>0);
  // The protected entry verifies the immutable key fingerprint before creating
  // this client. Capture that exact key here and reject any later substitution.
  admitted();const key=client.apiKey;
  return Object.freeze({async send(request){
    try{
      admitted();need(client.apiKey===key&&request.caseId===e.caseId&&request.sourceCaseId===e.sourceCaseId
        &&request.attemptId===e.attemptId&&SLOTS.includes(request.slot)&&!attempted.has(request.slot)
        &&request.requestBytes instanceof Uint8Array&&!request.signal?.aborted
        &&sha256(request.requestBytes)===request.requestSha256
        &&request.fingerprint===scopedFingerprint(request)
        &&request.requestId===`${e.caseId}-${request.slot}-${request.requestSha256.slice(0,16)}`);
      const body=validateEnvelope(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(request.requestBytes)),request.slot);
      attempted.add(request.slot); // Unknown provider outcomes permanently consume this slot.
      const response=await client.responses.create(body,{maxRetries:0,signal:request.signal});
      return {...response,_request_id:response?._request_id,id:response?.id,model:response?.model,
        service_tier:response?.service_tier,usage:response?.usage,status:response?.status,output_text:response?.output_text};
    }catch{throw Error('V2_PROVIDER_ATTEMPT_REFUSED_OR_UNKNOWN_NO_RETRY');}
  }});
}
const recordIdentity=(bound,record)=>({scopeId:bound.evaluation.scopeId,attemptId:bound.evaluation.attemptId,
  caseId:bound.evaluation.caseId,sourceCaseId:bound.evaluation.sourceCaseId,planSha256:bound.planSha256,
  kind:record.kind,slot:record.slot,requestId:record.requestId??null,requestSha256:record.requestSha256??null,
  fingerprint:record.fingerprint??null,rawSha256:record.sha256});
function validateRecord(bound,record){
  const e=bound.evaluation;
  need(record.caseId===e.caseId&&record.sourceCaseId===sourceCaseId(e.caseId)&&record.attemptId===attemptId(e.caseId)
    &&record.scopeId===e.scopeId&&record.planSha256===bound.planSha256&&record.bytes instanceof Uint8Array
    &&sha256(record.bytes)===record.sha256);
  if(record.kind==='provider-response')need(SLOTS.includes(record.slot)&&record.fingerprint===scopedFingerprint(record)
    &&record.requestId===`${record.caseId}-${record.slot}-${record.requestSha256.slice(0,16)}`);
  else need(record.kind==='diagnostic-output'&&record.slot===null&&record.requestId===undefined
    &&record.requestSha256===undefined&&record.fingerprint===undefined);
}
export function createEvaluationArtifactSink({identity,run,...options}){
  const bound=validateEvaluationIdentity(identity);
  need(run.repository===V2.repository&&run.runId===bound.evaluation.runId&&run.runAttempt==='1'&&run.sourceSha===bound.sourceSha);
  const physical=createEncryptedArtifactSink({run,...options});
  return Object.freeze({async write(record){
    validateRecord(bound,record);
    const envelope={kind:'POCKET_SCANNER_EVALUATION_V2_PRIVATE_RECORD',identity:recordIdentity(bound,record),
      rawBase64:Buffer.from(record.bytes).toString('base64')};
    const bytes=Buffer.from(JSON.stringify(envelope)),wrappedSha256=sha256(bytes);
    const ack=await physical.write({caseId:record.sourceCaseId,kind:record.kind,slot:record.slot,bytes,sha256:wrappedSha256,
      ...(record.kind==='provider-response'?{requestSha256:record.requestSha256,fingerprint:record.fingerprint}:{})});
    need(ack?.retained===true&&ack.sha256===wrappedSha256);
    return {...ack,sha256:record.sha256,wrappedSha256,logicalCaseId:record.caseId,physicalSourceCaseId:record.sourceCaseId};
  }});
}

/** Call only after official artifact/run/source provenance is independently
 * checked. Old bare responses and cross-scope wrappers are always rejected. */
export function openEvaluationArtifact({identity,record,wrappedSha256,...options}){
  const bound=validateEvaluationIdentity(identity),e=bound.evaluation;
  need(options.run?.repository===V2.repository&&options.run.runId===e.runId&&options.run.runAttempt==='1'&&options.run.sourceSha===bound.sourceSha);
  const bytes=openConfidentialRecord({...options,record:{kind:record.kind,slot:record.slot,caseId:e.sourceCaseId,
    sha256:wrappedSha256,...(record.kind==='provider-response'?{requestSha256:record.requestSha256,fingerprint:record.fingerprint}:{})}});
  const envelope=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
  need(exactKeys(envelope,['kind','identity','rawBase64'])&&envelope.kind==='POCKET_SCANNER_EVALUATION_V2_PRIVATE_RECORD'
    &&JSON.stringify(envelope.identity)===JSON.stringify(recordIdentity(bound,record))&&typeof envelope.rawBase64==='string');
  const raw=Buffer.from(envelope.rawBase64,'base64');need(raw.toString('base64')===envelope.rawBase64&&sha256(raw)===record.sha256);
  validateRecord(bound,{...record,bytes:raw});
  return raw;
}
