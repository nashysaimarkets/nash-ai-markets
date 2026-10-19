import assert from 'node:assert/strict';
import { writeFile, readFile, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const [rootArg,sha,outArg]=process.argv.slice(2);
assert.match(sha??'',/^[a-f0-9]{40}$/);
const root=resolve(rootArg),out=resolve(outArg);
// Child-process offline evidence only. Never use a signed-in/public runtime.
for(const key of Object.keys(process.env))if(/OPENAI|STRIPE|SUPABASE|TOKEN|SECRET|API_KEY|VERCEL_GIT_COMMIT_SHA/.test(key))delete process.env[key];
process.env.GIT_COMMIT_SHA=sha;
globalThis.fetch=async()=>{throw Error('Outbound request prohibited in packaged offline QA');};
const {default:worker}=await import(pathToFileURL(join(root,'dist/server/index.js')));
assert.equal(typeof worker.fetch,'function');
const env={GIT_COMMIT_SHA:sha};const ctx={waitUntil(){},passThroughOnException(){}};
const cases=[];
let response=await worker.fetch(new Request('https://preview.invalid/api/pocket/build-manifest'),env,ctx);
assert.equal(response.status,200);const body=await response.json();assert.equal(body.revision,sha);
cases.push({name:'exact packaged build identity',status:response.status,revision:body.revision});
for(const c of [
 {name:'plaintext localhost lookalike',origin:'http://localhost.attacker.invalid',expected:403},
 {name:'invalid form',origin:'https://preview.invalid',expected:400,contentType:'application/json'},
 {name:'cancel before dispatch',origin:'https://preview.invalid',expected:409,abort:true},
]){
 const controller=new AbortController();if(c.abort)controller.abort();
 response=await worker.fetch(new Request(c.origin+'/api/stripe/checkout',{method:'POST',headers:{origin:c.origin,'content-type':c.contentType??'application/x-www-form-urlencoded'},body:'offering=pocket_founding_month',signal:controller.signal}),env,ctx);
 assert.equal(response.status,c.expected);cases.push({name:c.name,status:response.status});
}
await writeFile(join(out,'packaged-worker-'+sha.slice(0,7)+'.json'),JSON.stringify({scope:'Actual in-process packaged Worker; no credentials/public runtime/provider; outbound fetch prohibited',sourceSha:sha,cases,result:'PASS'},null,2)+'\n');
console.log('PASS: packaged exact identity + origin/form/pre-dispatch cancellation; four cases; outbound prohibited.');
