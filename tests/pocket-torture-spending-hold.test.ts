import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

test('preview holds even an authorised request before any billed dispatch', async () => {
  const source=await readFile(new URL('../app/api/pocket/torture/route.ts',import.meta.url),'utf8');
  const start=source.indexOf('  if (isBenchmarkPilotSpendHeld())');
  const end=source.indexOf('  if (params.get("result")',start);
  assert.ok(start>0);
  let calls=0;
  // Bind a callback after the guard as the would-be provider dispatch.
  const guarded=new Function('isBenchmarkPilotSpendHeld','NextResponse','requested','calls',source.slice(start,end)+'; calls(); return null;');
  const response=guarded(()=>true,{json:(body:unknown,options:{status:number})=>({body,...options})},'range-clear',()=>calls++);
  assert.equal(response.status,503);assert.equal(calls,0);
});
test('CLI holds before a model call even when a valid fixture was selected', async () => {
  const source=await readFile(new URL('../scripts/run-pocket-image-torture.ts',import.meta.url),'utf8');
  const start=source.indexOf('if (isBenchmarkPilotSpendHeld())');
  const end=source.indexOf('for(const sample',start);
  assert.ok(start>0);
  let calls=0;
  const run=new Function('isBenchmarkPilotSpendHeld','calls',source.slice(start,end)+'; calls();');
  assert.throws(()=>run(()=>true,()=>calls++),/pilot controls/i);assert.equal(calls,0);
});
