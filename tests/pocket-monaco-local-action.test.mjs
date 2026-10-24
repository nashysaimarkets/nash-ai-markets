import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {mkdirSync,mkdtempSync,realpathSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import action from '../.github/actions/monaco-first-six/entry.cjs';

function fixture() {
  const sourceRoot=mkdtempSync(join(tmpdir(),'monaco-local-action-'));
  mkdirSync(join(sourceRoot,'scripts'));
  writeFileSync(join(sourceRoot,'scripts/pocket-monaco-hosted-entry.mjs'),'// Synthetic fixture; never executed.\n');
  const env={ACTIONS_RUNTIME_TOKEN:'synthetic-runtime-token',ACTIONS_RESULTS_URL:'https://example.invalid/',
    GITHUB_RETENTION_DAYS:'7',MONACO_PINNED_NODE_EXECUTABLE:process.execPath,
    NODE_OPTIONS:'--require=unreviewed-preload.cjs',NODE_PATH:'/unreviewed/modules'};
  const signals=new EventEmitter(),child=new EventEmitter(),calls={probe:[],spawn:[],kill:[]};
  child.kill=signal=>{calls.kill.push(signal);return true;};
  return {sourceRoot,env,signals,child,calls,
    probeProcess(...args){calls.probe.push(args);return {
      status:0,signal:null,stdout:'v24.19.0\n',stderr:''};},
    spawnProcess(...args){calls.spawn.push(args);return child;},
    cleanup(){rmSync(sourceRoot,{recursive:true,force:true});}};
}

test('missing artifact runtime credentials and insufficient retention fail before spawning any binary',async()=>{
  for (const change of [{ACTIONS_RUNTIME_TOKEN:''},{ACTIONS_RESULTS_URL:undefined},
    {ACTIONS_RESULTS_URL:'http://example.invalid/'},{GITHUB_RETENTION_DAYS:undefined},
    {GITHUB_RETENTION_DAYS:'6'},{MONACO_PINNED_NODE_EXECUTABLE:'node'}]) {
    const f=fixture();try {Object.assign(f.env,change);await assert.rejects(action.runLocalAction(f));
      assert.equal(f.calls.probe.length,0);assert.equal(f.calls.spawn.length,0);
    } finally {f.cleanup();}
  }
});

test('an incorrect or failed real-version probe prevents the hosted entry from starting',async()=>{
  for (const probe of [{status:0,signal:null,stdout:'v24.18.0\n',stderr:''},
    {status:1,signal:null,stdout:'v24.19.0\n',stderr:'synthetic-secret-error'},
    {status:null,signal:'SIGTERM',stdout:'',stderr:''}]) {
    const f=fixture();try {f.probeProcess=()=>probe;await assert.rejects(action.runLocalAction(f));
      assert.equal(f.calls.spawn.length,0);
    } finally {f.cleanup();}
  }
});

test('only the pinned binary and fixed entry are launched; runtime credentials remain inherited and signals are forwarded',async()=>{
  const f=fixture();try {
    const pending=action.runLocalAction(f);
    assert.equal(f.calls.probe.length,1);assert.equal(f.calls.spawn.length,1);
    const [binary,args,options]=f.calls.spawn[0];
    assert.equal(binary,realpathSync(process.execPath));
    assert.deepEqual(args,[join(realpathSync(f.sourceRoot),'scripts/pocket-monaco-hosted-entry.mjs'),'--run-once']);
    assert.equal(options.stdio,'inherit');assert.equal(options.shell,false);
    assert.equal(options.env.ACTIONS_RUNTIME_TOKEN,f.env.ACTIONS_RUNTIME_TOKEN);
    assert.equal(options.env.ACTIONS_RESULTS_URL,f.env.ACTIONS_RESULTS_URL);
    assert.equal(options.env.NODE_OPTIONS,undefined);assert.equal(options.env.NODE_PATH,undefined);
    assert.equal(f.env.NODE_OPTIONS,'--require=unreviewed-preload.cjs');
    f.signals.emit('SIGINT');f.signals.emit('SIGTERM');assert.deepEqual(f.calls.kill,['SIGINT','SIGTERM']);
    f.child.emit('close',1,null);assert.equal(await pending,1);
    assert.equal(f.signals.listenerCount('SIGINT'),0);assert.equal(f.signals.listenerCount('SIGTERM'),0);
  } finally {f.cleanup();}
});

test('child errors fail without leaking text and signal exits remain failures',async()=>{
  for (const event of ['error','signal']) {
    const f=fixture();try {const pending=action.runLocalAction(f);
      if (event==='error') f.child.emit('error',Error(f.env.ACTIONS_RUNTIME_TOKEN));
      else f.child.emit('close',null,'SIGTERM');
      assert.equal(await pending,event==='error'?1:143);
      assert.equal(f.signals.listenerCount('SIGTERM'),0);
    } finally {f.cleanup();}
  }
});

test('the actual local Node version probe succeeds without running the hosted entry or a network operation',async()=>{
  const f=fixture();try {
    delete f.probeProcess;
    const pending=action.runLocalAction(f);
    assert.equal(f.calls.spawn.length,1);f.child.emit('close',0,null);
    assert.equal(await pending,0);
  } finally {f.cleanup();}
});
