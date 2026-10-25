import assert from 'node:assert/strict';
import test from 'node:test';
import type {TestContext} from 'node:test';
import {readWorkspaceImage} from '../app/pocket-next/workspace-state.ts';

// Deterministic local browser-API fixtures: no charts, provider or network access.
const DEADLINE=30_000;
const DATA='data:image/png;base64,aW1hZ2U=';
function browser(t:TestContext) {
  t.mock.timers.enable({apis:['setTimeout']});
  const readers:Reader[]=[],images:Picture[]=[];
  let throwRead=false,throwImage=false;
  class Reader {
    static LOADING=1;
    readyState=0;result:unknown=null;aborts=0;
    onload:(()=>void)|null=null;onerror:(()=>void)|null=null;onabort:(()=>void)|null=null;
    constructor(){readers.push(this);}
    readAsDataURL(){this.readyState=1;if(throwRead)throw Error('fixture read failure');}
    finish(value:unknown=DATA){this.result=value;this.readyState=2;this.onload?.();}
    abort(){this.aborts++;this.readyState=2;this.onabort?.();}
  }
  class Picture {
    naturalWidth=640;naturalHeight=360;src='';removed=0;
    onload:(()=>void)|null=null;onerror:(()=>void)|null=null;
    constructor(){if(throwImage)throw Error('fixture decode failure');images.push(this);}
    removeAttribute(name:string){assert.equal(name,'src');this.src='';this.removed++;}
  }
  for(const [name,value] of [['FileReader',Reader],['Image',Picture]] as const) {
    const previous=Object.getOwnPropertyDescriptor(globalThis,name);
    Object.defineProperty(globalThis,name,{configurable:true,writable:true,value});
    t.after(()=>{if(previous)Object.defineProperty(globalThis,name,previous);else Reflect.deleteProperty(globalThis,name);});
  }
  return {readers,images,throwRead:()=>{throwRead=true;},throwImage:()=>{throwImage=true;}};
}
const file=(type='image/png',size=12)=>({type,size}) as File;
async function flush(){for(let i=0;i<5;i++)await Promise.resolve();}
function observe(promise:Promise<string>){
  const state:{value?:string;error?:unknown}={};
  const done=promise.then(value=>{state.value=value;},error=>{state.error=error;});
  return {state,done};
}
function timedOut(value:unknown){assert.ok(value instanceof Error,'stalled upload must reject instead of remaining pending');assert.match(value.message,/timed out/i);}

test('stalled file reading has a deadline and releases reader callbacks',async t=>{
  const h=browser(t),run=observe(readWorkspaceImage(file()));
  const late=h.readers[0].onload;
  t.mock.timers.tick(DEADLINE);await flush();timedOut(run.state.error);
  assert.equal(h.readers[0].aborts,1);assert.equal(h.readers[0].onload,null);
  late?.();await flush();assert.equal(h.images.length,0);assert.equal(run.state.value,undefined);
});
test('stalled image decoding has a deadline and releases its source',async t=>{
  const h=browser(t),run=observe(readWorkspaceImage(file()));h.readers[0].finish();await flush();
  const late=h.images[0].onload;
  t.mock.timers.tick(DEADLINE);await flush();timedOut(run.state.error);
  assert.equal(h.images[0].onload,null);assert.equal(h.images[0].onerror,null);assert.equal(h.images[0].src,'');
  late?.();await flush();assert.equal(run.state.value,undefined);
});
test('read and decode share one deadline rather than restarting the timer',async t=>{
  const h=browser(t),run=observe(readWorkspaceImage(file()));t.mock.timers.tick(DEADLINE-1);
  h.readers[0].finish();await flush();t.mock.timers.tick(1);await flush();timedOut(run.state.error);
});
test('successful image preserves exact bytes, cleans up and has no later rejection',async t=>{
  const h=browser(t),run=observe(readWorkspaceImage(file()));h.readers[0].finish();await flush();
  h.images[0].onload?.();await run.done;assert.equal(run.state.value,DATA);assert.equal(run.state.error,undefined);
  assert.equal(h.readers[0].onload,null);assert.equal(h.images[0].onload,null);assert.equal(h.images[0].src,'');
  t.mock.timers.tick(DEADLINE*2);await flush();assert.equal(run.state.error,undefined);
});
test('unsupported image type is rejected without starting browser work',async t=>{
  const h=browser(t);await assert.rejects(readWorkspaceImage(file('text/plain')),/JPEG, PNG or WebP/);assert.equal(h.readers.length,0);
});
test('empty or oversized files retain the existing upload limit',async t=>{
  const h=browser(t);for(const size of [0,8*1024*1024+1])await assert.rejects(readWorkspaceImage(file('image/png',size)),/under 8 MB/);assert.equal(h.readers.length,0);
});
test('non-string file results are rejected and cannot start a decoder',async t=>{
  const h=browser(t);for(const value of [null,new ArrayBuffer(8)]){
    const run=observe(readWorkspaceImage(file()));h.readers.at(-1)!.finish(value);await run.done;
    assert.ok(run.state.error instanceof Error);assert.equal(h.readers.at(-1)!.onload,null);
  }assert.equal(h.images.length,0);
});
test('reader errors settle with cleanup',async t=>{
  const h=browser(t),run=observe(readWorkspaceImage(file()));h.readers[0].onerror?.();await run.done;
  assert.match(String(run.state.error),/Could not read/);assert.equal(h.readers[0].onerror,null);
});
test('reader abort settles with cleanup',async t=>{
  const h=browser(t),run=observe(readWorkspaceImage(file()));h.readers[0].abort();await run.done;
  assert.match(String(run.state.error),/Could not read/);assert.equal(h.readers[0].onabort,null);
});
test('decode error rejects without accepting an image',async t=>{
  const h=browser(t),run=observe(readWorkspaceImage(file()));h.readers[0].finish();await flush();h.images[0].onerror?.();await run.done;
  assert.match(String(run.state.error),/could not be decoded/);assert.equal(h.images[0].src,'');assert.equal(run.state.value,undefined);
});
test('unreadable and over-limit image dimensions remain rejected',async t=>{
  const h=browser(t);for(const [width,height] of [[0,10],[10,0],[4001,4000]]){
    const run=observe(readWorkspaceImage(file()));h.readers.at(-1)!.finish();await flush();
    const image=h.images.at(-1)!;image.naturalWidth=width;image.naturalHeight=height;image.onload?.();await run.done;
    assert.match(String(run.state.error),/16 megapixels/);assert.equal(image.src,'');
  }
});
test('exact file and pixel limits and all supported MIME types still work',async t=>{
  const h=browser(t);for(const type of ['image/png','image/jpeg','image/webp']){
    const run=observe(readWorkspaceImage(file(type,8*1024*1024)));h.readers.at(-1)!.finish();await flush();
    const image=h.images.at(-1)!;image.naturalWidth=4000;image.naturalHeight=4000;image.onload?.();await run.done;
    assert.equal(run.state.value,DATA);assert.equal(run.state.error,undefined);
  }
});
test('synchronous browser read errors are cleaned up',async t=>{
  const h=browser(t);h.throwRead();const run=observe(readWorkspaceImage(file()));await run.done;
  assert.match(String(run.state.error),/Could not read/);assert.equal(h.readers[0].onload,null);assert.equal(h.readers[0].aborts,1);
});
test('synchronous decoder construction errors settle safely',async t=>{
  const h=browser(t);h.throwImage();const run=observe(readWorkspaceImage(file()));
  // A browser event-handler exception must not escape and leave this promise pending.
  assert.doesNotThrow(()=>h.readers[0].finish());await flush();
  assert.match(String(run.state.error),/could not be decoded/);assert.equal(h.readers[0].onload,null);
});
test('one timed-out upload does not cancel another independent slot',async t=>{
  const h=browser(t),first=observe(readWorkspaceImage(file()));t.mock.timers.tick(15_000);
  const second=observe(readWorkspaceImage(file()));t.mock.timers.tick(15_000);await flush();timedOut(first.state.error);
  h.readers[1].finish();await flush();h.images[0].onload?.();await second.done;assert.equal(second.state.value,DATA);
});

/** Execute the actual component handler with state setters, as the existing integration suite does. */
async function uploadHandler(hasPrevious=true) {
  const {readFile}=await import('node:fs/promises');
  const {stripTypeScriptTypes}=await import('node:module');
  const source=await readFile(new URL('../app/pocket-next/PocketNext.tsx',import.meta.url),'utf8');
  const start=source.indexOf('  const loadChart = async');
  const end=source.indexOf('  const changePreflight',start);
  assert.ok(start>=0&&end>start,'exercise the real component upload handler');
  type Slot={image:string|null;name:string;analysis:unknown;revision:number;status:string;runState:string;message:string;confirmation:unknown;localScan:null};
  let slots:Slot[]=[{image:hasPrevious?'old-image':null,name:'before.png',analysis:hasPrevious?{saved:'report'}:null,revision:1,status:'LOCKED',runState:'COMPLETE',message:'',confirmation:{instrument:'US 500'},localScan:null}];
  let uploading=[false],privacy=true;
  const bindings={demoMode:false,invalidate:()=>{},uploads:{current:[1]},readWorkspaceImage,
    setUploadingSlots:(fn:(old:boolean[])=>boolean[])=>{uploading=fn(uploading);},
    setCharts:(fn:(old:Slot[])=>Slot[])=>{slots=fn(slots);},
    setPrivacy:(value:boolean)=>{privacy=value;},setNotice:()=>{},setActiveChart:()=>{}};
  const load=new Function(...Object.keys(bindings),stripTypeScriptTypes(source.slice(start,end))+'\nreturn loadChart;')(...Object.values(bindings)) as (index:number,value:File)=>Promise<void>;
  return {load,slots:()=>slots,uploading:()=>uploading,privacy:()=>privacy};
}
test('actual workspace handler keeps old chart/report and releases loading after read timeout',async t=>{
  const b=browser(t),h=await uploadHandler();const old=h.slots()[0];const done=h.load(0,file());
  assert.equal(h.uploading()[0],true);t.mock.timers.tick(DEADLINE);await flush();
  assert.equal(h.uploading()[0],false);await done;
  assert.equal(h.slots()[0].image,old.image);assert.equal(h.slots()[0].analysis,old.analysis);
  assert.match(h.slots()[0].message,/timed out.*previous chart and report were kept/i);assert.equal(b.readers[0].aborts,1);
});
test('actual empty workspace recovers from decode timeout without claiming a saved report',async t=>{
  const b=browser(t),h=await uploadHandler(false),done=h.load(0,file());b.readers[0].finish();await flush();
  t.mock.timers.tick(DEADLINE);await flush();assert.equal(h.uploading()[0],false);await done;
  assert.equal(h.slots()[0].image,null);assert.equal(h.slots()[0].analysis,null);
  assert.match(h.slots()[0].message,/timed out/i);assert.doesNotMatch(h.slots()[0].message,/were kept/);
});
test('a stale upload deadline cannot clear a newer replacement and that replacement can succeed',async t=>{
  const b=browser(t),h=await uploadHandler();let firstSettled=false;
  const first=h.load(0,file()).then(()=>{firstSettled=true;});t.mock.timers.tick(15_000);
  const second=h.load(0,Object.assign(file(),{name:'retry.png'}));t.mock.timers.tick(15_000);await flush();
  assert.equal(firstSettled,true,'older stalled upload must settle');assert.equal(h.uploading()[0],true);assert.equal(h.slots()[0].message,'');
  b.readers[1].finish();await flush();b.images[0].onload?.();await Promise.all([first,second]);
  assert.equal(h.uploading()[0],false);assert.equal(h.slots()[0].name,'retry.png');assert.equal(h.slots()[0].image,DATA);
  assert.equal(h.slots()[0].analysis,null);assert.equal(h.slots()[0].confirmation,null);assert.equal(h.privacy(),false);
});
