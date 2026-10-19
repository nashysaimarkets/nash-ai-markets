import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';

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

test('immediate POST measurement must pass final database release veto', async () => {
  const source=await readFile(new URL('../app/api/pocket/torture/route.ts',import.meta.url),'utf8');
  const start=source.lastIndexOf('  await recordPocketBenchmarkMeasurement(requested, measurement);');
  const end=source.indexOf('\n}',start);
  assert.ok(start>0 && end>start,'benchmark POST tail not found');
  const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
  const helperStart=source.indexOf('function publishedLedgerMeasurement(');
  const helperEnd=source.indexOf('\ntype Analysis=',helperStart);
  assert.ok(helperStart>0 && helperEnd>helperStart,'real published measurement helper not found');
  const publishedLedgerMeasurement=new Function(stripTypeScriptTypes(source.slice(helperStart,helperEnd))+'; return publishedLedgerMeasurement;')();
  const run=new AsyncFunction('recordPocketBenchmarkMeasurement','releasePocketBenchmarkMeasurement',
    'requested','measurement','reconciled','committedMicroUsd','NextResponse','benchmarkHttpStatus','publishedLedgerMeasurement',
    source.slice(start,end));
  const responses={json:(body:unknown,opts:{status:number})=>({body,...opts})};
  let releases=0;
  const record=async()=>true;
  const deny=async()=>{releases++;return {released:false}};
  const blocked=await run(record,deny,'range-clear',{pass:true},true,2000,responses,200);
  assert.equal(blocked.status,409);
  assert.deepEqual(blocked.body,{caseId:'range-clear',status:'PENDING_AUTHORITATIVE_SETTLEMENT',scored:false});
  assert.equal(releases,1);
  const hold=await run(record,deny,'range-clear',{pass:true},false,null,responses,200);
  assert.equal(hold.status,202);
  assert.equal(releases,1,'unsettled case must not attempt release');
  const allow=async()=>({released:true,measurement:{provenance:'settled',pass:false}});
  const released=await run(record,allow,'range-clear',{pass:true},true,2000,responses,422,publishedLedgerMeasurement);
  assert.equal(released.status,422);
  assert.deepEqual(released.body,{provenance:'settled',pass:false,ledgerReleaseVerified:true,ledgerCaseId:'range-clear'});
  for (const measurement of [undefined,null,[],true,'invalid']) {
    await assert.rejects(()=>run(record,async()=>({released:true,measurement}),'range-clear',{pass:true},true,2000,responses,200,publishedLedgerMeasurement),/valid case measurement/);
  }
});


test('CLI measurement publication must pass the final database release veto', async () => {
  const source=await readFile(new URL('../scripts/run-pocket-image-torture.ts',import.meta.url),'utf8');
  assert.match(source,/import \{[^}]*releasePocketBenchmarkMeasurement[^}]*\} from/);
  const helperStart=source.indexOf('async function finalCliLedgerMeasurement(');
  const helperEnd=source.indexOf('\ntype Counts =',helperStart);
  assert.ok(helperStart>0 && helperEnd>helperStart,'CLI final release helper not found');
  let releases=0;
  const deny=async()=>{releases++;return {released:false};};
  const finalCliLedgerMeasurement=new Function('releasePocketBenchmarkMeasurement',
    stripTypeScriptTypes(source.slice(helperStart,helperEnd))+'; return finalCliLedgerMeasurement;'
  )(deny) as (caseId:string,reconciled:boolean)=>Promise<Record<string,unknown>|null>;

  assert.equal(await finalCliLedgerMeasurement('range-clear',false),null);
  assert.equal(releases,0,'unreconciled case must not attempt final release');
  assert.equal(await finalCliLedgerMeasurement('range-clear',true),null);
  assert.equal(releases,1,'reconciled case must perform exactly one final release check');

  const allow=new Function('releasePocketBenchmarkMeasurement',
    stripTypeScriptTypes(source.slice(helperStart,helperEnd))+'; return finalCliLedgerMeasurement;'
  )(async()=>({released:true,measurement:{pass:false,provenance:'settled'}})) as typeof finalCliLedgerMeasurement;
  assert.deepEqual(await allow('range-clear',true),{
    pass:false,provenance:'settled',ledgerReleaseVerified:true,ledgerCaseId:'range-clear',
  });

  for (const measurement of [undefined,null,[],true,'invalid']) {
    const malformed=new Function('releasePocketBenchmarkMeasurement',
      stripTypeScriptTypes(source.slice(helperStart,helperEnd))+'; return finalCliLedgerMeasurement;'
    )(async()=>({released:true,measurement})) as typeof finalCliLedgerMeasurement;
    await assert.rejects(()=>malformed('range-clear',true),/valid case measurement/);
  }
});


test('CLI zero-measurement failure emits only an explicit unscored marker', async () => {
  const source=await readFile(new URL('../scripts/run-pocket-image-torture.ts',import.meta.url),'utf8');
  const branch=source.indexOf('}else{\n  console.log("IMAGE_TORTURE_UNSCORED"');
  const bodyStart=source.indexOf('\n',branch)+1;
  const bodyEnd=source.indexOf('\n}\nif(failures.length)',bodyStart);
  assert.ok(branch>0 && bodyStart>branch && bodyEnd>bodyStart,'zero-measurement branch not found');
  const calls:unknown[][]=[];
  const state:{exitCode?:number}={};
  new Function('summary','console','process',source.slice(bodyStart,bodyEnd))(
    {measurementComplete:false,measuredCases:0},
    {log:(...args:unknown[])=>calls.push(args)},
    state,
  );
  assert.equal(state.exitCode,1);
  assert.equal(calls.length,1);
  assert.equal(calls[0]![0],'IMAGE_TORTURE_UNSCORED');
  assert.doesNotMatch(calls.flat().join(' '),/IMAGE_TORTURE_MEASUREMENTS/);
  const payload=JSON.parse(String(calls[0]![1])) as Record<string,unknown>;
  assert.equal(payload.scored,false);
  assert.equal(payload.reason,'NO_SUCCESSFUL_MEASUREMENT');
  assert.equal(payload.measuredCases,0);
});
