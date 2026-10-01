import test from 'node:test';import assert from 'node:assert/strict';
import {exactAxisPrice,axisWordsFromTsv,axisRetryColumn,verifyAxisWords} from '../app/pocket/axis-verification';
const model=[{price:130,y:20},{price:110,y:40},{price:90,y:60}];
const words=[130,120,110,100,90].map((price,i)=>({text:String(price),confidence:95,x:900,y:200+i*100+2,width:35,height:20}));
test('strict axis numbers preserve forex decimals and reject ambiguous or repaired labels',()=>{
 for(const [text,price] of [['1.09505',1.09505],['7,674.34',7674.34],['$130',130]] as const)assert.equal(exactAxisPrice(text),price);
 for(const text of ['1,09505','O.95','1.09%','1 09505','1.','Infinity','-10'])assert.equal(exactAxisPrice(text),null);
});
test('independent prices bind to raster row centres and agree with three model labels',()=>{
 const r=verifyAxisWords(words,[200,300,400,500,600],model,1000);assert.equal(r.status,'verified');if(r.status==='verified'){assert.equal(r.matchedModelTicks,3);assert.equal(r.anchors[0].y,20);}
});
test('decimal loss, logarithmic prices, low confidence and axis disagreement fail closed',()=>{
 assert.equal(verifyAxisWords(words,[200,300,400,500,600],model.map(a=>({...a,price:a.price/100})),1000).status,'held');
 assert.equal(verifyAxisWords(words.map(w=>({...w,confidence:60})),[200,300,400,500,600],model,1000).status,'held');
 assert.equal(verifyAxisWords(words.map((w,i)=>({...w,text:String(2**(5-i))})),[200,300,400,500,600],model,1000).status,'held');
 assert.equal(verifyAxisWords(words,[],model,1000).status,'held');
});
test('OCR TSV coordinates return to the original image after cropping and enlargement',()=>{
 const tsv='level\tpage\tblock\tpar\tline\tword\tleft\ttop\twidth\theight\tconf\ttext\n5\t1\t1\t1\t1\t1\t20\t100\t60\t40\t96\t1.09505';
 const [word]=axisWordsFromTsv(tsv,{x:800,y:200,scale:2});assert.equal(word.x,810);assert.equal(word.y,260);assert.equal(word.text,'1.09505');
});
test('contradictory labels on one row are withheld in either OCR ordering',()=>{
 const conflicting={...words[2],text:'111'};
 for(const input of [[conflicting,...words],[...words,conflicting]]){
  const result=verifyAxisWords(input,[200,300,400,500,600],model,1000);
  assert.equal(result.status,'held');
  if(result.status==='held')assert.match(result.reason,/conflict/);
 }
 assert.equal(verifyAxisWords([...words,{...words[2]}],[200,300,400,500,600],model,1000).status,'verified');
});
test('targeted reread expands a clipped leading zero without fabricating its decimal',()=>{
 const truncated=[0,1,2].map(i=>({text:'09505',confidence:95,x:658,y:242+i*60,width:65,height:16}));
 const crop=axisRetryColumn(truncated,790);assert.equal(crop.left,626);assert.ok(crop.right>=723);assert.equal(exactAxisPrice(truncated[0].text),9505);
 const prices=[130,120,110].map((p,i)=>({text:String(p),confidence:95,x:648,y:335+i*64,width:40,height:19}));
 assert.equal(axisRetryColumn(prices,754).left,640);
});
