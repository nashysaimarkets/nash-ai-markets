import assert from 'node:assert/strict';
import test from 'node:test';
import {createPrecisionReadingCrop} from '../app/pocket/precision-reading-crop.ts';
import {createScreenshotComparison,readComparisonScreenshot} from '../app/pocket/screenshot-comparison-session.ts';

const flush=async()=>{for(let i=0;i<30;i++)await Promise.resolve();};
const file={name:'chart.png',type:'image/png',size:123};
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
function track(p){const s={settled:false,value:undefined,error:undefined};p.then(v=>{s.settled=true;s.value=v;},e=>{s.settled=true;s.error=e;});return s;}
function cropHarness(t,{throws=false,dimensions=[640,360],context=true}={}){
 const images=[],draws=[];let canvases=0;
 t.mock.timers.enable({apis:['setTimeout']});
 const previousImage=globalThis.Image,previousDocument=globalThis.document;
 class FakeImage {constructor(){if(throws)throw Error('decoder unavailable');this.naturalWidth=dimensions[0];this.naturalHeight=dimensions[1];this.onload=null;this.onerror=null;this.src='';images.push(this);}}
 globalThis.Image=FakeImage;
 globalThis.document={createElement(){canvases++;return {width:0,height:0,getContext:()=>context?{drawImage:(...args)=>draws.push(args)}:null,toDataURL:()=> 'data:image/jpeg;base64,crop'};}};
 t.after(()=>{globalThis.Image=previousImage;globalThis.document=previousDocument;});
 return {images,draws,canvases:()=>canvases};
}
function comparison(t,overrides={}){
 t.mock.timers.enable({apis:['setTimeout']});
 const states=[],calls=[];
 const options={endpoint:'/api/pocket/options-wall',failureMessage:'Unavailable',read:async()=> 'data:image/png;base64,original',fetch:async(url,init)=>{calls.push({url,init});return Response.json({result:{ok:true}});},publish:s=>states.push(s),validate:v=>v?.ok===true,...overrides};
 const instance=createScreenshotComparison(options);t.after(()=>instance.dispose());
 return {instance,states,calls,last:()=>states.at(-1)};
}

test('stalled optional crop settles null after eight seconds and detaches late decoder',async t=>{
 const h=cropHarness(t),pending=track(createPrecisionReadingCrop('original'));
 const late=h.images[0].onload;t.mock.timers.tick(8000);await flush();
 assert.equal(pending.settled,true);assert.equal(pending.value,null);assert.equal(h.images[0].onload,null);assert.equal(h.images[0].onerror,null);assert.equal(h.images[0].src,'');
 late();await flush();assert.equal(h.canvases(),0);
});
test('crop succeeds without changing geometry or JPEG quality and clears decoder',async t=>{
 const h=cropHarness(t);const pending=createPrecisionReadingCrop('original');h.images[0].onload();assert.equal(await pending,'data:image/jpeg;base64,crop');assert.deepEqual(h.draws[0].slice(1),[0,22,640,295,0,0,1400,645]);assert.equal(h.images[0].src,'');t.mock.timers.tick(8000);await flush();assert.equal(h.draws.length,1);
});
test('crop decoder error settles null and releases handlers',async t=>{
 const h=cropHarness(t),p=createPrecisionReadingCrop('original');h.images[0].onerror();assert.equal(await p,null);assert.equal(h.images[0].onload,null);
});
test('optional crop constructor failure falls back to original rather than rejecting',async t=>{
 cropHarness(t,{throws:true});assert.equal(await createPrecisionReadingCrop('original'),null);
});
test('missing canvas context falls back without hanging',async t=>{
 const h=cropHarness(t,{context:false}),p=createPrecisionReadingCrop('original');h.images[0].onload();assert.equal(await p,null);
});
test('invalid crop dimensions fail closed before canvas allocation',async t=>{
 const h=cropHarness(t,{dimensions:[0,360]}),p=createPrecisionReadingCrop('original');h.images[0].onload();assert.equal(await p,null);assert.equal(h.canvases(),0);
});
test('one image timeout does not cancel an independent crop',async t=>{
 const h=cropHarness(t),a=track(createPrecisionReadingCrop('a'));t.mock.timers.tick(4000);const b=track(createPrecisionReadingCrop('b'));t.mock.timers.tick(4000);await flush();assert.equal(a.settled,true);assert.equal(b.settled,false);h.images[1].onload();await flush();assert.equal(b.value,'data:image/jpeg;base64,crop');
});
test('image read that ignores abort settles by thirty-second deadline',async t=>{
 const d=deferred(),h=comparison(t,{read:()=>d.promise});const p=track(h.instance.attach(file));t.mock.timers.tick(30000);await flush();assert.equal(p.settled,true);assert.equal(h.last().reading,false);assert.match(h.last().error,/timed out/i);const before=h.states.length;d.resolve('late');await flush();assert.equal(h.states.length,before);assert.equal(h.last().image,'');
});
test('fetch that ignores abort settles and permits deliberate retry without automatic retry',async t=>{
 const d=deferred();let calls=0;const h=comparison(t,{fetch:()=>{calls++;return calls===1?d.promise:Promise.resolve(Response.json({result:{ok:true}}));}});await h.instance.attach(file);const p=track(h.instance.check({ticker:'ABC'}));t.mock.timers.tick(65000);await flush();assert.equal(p.settled,true);assert.equal(h.last().busy,false);assert.match(h.last().error,/timed out/i);assert.equal(calls,1);await h.instance.check({ticker:'ABC'});assert.deepEqual(h.last().result,{ok:true});assert.equal(calls,2);
});
test('body that ignores abort shares the fetch deadline',async t=>{
 const d=deferred();const h=comparison(t,{fetch:async()=>{t.mock.timers.tick(60000);return {ok:true,json:()=>d.promise};}});await h.instance.attach(file);const p=track(h.instance.check({}));await flush();t.mock.timers.tick(5000);await flush();assert.equal(p.settled,true);assert.equal(h.last().busy,false);assert.match(h.last().error,/timed out/i);d.resolve({result:{ok:true}});await flush();assert.equal(h.last().result,null);
});
test('late fetch response is discarded and its body cancelled',async t=>{
 const d=deferred();let cancelled=0;const h=comparison(t,{fetch:()=>d.promise});await h.instance.attach(file);const p=track(h.instance.check({}));t.mock.timers.tick(65000);await flush();assert.equal(p.settled,true);const before=h.states.length;d.resolve({ok:true,body:{cancel:async()=>{cancelled++;}},json:async()=>({result:{ok:true}})});await flush();assert.equal(cancelled,1);assert.equal(h.states.length,before);
});
test('cancel settles a non-cooperative transport immediately and never publishes late data',async t=>{
 const d=deferred(),h=comparison(t,{fetch:()=>d.promise});await h.instance.attach(file);const p=track(h.instance.check({}));h.instance.cancel();await flush();assert.equal(p.settled,true);const before=h.states.length;d.resolve(Response.json({result:{ok:true}}));await flush();assert.equal(h.states.length,before);assert.equal(h.last().busy,false);
});
test('dispose settles an outstanding local read without publishing new state',async t=>{
 const d=deferred(),h=comparison(t,{read:()=>d.promise});const p=track(h.instance.attach(file));const before=h.states.length;h.instance.dispose();await flush();assert.equal(p.settled,true);assert.equal(h.states.length,before);
});
test('replacement supersedes a pending comparison and cannot inherit its timeout',async t=>{
 const d=deferred(),h=comparison(t,{fetch:()=>d.promise});await h.instance.attach(file);const p=track(h.instance.check({}));t.mock.timers.tick(1000);await h.instance.attach({...file,name:'replacement.png'});await flush();assert.equal(p.settled,true);t.mock.timers.tick(65000);await flush();assert.equal(h.last().fileName,'replacement.png');assert.equal(h.last().error,'');assert.equal(h.last().busy,false);
});
test('successful comparison preserves context snapshot, source and clears deadline',async t=>{
 const h=comparison(t);await h.instance.attach(file);const context={ticker:'ABC'};const p=h.instance.check(context);context.ticker='CHANGED';await p;assert.equal(h.calls.length,1);assert.equal(JSON.parse(h.calls[0].init.body).ticker,'ABC');assert.equal(h.last().image,'data:image/png;base64,original');assert.deepEqual(h.last().result,{ok:true});const before=h.states.length;t.mock.timers.tick(65000);await flush();assert.equal(h.states.length,before);
});
test('non-OK response and validator rejection never publish a result',async t=>{
 const h=comparison(t,{fetch:async()=>Response.json({error:'server unavailable'},{status:503})});await h.instance.attach(file);await h.instance.check({});assert.equal(h.last().busy,false);assert.equal(h.last().result,null);assert.equal(h.last().error,'server unavailable');
});
test('invalid response JSON recovers and allows replacement',async t=>{
 const h=comparison(t,{fetch:async()=>new Response('{broken')});await h.instance.attach(file);await h.instance.check({});assert.equal(h.last().busy,false);assert.equal(h.last().result,null);await h.instance.attach({...file,name:'next.png'});assert.equal(h.last().fileName,'next.png');
});
test('invalid file cannot reach the reader or provider',async t=>{
 let reads=0;const h=comparison(t,{read:async()=>{reads++;return 'image';}});await h.instance.attach({...file,type:'text/html'});await h.instance.check({});assert.equal(reads,0);assert.equal(h.calls.length,0);assert.equal(h.last().reading,false);
});
test('default FileReader abort detaches callbacks and releases pending read',async t=>{
 const previous=globalThis.FileReader;let instance,aborts=0;
 globalThis.FileReader=class{constructor(){instance=this;this.onload=null;this.onerror=null;this.onabort=null;this.readyState=1;}readAsDataURL(){}abort(){aborts++;this.onabort?.();}};
 t.after(()=>globalThis.FileReader=previous);
 const controller=new AbortController(),p=track(readComparisonScreenshot(file,controller.signal));controller.abort();await flush();assert.equal(p.settled,true);assert.ok(p.error);assert.equal(aborts,1);assert.equal(instance.onload,null);assert.equal(instance.onerror,null);assert.equal(instance.onabort,null);
});
test('pre-cancelled read creates no FileReader',async t=>{
 const previous=globalThis.FileReader;let constructed=0;globalThis.FileReader=class{constructor(){constructed++;}};t.after(()=>globalThis.FileReader=previous);const controller=new AbortController();controller.abort();await assert.rejects(readComparisonScreenshot(file,controller.signal));assert.equal(constructed,0);
});
test('extreme output aspect ratio is held before allocating a huge canvas',async t=>{
 const h=cropHarness(t,{dimensions:[1,16000000]}),p=createPrecisionReadingCrop('original');h.images[0].onload();assert.equal(await p,null);assert.equal(h.canvases(),0);
});
test('repeated comparison while busy dispatches only once',async t=>{
 const d=deferred();let calls=0;const h=comparison(t,{fetch:()=>{calls++;return d.promise;}});await h.instance.attach(file);const first=h.instance.check({});await h.instance.check({});assert.equal(calls,1);d.resolve(Response.json({result:{ok:true}}));await first;
});
test('body timeout aborts the original transport signal without replacing the source',async t=>{
 const d=deferred();let signal;const h=comparison(t,{fetch:async(_,init)=>{signal=init.signal;return {ok:true,json:()=>d.promise};}});await h.instance.attach(file);const pending=h.instance.check({});await flush();t.mock.timers.tick(65000);await flush();assert.equal(signal.aborted,true);assert.equal(h.last().busy,false);assert.equal(h.last().image,'data:image/png;base64,original');await pending;
});
test('late transport rejection is handled after cancellation',async t=>{
 const d=deferred(),h=comparison(t,{fetch:()=>d.promise});await h.instance.attach(file);const p=track(h.instance.check({}));h.instance.cancel();await flush();assert.equal(p.settled,true);d.reject(Error('late rejection'));await flush();assert.match(h.last().error,/cancelled/i);
});
test('cancel from synchronous publication prevents transport dispatch',async t=>{
 let instance,calls=0;t.mock.timers.enable({apis:['setTimeout']});instance=createScreenshotComparison({endpoint:'/api/pocket/options-wall',failureMessage:'Unavailable',read:async()=> 'image',fetch:async()=>{calls++;return Response.json({result:{ok:true}});},publish:s=>{if(s.busy)instance.cancel();},validate:()=>true});t.after(()=>instance.dispose());await instance.attach(file);await instance.check({});assert.equal(calls,0);
});
