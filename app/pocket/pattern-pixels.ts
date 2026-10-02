import type {CandlePixels} from './candle-pixels';
import type {LiquidityPlotBounds} from './liquidity-guard';
import type {Analysis} from './analysis-types';

/** Validate every historical vertex against an actual original-raster endpoint. */
export function pixelCheckedPatterns(patterns:Analysis['patterns'],timeframe:string,bounds:LiquidityPlotBounds|undefined,pixels:CandlePixels|null){
 if(!bounds||!pixels||![pixels.width,pixels.height,...Object.values(bounds)].every(Number.isFinite)||pixels.width<=0||pixels.height<=0||bounds.left<0||bounds.top<0||bounds.right>100||bounds.bottom>100||bounds.left>=bounds.right||bounds.top>=bounds.bottom)return [];
 const frame=(s:string|undefined)=>(s??'').toUpperCase().replace(/MIN(?:UTE)?S?/g,'M').replace(/HOUR(?:S)?/g,'H').replace(/[^A-Z0-9]/g,'');
 return patterns.flatMap(pattern=>{
  if((pattern.sourceRole??'PRIMARY')!=='PRIMARY'||frame(pattern.timeframe)!==frame(timeframe)||!['HIGH','MEDIUM'].includes(pattern.confidence??''))return [];
  const points=pattern.geometry?.points;if(!points||points.length<2||points.length>10)return [];
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
