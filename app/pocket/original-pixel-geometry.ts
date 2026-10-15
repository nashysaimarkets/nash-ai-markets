import type { CandlePixels } from "./candle-pixels.ts";
import type { AxisVerification } from "./axis-verification.ts";
import { exactAxisPrice } from "./axis-verification.ts";
import { originalPixelLevels, type OriginalLevelReport } from "./original-pixel-levels.ts";
type Bounds = {left:number;right:number;top:number;bottom:number};
export type PixelPattern = {name:string;timeframe?:string;sourceRole?:string;confidence?:string;status:string;geometry?:{points:{x:number;y:number}[];labelX:number;labelY:number}};
export type PixelLiquidity = {state:string;confidence:string;zones:{side:string;basis:string;price:string;priceLow?:number;priceHigh?:number;x:number;x2:number;y:number}[];observations?:{side:string;x:number;y:number;confidence:string}[]};
export type OriginalGeometryReport = OriginalLevelReport & {timeframe?:string;currentPrice?:string;patterns?:PixelPattern[];liquidity?:PixelLiquidity};
/** PR #95 endpoint validation adapted to the candidate's existing response schema.
 * Never fabricate candles or move vertices to convenient nearby extrema. */
export function pixelCheckedPatterns(patterns:PixelPattern[],timeframe:string,bounds:Bounds|undefined,pixels:CandlePixels|null) {
 if(!bounds||!pixels||![pixels.width,pixels.height,...Object.values(bounds)].every(Number.isFinite)||pixels.width<=0||pixels.height<=0||bounds.left<0||bounds.top<0||bounds.right>100||bounds.bottom>100||bounds.left>=bounds.right||bounds.top>=bounds.bottom)return [];
 const frame=(s:string|undefined)=>(s??'').toUpperCase().replace(/MIN(?:UTE)?S?/g,'M').replace(/HOUR(?:S)?/g,'H').replace(/[^A-Z0-9]/g,'');
 if(!frame(timeframe))return [];
 return patterns.flatMap(pattern=>{
  if((pattern.sourceRole??'PRIMARY')!=='PRIMARY'||frame(pattern.timeframe)!==frame(timeframe)||!['HIGH','MEDIUM'].includes(pattern.confidence??''))return [];
  const points=pattern.geometry?.points;if(!points||points.length<3||points.length>10)return [];
  const checked:{x:number;y:number}[]=[],used=new Set<number>();
  for(const point of points){
   if(![point.x,point.y].every(Number.isFinite)||point.x<bounds.left||point.x>bounds.right||point.y<bounds.top||point.y>bounds.bottom)return [];
   const px=point.x*pixels.width/100,py=point.y*pixels.height/100;
   const matches=pixels.candles.flatMap(c=>px>=c.left-2&&px<=c.right+2?[c.highY,c.lowY].filter(y=>Math.abs(y-py)<=2).map(y=>({c,y})):[]);
   if(matches.length!==1||used.has(matches[0].c.id))return [];
   const {c,y}=matches[0];if(checked.length&&c.x<=checked.at(-1)!.x*pixels.width/100)return [];
   used.add(c.id);checked.push({x:c.x/pixels.width*100,y:y/pixels.height*100});
  }
  return [{...pattern,geometry:{...pattern.geometry!,points:checked}}];
 });
}

export function pixelCheckedLiquidity(report:OriginalGeometryReport,identityConfirmed:boolean,axis:AxisVerification|null,pixels:CandlePixels|null) {
 const read=report.liquidity;
 if(!pixels||!axis||axis.status!=="verified"||read?.state!=="VERIFIED"||read.confidence!=="HIGH"||!Array.isArray(read.observations))return [];
 const current=exactAxisPrice(report.currentPrice??""); if(current===null)return [];
 const bounds=report.plotBounds;if(!bounds)return [];
 const min=Math.min(...axis.anchors.map(a=>a.price)),max=Math.max(...axis.anchors.map(a=>a.price));if(current<min||current>max)return [];
 return read.zones.flatMap(zone=>{
  const price=exactAxisPrice(zone.price);
  const high=zone.side==="BUY_SIDE";
  const interval=zone.priceLow!==undefined||zone.priceHigh!==undefined;
  const low=interval?zone.priceLow:price,upper=interval?zone.priceHigh:price;
  if(price===null||typeof low!=="number"||typeof upper!=="number"||!Number.isFinite(low)||!Number.isFinite(upper)||low<=0||upper<low||price<low||price>upper||(!high&&zone.side!=="SELL_SIDE")||(high?low<=current:upper>=current)||!(high?["EQUAL_HIGHS","PRIOR_SWING_HIGH","RANGE_HIGH"]:["EQUAL_LOWS","PRIOR_SWING_LOW","RANGE_LOW"]).includes(zone.basis))return [];
  // Reuse the unchanged identity, original-axis agreement, coverage and 1.5px fit.
  const probe=(value:number)=>originalPixelLevels({...report,levels:[{kind:high?"resistance":"support",label:zone.basis,price:String(value),x:zone.x,x2:zone.x2,y:zone.y,y2:zone.y}]},identityConfirmed,axis,pixels.width,pixels.height).levels[0];
  const top=probe(upper),bottom=probe(low),projected=probe((upper+low)/2);
  if(!top||!bottom||!projected||bottom.y-top.y>(bounds.bottom-bounds.top)*.12)return [];
  const witnesses=read.observations!.filter(p=>p.side===(high?"buy-side":"sell-side")&&p.x>=zone.x&&p.x<=zone.x2);
  if(witnesses.length<2||witnesses.length>12)return [];
  const seen=new Set<number>(),touches:{x:number;y:number}[]=[];
  for(const point of witnesses){
   if(![point.x,point.y].every(Number.isFinite)||!["MEDIUM","HIGH"].includes(point.confidence)||point.y<top.y-2/pixels.height*100||point.y>bottom.y+2/pixels.height*100)return [];
   const px=point.x*pixels.width/100,py=point.y*pixels.height/100;
   const matches=pixels.candles.filter(c=>px>=c.left-2&&px<=c.right+2&&Math.abs((high?c.highY:c.lowY)-py)<=2);
   if(matches.length!==1||seen.has(matches[0].id))return [];
   const c=matches[0],endpoint=(high?c.highY:c.lowY)/pixels.height*100;
   if(endpoint<top.y-2/pixels.height*100||endpoint>bottom.y+2/pixels.height*100)return [];
   seen.add(c.id);touches.push({x:c.x/pixels.width*100,y:endpoint});
  }
  if(Math.max(...touches.map(p=>p.x))-Math.min(...touches.map(p=>p.x))<5)return [];
  // Exact supplied interval only. Scalar candidates remain a zero-width line.
  return [{...zone,x:projected.x,x2:projected.x2,y:projected.y,top:top.y,height:bottom.y-top.y,touches}];
 });
}
