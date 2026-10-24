import test from 'node:test';
import assert from 'node:assert/strict';
import {createGitHubEnvelopeReceiver,RELAY_MAX_POLLS,RELAY_POLL_INTERVAL_MS}
  from '../scripts/pocket-monaco-github-input-relay.mjs';
import {runHostedFirstSix} from '../scripts/pocket-monaco-hosted-entry.mjs';

const REPO='nashysaimarkets/nash-ai-markets';
const API=`https://api.github.com/repos/${REPO}`;
const RUN={repository:REPO,runId:'123456',runAttempt:'1',sourceSha:'a'.repeat(40)};
const COMMIT='b'.repeat(40), BUNDLE='c'.repeat(64);
const BRANCH=`monaco-first-six-input-${RUN.runId}`;
const REF=`${API}/git/ref/heads/${BRANCH}`;
const CONTENT=`${API}/contents/input.envelope.json?ref=${COMMIT}`;
const TOKEN='synthetic-contents-read-token';
const refused=/^GITHUB_INPUT_RELAY_REFUSED$/;
function args(overrides={}) {
  return {run:{...RUN},publicHandoff:{kind:'MONACO_FIRST_SIX_INPUT_HANDOFF_V1',...RUN,bundleSha256:BUNDLE},
    expectedBundleSha256:BUNDLE,timeoutMs:300000,maxEnvelopeBytes:1024,
    signal:new AbortController().signal,...overrides};
}
function ref(overrides={}) {
  return {ref:`refs/heads/${BRANCH}`,url:`${API}/git/refs/heads/${BRANCH}`,
    object:{type:'commit',sha:COMMIT,url:`${API}/git/commits/${COMMIT}`},...overrides};
}
function response(url,{status=200,body='ciphertext',headers={},redirected=false,chunks,cancel}={}) {
  const raw=url.includes('/contents/');
  const parts=chunks??[Buffer.from(typeof body==='string'?body:JSON.stringify(body))];
  let index=0;
  return {url,status,redirected,headers:new Headers({'content-type':raw?'application/octet-stream':'application/json',
    'x-github-request-id':'ABCD:1234:5678','x-github-media-type':raw?'github.v3; param=raw; format=json':'github.v3; format=json',...headers}),
    body:new ReadableStream({pull(controller){if(index<parts.length)controller.enqueue(parts[index++]);else controller.close();},
      cancel(){cancel?.();}})};
}
function harness(fetchImpl) {
  let clock=0;const waits=[];
  const receiver=createGitHubEnvelopeReceiver({token:TOKEN},{fetchImpl,now:()=>clock,
    sleepImpl:async(ms,signal)=>{assert.equal(signal.aborted,false);waits.push(ms);clock+=ms;}});
  return {receiver,waits,advance(ms){clock+=ms;}};
}
async function expectRefusal(promise) {await assert.rejects(promise,error=>refused.test(error.message));}

test('polls only missing run ref, freezes one commit, fetches one raw ciphertext and uses only GET',async()=>{
  const calls=[];
  const h=harness(async(url,options)=>{
    calls.push({url,options});
    if(calls.length===1)return response(url,{status:404,body:{message:'Not Found'}});
    if(url===REF)return response(url,{body:ref()});
    assert.equal(url,CONTENT);return response(url,{body:'encrypted-only'});
  });
  assert.equal((await h.receiver(args())).toString(),'encrypted-only');
  assert.deepEqual(calls.map(x=>x.url),[REF,REF,CONTENT]);
  assert.deepEqual(h.waits,[10000]);
  for(const {url,options} of calls){assert.ok(url.startsWith(API+'/'));assert.equal(options.method,'GET');
    assert.equal(options.redirect,'error');assert.equal(options.headers.Authorization,`Bearer ${TOKEN}`);
    assert.equal(options.headers['Accept-Encoding'],'identity');assert.equal(options.signal.aborted,true);}
  assert.equal(calls[2].options.headers.Accept,'application/vnd.github.raw+json');
});

test('missing ref is bounded by30 lookups and29 ten-second waits',async()=>{
  let calls=0;const h=harness(async url=>{calls++;return response(url,{status:404});});
  await expectRefusal(h.receiver(args()));
  assert.equal(calls,RELAY_MAX_POLLS);assert.equal(h.waits.length,29);
  assert.ok(h.waits.every(ms=>ms>=RELAY_POLL_INTERVAL_MS));
});

test('short accepted deadline cannot be stretched to the poll cap',async()=>{
  let calls=0;const h=harness(async url=>{calls++;return response(url,{status:404});});
  await expectRefusal(h.receiver(args({timeoutMs:20000})));
  assert.equal(calls,2);assert.deepEqual(h.waits,[10000]);
});

test('non404 errors and malformed ref provenance never cause a second request',async()=>{
  for(const variant of [
    {status:429},{status:500},{status:403},{status:302},
    {body:ref({ref:'refs/heads/another-run'})},
    {body:ref({object:{type:'tag',sha:COMMIT,url:`${API}/git/commits/${COMMIT}`}})},
    {body:ref({object:{type:'commit',sha:COMMIT,url:'https://elsewhere.invalid/'}})},
    {body:ref(),redirected:true},{body:ref(),headers:{'x-github-request-id':''}},
    {body:ref(),headers:{'content-encoding':'gzip'}},
    {body:ref(),headers:{'content-type':'text/html'}}
  ]){
    let calls=0;const h=harness(async url=>{calls++;return response(url,variant);});
    await expectRefusal(h.receiver(args()));assert.equal(calls,1);assert.equal(h.waits.length,0);
  }
});

test('foreign response URL is refused and no token is sent beyond fixed endpoints',async()=>{
  let calls=0;const h=harness(async url=>{calls++;assert.equal(url,REF);return response('https://elsewhere.invalid/',{body:ref()});});
  await expectRefusal(h.receiver(args()));assert.equal(calls,1);
});

test('first found ref consumes its immutable content attempt even when content is missing',async()=>{
  const urls=[];const h=harness(async url=>{urls.push(url);return response(url,url===REF?{body:ref()}:{status:404});});
  await expectRefusal(h.receiver(args()));assert.deepEqual(urls,[REF,CONTENT]);assert.deepEqual(h.waits,[]);
  await expectRefusal(h.receiver(args()));assert.equal(urls.length,2);
});

test('declared and streamed ciphertext sizes are bounded and partial content is discarded',async()=>{
  for(const variant of [
    {headers:{'content-length':'10000'}},{chunks:[Buffer.alloc(700),Buffer.alloc(700)]},
    {headers:{'content-length':'9'},body:'short'},{headers:{'content-length':'0'},body:''},
    {headers:{'content-length':'01'}},{body:''}
  ]){
    let calls=0;const h=harness(async url=>{calls++;return response(url,url===REF?{body:ref()}:variant);});
    await expectRefusal(h.receiver(args()));assert.equal(calls,2);
  }
});

test('unexpected raw-media headers stop instead of treating a JSON API wrapper as ciphertext',async()=>{
  const h=harness(async url=>response(url,url===REF?{body:ref()}:{headers:{'x-github-media-type':'github.v3; format=json'}}));
  await expectRefusal(h.receiver(args()));
});

test('mismatched run or bundle binding and already aborted signals never fetch',async()=>{
  const aborted=new AbortController();aborted.abort();
  for(const variant of [{run:{...RUN,runAttempt:'2'}},{run:{...RUN,repository:'another/repo'}},
    {run:{...RUN,runId:'../123'}},{expectedBundleSha256:'d'.repeat(64)},
    {timeoutMs:300001},{signal:aborted.signal},{maxEnvelopeBytes:1024*1024*1024}]){
    let calls=0;const h=harness(async()=>{calls++;throw Error('must not fetch');});
    await expectRefusal(h.receiver(args(variant)));assert.equal(calls,0);
  }
});

test('abort stops an outstanding fetch and suppresses raw transport error detail',async()=>{
  const controller=new AbortController();let calls=0;
  const receiver=createGitHubEnvelopeReceiver({token:TOKEN},{fetchImpl:async(_url,options)=>{
    calls++;queueMicrotask(()=>controller.abort());
    return new Promise((_resolve,reject)=>options.signal.addEventListener('abort',()=>reject(Error(TOKEN)),{once:true}));
  }});
  await expectRefusal(receiver(args({signal:controller.signal})));assert.equal(calls,1);
});

test('receiver enforces real deadline even when a fetch promise ignores cancellation',async()=>{
  let calls=0;const receiver=createGitHubEnvelopeReceiver({token:TOKEN},{fetchImpl:()=>{calls++;return new Promise(()=>{});}});
  await expectRefusal(receiver(args({timeoutMs:20})));assert.equal(calls,1);
});

test('a successfully consumed receiver cannot read a second envelope',async()=>{
  let calls=0;const h=harness(async url=>{calls++;return response(url,url===REF?{body:ref()}:{body:'one'});});
  assert.equal((await h.receiver(args())).toString(),'one');
  await expectRefusal(h.receiver(args()));assert.equal(calls,2);
});

test('hosted entry needs exactly the explicit one-shot flag and performs no load otherwise',async()=>{
  for(const argv of [[],['--run-once','again'],['--retry'],null]){
    const result=await runHostedFirstSix({env:{},argv},{loadInputs(){throw Error('must not load');}});
    assert.equal(result.status,'HOLD');assert.equal(result.bootstrapInvocations,0);assert.equal(result.transportSendAttempts,0);
  }
});

test('hosted entry awaits pinned runtime and wires only the exact protected credential names',async()=>{
  const signal=new AbortController().signal;
  const env={GITHUB_TOKEN:'fake-read-token',RUNNER_TEMP:'/runner/temp',MONACO_FIRST_SIX_OPENAI_API_KEY:'synthetic-inference',
    MONACO_FIRST_SIX_LEDGER_KEY:'synthetic-ledger',OPENAI_API_KEY:'forbidden-fallback'};
  const receiver=()=>{},runtime={accepted:true};const sequence=[];
  const result=await runHostedFirstSix({env,argv:['--run-once'],signal},{
    loadInputs(actual){assert.equal(actual,env);sequence.push('inputs');return {context:{pinned:true}};},
    createReceiver({token}){assert.equal(token,env.GITHUB_TOKEN);sequence.push('receiver');return receiver;},
    async loadRuntime(path){assert.equal(path,env.RUNNER_TEMP);await Promise.resolve();sequence.push('runtime');return runtime;},
    async execute(args){assert.equal(args.receiveInputOnce,receiver);assert.equal(args.runtime,runtime);assert.equal(args.signal,signal);
      assert.deepEqual(args.credentials,{existingKey:'synthetic-inference',ledgerPassword:'synthetic-ledger'});
      sequence.push('execute');return {status:'HOLD'};}
  });
  assert.equal(result.status,'HOLD');assert.deepEqual(sequence,['inputs','receiver','runtime','execute']);
});

test('unexpected post-entry failure is uncertain and never leaks exception text',async()=>{
  const result=await runHostedFirstSix({env:{},argv:['--run-once']},{loadInputs:()=>({}),createReceiver:()=>()=>{},
    loadRuntime:async()=>({}),execute:async()=>{throw Error(TOKEN);}});
  assert.equal(result.status,'UNCERTAIN');assert.equal(result.transportSendAttempts,null);
  assert.ok(!JSON.stringify(result).includes(TOKEN));
});
