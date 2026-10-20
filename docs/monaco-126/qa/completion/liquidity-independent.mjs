import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
const root=process.argv[2]??process.cwd();
const {corroborateLiquidityEvent:event}=await import(pathToFileURL(root+'/app/api/pocket/liquidity-chain.ts'));
const zones=[{side:'BUY_SIDE',x:10,x2:90,y:30}];
const points=[{kind:'equal-highs',side:'buy-side',x:20,y:30,confidence:'HIGH'},{kind:'equal-highs',side:'buy-side',x:40,y:30,confidence:'HIGH'}];
const sweep={kind:'sweep-reclaim',side:'buy-side',x:60,y:30,confidence:'HIGH'};const results=[];
for(const [name,input,want] of [['pool-only',points,'NONE'],['defended-sweep',[...points,sweep],'SWEEP'],['event-before-pool',[...points,{...sweep,x:15}],'NONE'],['wrong-row',[...points,{...sweep,y:50}],'NONE'],['wrong-side',[...points,{...sweep,side:'sell-side'}],'NONE'],['low-confidence',[...points,{...sweep,confidence:'LOW'}],'NONE']]){assert.equal(event('SWEEP',input,zones),want);results.push(name);}
process.stdout.write(JSON.stringify({passed:results.length,failed:0,cases:results},null,2)+'\n');
