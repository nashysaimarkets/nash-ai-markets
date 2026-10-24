import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {stripTypeScriptTypes} from 'node:module';
const user={id:'00000000-0000-4000-8000-000000000001',email:'fixture@example.invalid',email_confirmed_at:'2026-01-01T00:00:00Z',is_anonymous:false};
async function run(identity:unknown,proof='',entitled=true,fail=false){
 const source=await readFile(new URL('../app/api/pocket/apple-account/route.ts',import.meta.url),'utf8');
 const body=source.slice(source.indexOf('export async function GET')).replace('export async function','async function');let calls=0;
 const handler=new Function('createClient','hasPocketAppleSubscription',stripTypeScriptTypes(body)+';return GET;')(
 async()=>({auth:{getUser:async()=>({data:{user:identity},error:null})}}),async(id:string)=>{calls++;assert.equal(id,user.id);if(fail)throw Error('unavailable');return entitled;});
 const response=await handler(new Request('http://localhost/api/pocket/apple-account',{headers:proof?{'x-pocket-apple-transaction':proof}:{}}));return{response,body:await response.json(),calls};
}
for(const [name,identity] of [['absent',null],['anonymous',{...user,is_anonymous:true}],['email absent',{...user,email:''}],['unconfirmed',{...user,email_confirmed_at:null}]])test(`Apple account rejects ${name} before verifier`,async()=>{const r=await run(identity);assert.equal(r.response.status,401);assert.equal(r.calls,0);assert.equal(r.response.headers.get('cache-control'),'private, no-store');assert.equal(r.body.appAccountToken,undefined);});
for(const entitled of [false,true])test(`verified account preserves entitled=${entitled}`,async()=>{const r=await run(user,'',entitled);assert.equal(r.response.status,200);assert.equal(r.body.appAccountToken,user.id);assert.equal(r.body.entitled,entitled);assert.equal(r.calls,1);});
test('oversized proof rejected before verifier',async()=>{const r=await run(user,'x'.repeat(16001));assert.equal(r.response.status,400);assert.equal(r.calls,0);});
test('verifier unavailable does not expose account token',async()=>{const r=await run(user,'',false,true);assert.equal(r.response.status,503);assert.equal(r.body.appAccountToken,undefined);});
