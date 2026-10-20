import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {resolve,join} from 'node:path';
const root=resolve(process.argv[2]||'.');
const require=createRequire(join(root,'package.json'));
const ts=require('typescript');
const safe=process.argv.includes('--expect-safe');
const path=join(root,'app/pocket-next/PocketWorkflowDesk.tsx');
const source=await readFile(path,'utf8');
const parsed=ts.createSourceFile(path,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const wanted=['cancel','perform','load','scanLevels'];
const declarations=new Map();
function visit(node){
 if(ts.isVariableStatement(node))for(const declaration of node.declarationList.declarations){
  if(ts.isIdentifier(declaration.name)&&wanted.includes(declaration.name.text))declarations.set(declaration.name.text,node.getText(parsed));
 }
 ts.forEachChild(node,visit);
}
visit(parsed);
assert.equal(declarations.size,wanted.length,'actual handler declarations must be found');
const compiled=ts.transpileModule(wanted.map(name=>declarations.get(name)).join('\n')+'\nreturn {load,scanLevels};',{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText;
const deferred=()=>{let resolve;const promise=new Promise(done=>{resolve=done;});return {promise,resolve};};
const reading=deferred(),reply=deferred();
const state={image:'OLD_IMAGE',result:null,dispatches:0};
const oldReport={levels:[{price:'100',label:'OLD_IMAGE_RESULT',kind:'support'}]};
const noop=()=>{};
const bindings={
 generation:{current:0},pending:{current:null},pendingRoute:{current:''},labRevision:{current:0},sourceLoad:{current:null},
 setBusy:noop,setReading:noop,setNotice:noop,setError:noop,setAfter:noop,setReview:noop,setReviewPrivacy:noop,
 setCurrentLabRevision:noop,setLabImage:value=>{state.image=value;},setLabResult:value=>{state.result=value;},
 setLabStatus:noop,setLabFacts:noop,setLabPrivacy:noop,readWorkflowImage:async()=>reading.promise,
 labImage:'OLD_IMAGE',labFacts:{instrument:'US 500',timeframe:'5m',currentPrice:'100',contextMatch:'NOT_PROVIDED'},labPrivacy:true,labStatus:'LOCKED',
 preflightAllowsAnalysis:()=>true,createPrecisionReadingCrop:async()=>null,
 pocketAuthenticatedFetch:async()=>{state.dispatches++;return reply.promise;},
};
const handlers=new Function(...Object.keys(bindings),compiled)(...Object.values(bindings));
const loading=handlers.load({name:'replacement.png'},'lab');
const request=handlers.scanLevels();
await Promise.resolve();await Promise.resolve();await Promise.resolve();
reading.resolve('NEW_IMAGE');await loading;
reply.resolve({ok:true,json:async()=>({levels:oldReport})});await request;
assert.equal(state.image,'NEW_IMAGE','replacement actually commits');
if(safe){
 assert.equal(state.dispatches,0,'pending replacement must block old-source dispatch');
 assert.equal(state.result,null,'old response cannot populate replacement');
}else{
 assert.equal(state.dispatches,1,'baseline must reproduce old-source dispatch');
 assert.equal(state.result,oldReport,'baseline must reproduce old report after replacement');
}
console.log(JSON.stringify({actualHandlers:path,mode:safe?'SAFE_REQUIRED':'BASELINE_REPRODUCED',...state}));
