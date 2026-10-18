import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";

test("Pocket identity endpoint exposes only the server-verified user's UUID and denies missing/unverified/anonymous sessions", async () => {
 const source=await readFile(new URL('../app/api/pocket/account/route.ts',import.meta.url),'utf8');
 const body=source.slice(source.indexOf('export async function GET')).replace('export async function','async function');
 const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
 const user={id:'11111111-1111-4111-8111-111111111111',email:'qa@example.invalid',email_confirmed_at:'2026-10-18',is_anonymous:false};
 for(const candidate of [null,{...user,email_confirmed_at:null},{...user,is_anonymous:true},user]) {
  const get=await new AsyncFunction('createClient',stripTypeScriptTypes(body)+'\nreturn GET;')(async()=>({auth:{getUser:async()=>({data:{user:candidate},error:null})}}));
  const response=await get(new Request('https://pocket.nashaimarkets.com/api/pocket/account?user_id=attacker'));
  assert.equal(response.status,candidate===user?200:401);
  assert.deepEqual(await response.json(),candidate===user?{user_id:user.id,verified:true}:{code:'POCKET_LOGIN_REQUIRED'});
  assert.equal(response.headers.get('cache-control'),'private, no-store');
  assert.equal(response.headers.get('vary'),'Cookie');
 }
 const unavailable=await new AsyncFunction('createClient',stripTypeScriptTypes(body)+'\nreturn GET;')(async()=>{throw new Error('offline');});
 assert.equal((await unavailable()).status,503);
});
