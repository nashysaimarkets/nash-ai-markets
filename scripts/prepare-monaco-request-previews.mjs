/** Offline request objects from pinned route initializers; no route import or dispatch. */
import {createHash} from 'node:crypto';
import {readFile,writeFile,mkdir,realpath,stat} from 'node:fs/promises';
import {resolve,relative,isAbsolute,join} from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';

const SOURCE_SHA256='5a59b0cde257ad8ab885af9c9171198fe9732ad3a286efda301c6226903b7294';
const MODEL='gpt-5-mini-2025-08-07';
const hash=b=>createHash('sha256').update(b).digest('hex');
const args=process.argv.slice(2);
if(args.length!==4||args[0]!=='--packet'||args[2]!=='--out')throw Error('Usage: --packet /private/packet --out /private/new-preview-directory');
const source=await readFile(new URL('../app/api/pocket/analyse/route.ts',import.meta.url),'utf8');
if(hash(source)!==SOURCE_SHA256)throw Error('Route source changed: independent review required before extraction');
const ast=ts.createSourceFile('route.ts',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
const required=['schema','precisionOverlaySchema','precisionInstructions','analysisEnvelope','precisionEnvelope'];
const declarations=new Map();
function visit(node){
  if(ts.isVariableDeclaration(node)&&ts.isIdentifier(node.name)&&required.includes(node.name.text)){
    if(declarations.has(node.name.text)||!node.initializer)throw Error('Ambiguous route initializer');
    declarations.set(node.name.text,node.initializer.getText(ast));
  }
  ts.forEachChild(node,visit);
}
visit(ast);
if(declarations.size!==required.length)throw Error('Required route initializer missing');
const root=await realpath(resolve(args[1]));
const packet=JSON.parse(await readFile(join(root,'SIX-CASE-INTAKE.json'),'utf8'));
if(packet.dispatchAuthorised!==false||packet.acceptedCases!==0||packet.cases?.length!==6)throw Error('Only unaccepted six-case intake previews supported');
async function artifact(path,sha){
  if(typeof path!=='string'||isAbsolute(path))throw Error('Relative artifact path required');
  const actual=await realpath(resolve(root,path));const rel=relative(root,actual);
  if(!rel||rel.startsWith('..')||isAbsolute(rel)||(await stat(actual)).size>40_000_000)throw Error('Artifact outside preview bounds');
  const bytes=await readFile(actual);if(hash(bytes)!==sha)throw Error('Artifact hash mismatch');return bytes;
}
const outputs=[];const cases=new Set();
for(const c of packet.cases){
  if(!/^[a-z0-9-]{1,80}$/.test(c.caseId)||cases.has(c.caseId))throw Error('Invalid or duplicate case identity');cases.add(c.caseId);
  const input=JSON.parse((await artifact(c.inputPath,c.inputSha256)).toString('utf8'));
  if(Object.keys(input).some(k=>!['image','precisionImage','intention','chartConfirmation'].includes(k))||input.intention!=='UNSURE'||input.chartConfirmation?.contextMatch!=='NOT_PROVIDED')throw Error('Unsupported input preview scope');
  const original=await artifact(c.imagePath,c.rasterSha256);
  if(!/^data:image\/png;base64,/.test(input.image)||!Buffer.from(input.image.split(',')[1],'base64').equals(original))throw Error('Original bytes mismatch');
  for(const slot of ['main','primary_precision','rescue_precision']){
    const vars={model:MODEL,precisionModel:MODEL,image:input.image,chartImage:input.image,contextImage:'',intention:input.intention,chartConfirmation:input.chartConfirmation,accuracyCorrection:null,verifiedEvents:[],rescue:slot==='rescue_precision',readingCrop:slot==='rescue_precision'?(input.precisionImage??null):null};
    // Evaluate only known pure initializer expressions from the SHA-pinned source.
    // No process, imports, provider client, auth bypass, macro fetch or network API.
    const setup=Object.entries(vars).map(([k,v])=>`const ${k}=${JSON.stringify(v)};`).join('\n');
    const constants=['schema','precisionOverlaySchema','precisionInstructions'].map(k=>`const ${k}=${declarations.get(k)};`).join('\n');
    const expression=declarations.get(slot==='main'?'analysisEnvelope':'precisionEnvelope');
    const js=ts.transpileModule(`${setup}\n${constants}\nJSON.stringify(${expression});`,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText;
    const context=vm.createContext(Object.create(null),{codeGeneration:{strings:false,wasm:false}});
    const envelope=JSON.parse(new vm.Script(js).runInContext(context,{timeout:1000}));
    if(envelope.model!==MODEL||envelope.store!==false||envelope.service_tier!=='default'||envelope.reasoning?.effort!=='low'||envelope.max_output_tokens!==(slot==='main'?7000:1400))throw Error('Unexpected pinned envelope');
    const bytes=Buffer.from(JSON.stringify(envelope,null,2)+'\n');
    const content=envelope.input[0].content;
    const images=content.filter(x=>x.type==='input_image').map(x=>{
      const b=Buffer.from(x.image_url.split(',')[1],'base64');
      if(x.detail!=='high'||b.subarray(0,8).toString('hex')!=='89504e470d0a1a0a')throw Error('PNG high-detail preview required');
      return {sha256:hash(b),bytes:b.length,width:b.readUInt32BE(16),height:b.readUInt32BE(20)};
    });
    const fingerprint=hash(JSON.stringify(envelope,(_k,v)=>typeof v==='string'&&v.startsWith('data:image/')?`sha256:${hash(v)}`:v));
    outputs.push({bytes,receipt:{caseId:c.caseId,slot,path:`${c.caseId}.${slot}.request-preview.json`,inputSha256:c.inputSha256,envelopeFileSha256:hash(bytes),providerSpendFingerprint:fingerprint,model:MODEL,maxOutputTokens:envelope.max_output_tokens,textChars:envelope.instructions.length+content.filter(x=>x.type==='input_text').reduce((n,x)=>n+x.text.length,0),schemaBytes:Buffer.byteLength(JSON.stringify(envelope.text.format)),images,costUpperBoundMicroUsd:null}});
  }
}
const out=resolve(args[3]);await mkdir(out,{mode:0o700});
for(const o of outputs)await writeFile(join(out,o.receipt.path),o.bytes,{flag:'wx',mode:0o600});
const receipt={status:'OFFLINE_REQUEST_PREVIEWS_NOT_ADMITTED',routeSha256:SOURCE_SHA256,model:MODEL,assumptions:{macroEvents:[],macroPolicy:'PROPOSED_HISTORICAL_OFFLINE_CONTEXT_REQUIRES_EXECUTOR_REVIEW',contextImage:'ABSENT',accuracyCorrection:'ABSENT',inputFacts:'PROVISIONAL_REVIEW_PENDING'},calls:outputs.map(o=>o.receipt),requestsPrepared:outputs.length,providerCalls:0,paidDispatchAuthorised:false,limitations:['No provider response or scanner measurement','Not live executor attestation or financial bounds','Macro/context/model changes invalidate fingerprints; future execution must match reviewed exact request objects','Three slots per case are possible paths, not proof they will all run']};
await writeFile(join(out,'REQUEST-PREVIEWS.json'),JSON.stringify(receipt,null,2)+'\n',{flag:'wx',mode:0o600});
console.log(JSON.stringify(receipt,null,2));
