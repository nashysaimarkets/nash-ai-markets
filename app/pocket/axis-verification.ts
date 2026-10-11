/** Pure, independently measured axis evidence. No inferred decimal repair. */
export type AxisWord = { text:string; confidence:number; x:number; y:number; width:number; height:number };
export type VerifiedAxis = { status:'verified'; anchors:Array<{price:number;y:number}>; matchedModelTicks:number; axisLeft?:number };
export type AxisVerification = VerifiedAxis | { status:'held'; reason:string };

export function exactAxisPrice(text:string):number|null {
 const value=text.trim().replace(/^[$£€]/,'');
 // Reject ambiguous locale notation, percentages, letters and broken decimals.
 if(!/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?$/.test(value))return null;
 const price=Number(value.replaceAll(',',''));
 return Number.isFinite(price)&&price>0?price:null;
}
export function axisWordsFromTsv(tsv:string,offset:{x:number;y:number;scale:number}):AxisWord[]{
 if(!Number.isFinite(offset.scale)||offset.scale<=0)return [];
 return tsv.split(/\r?\n/).slice(1).flatMap(line=>{
  const c=line.split('\t');if(c.length<12||c[0]!=='5')return [];
  const [x,y,width,height,confidence]=[c[6],c[7],c[8],c[9],c[10]].map(Number);
  if(![x,y,width,height,confidence].every(Number.isFinite)||width<=0||height<=0)return [];
  return [{text:c.slice(11).join('\t'),confidence,x:offset.x+x/offset.scale,y:offset.y+(y+height/2)/offset.scale,width:width/offset.scale,height:height/offset.scale}];
 });
}
/** Plot geometry selects pixels to read, never prices or accepted axis rows.
 * A chart beside a watchlist may end before the image's right-hand third. */
export function axisInitialColumn(width:number,bounds?:{left:number;right:number}):{left:number;right:number}{
 const fallback={left:Math.floor(width*.65),right:width};
 if(!bounds||![bounds.left,bounds.right].every(Number.isFinite)||bounds.left<0||bounds.right>100||bounds.left>=bounds.right||bounds.right>=65)return fallback;
 return {left:Math.max(0,Math.floor(width*(bounds.right/100-.2))),right:Math.min(width,Math.ceil(width*(bounds.right/100+.2)))};
}
export function axisRetryColumn(words:AxisWord[],width:number,bounds?:{left:number;right:number}):{left:number;right:number}{
 const initial=axisInitialColumn(width,bounds);
 const numeric=words.filter(w=>exactAxisPrice(w.text)!==null && w.confidence>=70 && w.height>0 && [w.x,w.width,w.height].every(Number.isFinite)&&w.x>=initial.left&&w.x<initial.right);
 const groups=numeric.map(seed=>numeric.filter(w=>Math.abs(w.x-seed.x)<=Math.max(8,seed.height)));
 const column=groups.sort((a,b)=>b.length-a.length)[0]??[];
 if(column.length<3)return initial;
 const font=Math.max(...column.map(w=>w.height));
 const padding=column.some(w=>/^0\d{3,}$/.test(w.text.trim()))?2:.4;
 return {left:Math.max(initial.left,Math.floor(Math.min(...column.map(w=>w.x))-font*padding)),right:Math.min(initial.right,Math.ceil(Math.max(...column.map(w=>w.x+w.width))+font*1.5))};
}
export function verifyAxisWords(words:AxisWord[],gridPixels:number[],model:Array<{price:number;y:number}>,height:number):AxisVerification {
 const hold=(reason:string):AxisVerification=>({status:'held',reason});
 if(!Number.isFinite(height)||height<=0||gridPixels.length<3||gridPixels.some(y=>!Number.isFinite(y)))return hold('Price grid could not be independently verified.');
 const candidates=words.flatMap(w=>{
  const price=exactAxisPrice(w.text);
  if(price===null||w.confidence<80||![w.x,w.y,w.width,w.height,w.confidence].every(Number.isFinite)||w.height<=0)return [];
  const row=gridPixels.reduce((best,y)=>Math.abs(y-w.y)<Math.abs(best-w.y)?y:best,gridPixels[0]);
  if(Math.abs(row-w.y)>Math.max(3,w.height*.35))return [];
  return [{price,y:row/height*100,x:w.x,font:w.height}];
 });
 // A single text column prevents volume labels and candle annotations from
 // joining the price axis. Never repair OCR values to fit the model.
 const groups=candidates.map(seed=>candidates.filter(w=>Math.abs(w.x-seed.x)<=Math.max(8,seed.font)));
 const selected=groups.sort((a,b)=>b.length-a.length)[0]??[];
 // Conflicting readings on one raster row are ambiguous evidence, even if
 // keeping whichever word happened to arrive last would produce a good fit.
 const pricesByRow=new Map<number,number>();
 for(const a of selected){
  const prior=pricesByRow.get(a.y);
  if(prior!==undefined&&prior!==a.price)return hold('Independent price labels conflict on the same grid row.');
  pricesByRow.set(a.y,a.price);
 }
 const ordered=[...new Map(selected.map(a=>[a.y,a])).values()].sort((a,b)=>a.y-b.y);
 if(ordered.length<3||ordered.some((a,i)=>i>0&&a.price>=ordered[i-1].price)||ordered.at(-1)!.y-ordered[0].y<20)return hold('Independent price labels need a clearer axis.');
 const meanP=ordered.reduce((s,a)=>s+a.price,0)/ordered.length,meanY=ordered.reduce((s,a)=>s+a.y,0)/ordered.length;
 const variance=ordered.reduce((s,a)=>s+(a.price-meanP)**2,0);
 const slope=ordered.reduce((s,a)=>s+(a.price-meanP)*(a.y-meanY),0)/variance;
 if(!Number.isFinite(slope)||slope>=0||ordered.some(a=>Math.abs(a.y-(meanY+(a.price-meanP)*slope))*height/100>1.5))return hold('Independent price labels do not establish a linear scale.');
 const matchedModelTicks=new Set(model.filter(a=>ordered.some(b=>Math.abs(a.price-b.price)<=Math.max(1e-10,Math.abs(b.price)*1e-10))).map(a=>a.price)).size;
 if(matchedModelTicks<3)return hold('The vision scan and independent price reader disagree.');
 return {status:'verified',anchors:ordered.map(({price,y})=>({price,y})),matchedModelTicks,axisLeft:Math.min(...ordered.map(a=>a.x))};
}
