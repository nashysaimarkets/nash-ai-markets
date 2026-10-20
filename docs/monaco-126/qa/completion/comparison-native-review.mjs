import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {stripTypeScriptTypes} from 'node:module';
import {pathToFileURL} from 'node:url';

const root=process.argv[2]??process.cwd();
const {transformSync}=await import(pathToFileURL(root+'/node_modules/esbuild/lib/main.js'));
const {createScreenshotComparison, emptyComparisonState}=await import(pathToFileURL(root+'/app/pocket/screenshot-comparison-session.ts'));
const file={name:'test.png',type:'image/png',size:1};

async function actualHook() {
 const src=await readFile(root+'/app/pocket/use-screenshot-comparison.ts','utf8');
 const code=stripTypeScriptTypes(src.slice(src.indexOf('export function')).replace('export function','function'));
 let stored, initialized=false, setup, published=0, calls=0;
 const ref={current:null};
 const hook=new Function('useState','useRef','useEffect','pocketAuthenticatedFetch','createScreenshotComparison','emptyComparisonState',code+';return useScreenshotComparison;')(
  initial=>{if(!initialized){stored=initial();initialized=true;}return [stored,value=>{stored=value;published++;}];},
  ()=>ref,
  value=>{setup=value;},
  async()=>{calls++;return Response.json({result:{symbol:'AAPL'}});},
  options=>createScreenshotComparison({...options,read:async()=> 'data:image/png;base64,test'}),
  emptyComparisonState,
 );
 const validate=value=>Boolean(value && typeof value==='object' && value.symbol==='AAPL');
 const render=()=>hook('/test','failed',validate);
 return {render, setup:()=>setup(),ref,state:()=>stored,published:()=>published,calls:()=>calls};
}

test('actual hook remains live after StrictMode setup → cleanup → setup and final cleanup owns only its session',async()=>{
 const f=await actualHook();f.render();const cleanupA=f.setup();const old=f.ref.current;
 cleanupA();const cleanupB=f.setup();assert.notEqual(f.ref.current,old);
 // An old effect's repeated/late cleanup cannot clear a replacement session.
 cleanupA();assert.ok(f.ref.current);
 await f.render().attach(file);await f.render().check({ticker:'AAPL'});
 assert.equal(f.state().result.symbol,'AAPL');assert.equal(f.calls(),1);
 cleanupB();assert.equal(f.ref.current,null);const writes=f.published();
 await f.render().attach(file);await f.render().check({ticker:'AAPL'});
 assert.equal(f.published(),writes);assert.equal(f.calls(),1);
});

for(const name of ['OptionsWallCheck','CryptoDerivativesCheck'])test('actual '+name+' wrapper changes keyed session whenever its report context changes',async()=>{
 const src=await readFile(root+'/app/pocket/'+name+'.tsx','utf8');
 const code=transformSync(src,{loader:'tsx',format:'cjs',jsxFactory:'h'}).code;
 const mod={exports:{}};
 const h=(type,props,...children)=>({type,props,key:props?.key,children});
 new Function('require','module','exports','h',code)(()=>({}),mod,mod.exports,h);
 const Component=mod.exports.default;
 const a={ticker:name==='OptionsWallCheck'?'AAPL':'BTCUSD',levels:[{kind:'support',price:'200',label:'baseline'}],structure:'baseline'};
 const baseline=Component(a);
 assert.equal(baseline.key,Component({...a}).key,'same report facts retain their session');
 assert.notEqual(baseline.key,Component({...a,ticker:name==='OptionsWallCheck'?'MSFT':'ETHUSD'}).key);
 const altered=name==='OptionsWallCheck'?{...a,levels:[{...a.levels[0],price:'201'}]}:{...a,structure:'changed structure'};
 assert.notEqual(baseline.key,Component(altered).key,'a recalibrated report cannot reuse previous screenshot context');
 assert.equal(baseline.props.ticker,a.ticker);
});
