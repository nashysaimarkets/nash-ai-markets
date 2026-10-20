import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import assert from 'node:assert/strict';
const root=process.argv[2];
let failures=0;
for(const name of ['OptionsWallCheck','CryptoDerivativesCheck']){
 const src=readFileSync(`${root}/app/pocket/${name}.tsx`,'utf8');
 const start=src.indexOf('export default function ');
 const end=src.indexOf('\n  return <section',start);
 const body=stripTypeScriptTypes(src.slice(start,end).replace('export default function '+name,'function Component')+'\nreturn {attach,check};\n}');
 const values=[];let cursor=0,resolveFetch;const readers=[];
 class Reader{readAsDataURL(file){this.result=`data:image/png;base64,${file.name}`;readers.push(this);}}
 const useState=(init)=>{const i=cursor++;if(!(i in values)) values[i]=init;return [values[i],v=>{values[i]=v;}];};
 const build=new Function('useState','pocketAuthenticatedFetch','FileReader','cryptoBase',body+';return Component;');
 const component=build(useState,()=>new Promise(r=>{resolveFetch=r;}),Reader,t=>t==='BTCUSD'?'BTC':t==='ETHUSD'?'ETH':null);
 const a={ticker:name==='OptionsWallCheck'?'AAPL':'BTCUSD',structure:'bullish',levels:[{kind:'support',price:'200',label:'old'}]};
 const b={...a,ticker:name==='OptionsWallCheck'?'MSFT':'ETHUSD',structure:'bearish',levels:[{kind:'support',price:'100',label:'new'}]};
 const render=p=>{cursor=0;return component(p);};
 let view=render(a);
 let uploading=view.attach({currentTarget:{files:[{name:'old',type:'image/png',size:1}],value:'x'}});readers.shift().onload();await uploading;
 view=render(a);const check=view.check();render(b);
 resolveFetch({ok:true,json:async()=>({result:{symbol:a.ticker,status:'MATCHED',matches:[],observations:[],message:'old'}})});await check;
 try{assert.equal(values[4],null,'new chart context must not receive old provider result');}catch{failures++;process.stdout.write(`${name}: reproduced stale-result FAIL (${values[4]?.symbol})\n`);}
 view=render(b);
 const first=view.attach({currentTarget:{files:[{name:'first',type:'image/png',size:1}],value:'x'}});
 const second=view.attach({currentTarget:{files:[{name:'second',type:'image/png',size:1}],value:'x'}});
 readers[1].onload();await second;readers[0].onload();await first;
 try{assert.match(values[0],/second$/,'latest chosen screenshot must win');}catch{failures++;process.stdout.write(`${name}: reproduced reversed-file-read FAIL\n`);}
}
process.stdout.write(`${failures}/4 unsafe baseline cases reproduced; no provider calls\n`);
process.exitCode=failures===4?0:1;
