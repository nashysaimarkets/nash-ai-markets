/** Exact accepted app source, original-six material and new evaluation identity.
 * Import is inert. No credentials, network, corpus discovery or dispatch. */
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import vm from 'node:vm';
import {isDeepStrictEqual} from 'node:util';

export const V2=Object.freeze({scopeId:'pocket-scanner-evaluation-v2-20261024',
  appSourceSha:'2812bfbc6e8f62e93d0bc56957fd5ce71cc819dc',model:'gpt-5-mini-2025-08-07',
  originalBundleSha256:'8b7b3bb3cb0d7122cb6cad0b5936e12c5d5d3f83e725d5fd42c81e5ae1d4e2f0',
  originalManifestSha256:'df8b9e3eeaaaebff5197cbb13ddae45d362281cd3479ee398339953ab1293b21',
  oracleSha256:'06fd2b201ecefbda4c7746a24ea5c5470e8679fdee2740dcac81cd3c5f8dd424',
  protocolSha256:'4386a29b59718138437ddaf5d0a53b3c77f442acf161e8472aac45cee7773bf5',
  originalCommitmentsMicroUsd:1506400,caseBoundMicroUsd:330000,scopeBoundMicroUsd:1980000,
  aggregateCapMicroUsd:5000000,aggregateMaximumMicroUsd:3486400,
  repository:'nashysaimarkets/nash-ai-markets',project:'proj_LTmAIE2Ve7gUAFJ9M74ZxIBI',
  environment:'monaco-first-six-inference',keyTrackingId:'key_aD5pc20EZBLGECNC',
  keyFingerprintSha256:'107e0cb3265e15aa25e3fa49c91512096f84b43d5fa834761c73c3cce2c99d0e',
  backendRef:'neon:bitter-grass-28096464/br-aged-mode-zaa9u7lr/monaco_ledger'});
export const SLOTS=Object.freeze(['main','primary_precision','rescue_precision']);
export const CASE_IDS=Object.freeze(Array.from({length:6},(_,i)=>`v2-d00${i+1}`));
export const COSTS=Object.freeze({main:114000,primary_precision:108000,rescue_precision:108000});
export const APP_HASHES=Object.freeze({
  'app/api/pocket/analyse/route.ts':'7b47dcd1d25cc03213a3b0c9052fb24a10418c34f5ed76e5c06953a0c34d4ea7',
  'app/api/pocket/analysis-calibration.ts':'dfb8f2a93c290ff92adc389583b11cf1bc3103c5615454c0ce781ecdee1f0edb',
  'app/api/pocket/precision-fallback.ts':'a440dfd6d78aade5bbfb95e5ffdbe8e73d22e5cf72fc39355476e037725db711',
  'app/api/pocket/liquidity-chain.ts':'f4f3280c36782d74593d13c2df437f5be23c862a35be63ef53d7a6c275da9262',
  'app/pocket/liquidity-evidence.ts':'c294e785cbccc121e4b1a68556e20fbad7d8fc63487be64a47974d44f00c6a4f',
  'app/pocket/axis-verification.ts':'6e0a2e2d53cc062c9275107494ac658b217cf03e4e6f74756c4f48ec01c9f252',
  'scripts/pocket-monaco-internal-diagnostics.ts':'6a1296448dfd52de25ceedf19c8c5bcae606f762db6c5414f6ac618ea52269f7',
});
export const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
export const digest=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
export const commit=value=>typeof value==='string'&&/^[a-f0-9]{40}$/.test(value);
export const need=(ok,reason='V2_BOUNDARY_REFUSED')=>{if(!ok)throw Error(reason);};
export const sourceCaseId=caseId=>{need(CASE_IDS.includes(caseId));return caseId.slice(3);};
export const attemptId=caseId=>{sourceCaseId(caseId);return `${caseId}-attempt-1`;};
export const exactKeys=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)&&isDeepStrictEqual(Object.keys(value).sort(),[...keys].sort());
export const cut=(source,start,end)=>{const a=source.indexOf(start),b=source.indexOf(end,a);need(a>=0&&b>a);return source.slice(a,b);};
const root=new URL('../',import.meta.url);
export function verifyAppSources(){for(const [path,pin] of Object.entries(APP_HASHES))need(sha256(readFileSync(new URL(path,root)))===pin,`V2_APP_SOURCE_DRIFT:${path}`);return {...APP_HASHES};}
export function readAcceptedRoute(){verifyAppSources();return readFileSync(new URL('app/api/pocket/analyse/route.ts',root),'utf8');}

/** Exact SHA-pinned initializer slices in a fresh VM; no route import or effects. */
export function extractEvaluationRequests(input,caseId){
  const originalId=sourceCaseId(caseId),route=readAcceptedRoute();
  need(input&&input.intention==='UNSURE'&&input.chartConfirmation?.contextMatch==='NOT_PROVIDED'
    &&Object.keys(input).every(k=>['image','precisionImage','intention','chartConfirmation'].includes(k)));
  need(typeof input.image==='string'&&input.image.startsWith('data:image/png;base64,'));
  const constants=cut(route,'const schema =','export async function POST');
  const precisionInstructions=cut(route,'    const precisionInstructions =','    const precisionModel =');
  return Object.fromEntries(SLOTS.map(slot=>{
    const vars={model:V2.model,precisionModel:V2.model,image:input.image,chartImage:input.image,contextImage:'',
      intention:input.intention,chartConfirmation:input.chartConfirmation,accuracyCorrection:null,verifiedEvents:[],
      rescue:slot==='rescue_precision',readingCrop:slot==='rescue_precision'?(input.precisionImage??null):null};
    const setup=Object.entries(vars).map(([k,v])=>`const ${k}=${JSON.stringify(v)};`).join('\n');
    const declaration=slot==='main'?cut(route,'    const analysisEnvelope:','    const analysisRequest ='):
      cut(route,'      const precisionEnvelope:','      return dispatchPocketAnalysisProviderCall');
    const code=stripTypeScriptTypes(`${setup}\n${constants}\n${precisionInstructions}\n${declaration}\nJSON.stringify(${slot==='main'?'analysisEnvelope':'precisionEnvelope'});`);
    const envelope=JSON.parse(new vm.Script(code).runInContext(vm.createContext(Object.create(null),{codeGeneration:{strings:false,wasm:false}}),{timeout:1000}));
    validateEnvelope(envelope,slot);
    const bytes=Buffer.from(JSON.stringify(envelope,null,2)+'\n'),requestSha256=sha256(bytes);
    const requestId=`${caseId}-${slot}-${requestSha256.slice(0,16)}`;
    const fingerprint=scopedFingerprint({caseId,sourceCaseId:originalId,slot,requestSha256});
    return [slot,{bytes,requestId,requestSha256,fingerprint,maxOutputTokens:envelope.max_output_tokens,costBoundMicroUsd:COSTS[slot]}];
  }));
}
export function scopedFingerprint({caseId,sourceCaseId:originalId,slot,requestSha256}){
  need(sourceCaseId(caseId)===originalId&&SLOTS.includes(slot)&&digest(requestSha256));
  return sha256(JSON.stringify({scopeId:V2.scopeId,attemptId:attemptId(caseId),caseId,sourceCaseId:originalId,slot,requestSha256}));
}
export function validateEnvelope(body,slot){
  need(SLOTS.includes(slot)&&body?.model===V2.model&&body.store===false&&body.service_tier==='default'
    &&body.reasoning?.effort==='low'&&body.max_output_tokens===(slot==='main'?7000:4000)
    &&body.text?.format?.type==='json_schema'&&body.text.format.strict===true
    &&typeof body.instructions==='string'&&body.instructions.length<=30000);
  need(Array.isArray(body.input)&&body.input.length===1&&body.input[0]?.role==='user');
  const content=body.input[0].content;need(Array.isArray(content));
  const images=content.filter(c=>c.type==='input_image'),text=content.filter(c=>c.type==='input_text');
  need(images.length>=1&&images.length<=(slot==='rescue_precision'?2:1)&&text.length===1
    &&content.length===images.length+text.length&&typeof text[0].text==='string'
    &&body.instructions.length+text[0].text.length<=30000&&Buffer.byteLength(JSON.stringify(body.text.format))<=30000);
  for(const image of images){
    need(image.detail==='high'&&typeof image.image_url==='string'&&image.image_url.startsWith('data:image/png;base64,'));
    const b64=image.image_url.slice('data:image/png;base64,'.length),bytes=Buffer.from(b64,'base64');
    need(bytes.toString('base64')===b64&&bytes.length>=24&&bytes.length<=4000000
      &&bytes.subarray(0,8).toString('hex')==='89504e470d0a1a0a');
    const width=bytes.readUInt32BE(16),height=bytes.readUInt32BE(20);
    need(width>0&&height>0&&width<=4096&&height<=4096&&width*height<=16777216);
  }
  return body;
}
