import type { CandlePixels } from './candle-pixels';
import type { AxisVerification } from './axis-verification';
import { parseLiquidityCurrentPrice, type LiquidityShield, type LiquidityPlotBounds, type LiquidityScaleAnchor, type ProjectedLiquidityZone } from './liquidity-guard';

/** Prices come from the source report; placement comes only from independent pixels. */
export function preciseLiquidityZones(shield:LiquidityShield|undefined,currentPrice:string|undefined,model:LiquidityScaleAnchor[],bounds:LiquidityPlotBounds|undefined,axis:AxisVerification|null,width:number,height:number,pixels:CandlePixels|null=null){
 const hold=(reason:string)=>({zones:[] as ProjectedLiquidityZone[],reason,candidateReasons:[] as {index:number;reason:string}[]});
 if(!axis)return hold('Verifying the original price labels…');
 if(axis.status==='held')return hold(axis.reason);
 if(!bounds||![width,height,...Object.values(bounds)].every(Number.isFinite)||width<=0||height<=0||bounds.left<0||bounds.top<0||bounds.right>100||bounds.bottom>100||bounds.left>=bounds.right||bounds.top>=bounds.bottom)return hold('Original chart bounds need verification.');
 const anchors=[...axis.anchors].sort((a,b)=>a.y-b.y);
 if(anchors.length<3||anchors.some((a,i)=>!Number.isFinite(a.price)||a.price<=0||!Number.isFinite(a.y)||a.y<bounds.top||a.y>bounds.bottom||(i>0&& (a.y<=anchors[i-1].y||a.price>=anchors[i-1].price)))||anchors.at(-1)!.y-anchors[0].y<20)return hold('Independent price scale needs verification.');
 const matches=new Set(model.filter(a=>anchors.some(b=>Math.abs(a.price-b.price)<=Math.max(1e-10,b.price*1e-10))).map(a=>a.price));
 if(matches.size<3)return hold('The source scan and independent price reader disagree.');
 const mp=anchors.reduce((s,a)=>s+a.price,0)/anchors.length,my=anchors.reduce((s,a)=>s+a.y,0)/anchors.length;
 const slope=anchors.reduce((s,a)=>s+(a.price-mp)*(a.y-my),0)/anchors.reduce((s,a)=>s+(a.price-mp)**2,0);
 const y=(p:number)=>my+(p-mp)*slope;
 if(!Number.isFinite(slope)||slope>=0||anchors.some(a=>Math.abs(y(a.price)-a.y)*height/100>1.5))return hold('Independent price labels do not establish a precise linear scale.');
 const covered=(p:number)=>Number.isFinite(p)&&p>=anchors.at(-1)!.price&&p<=anchors[0].price;
 const current=parseLiquidityCurrentPrice(currentPrice);
 if(current===null||!covered(current))return hold('Current price is outside the verified scale.');
 if(shield?.status!=='VISIBLE_RISK_ZONES'||!Array.isArray(shield.zones))return hold('No drawable stop-risk candidates.');
 const right=Math.min(bounds.right,axis.axisLeft===undefined?bounds.right:axis.axisLeft/width*100-1);
 if(!Number.isFinite(right)||right<=bounds.left)return hold('Price-label column needs verification.');
 if(!pixels||pixels.width!==width||pixels.height!==height)return hold('Original candle pixels need independent verification.');
 const zones:ProjectedLiquidityZone[]=[],candidateReasons:{index:number;reason:string}[]=[];
 for(const [index,zone] of shield.zones.entries()){
  const reject=(reason:string)=>candidateReasons.push({index,reason});
  if(zone.confidence!=='HIGH'){reject('Reported confidence is below the drawing requirement.');continue;}
  if(!covered(zone.priceLow)||!covered(zone.priceHigh)||zone.priceHigh<zone.priceLow){reject(`The complete price band is not inside the independently read scale (${anchors.at(-1)!.price}–${anchors[0].price}).`);continue;}
  if(zone.side==='ABOVE_PRICE'?zone.priceLow<=current:zone.side==='BELOW_PRICE'?zone.priceHigh>=current:zone.side==='AT_PRICE'?current<zone.priceLow||current>zone.priceHigh:true){reject('The stated side disagrees with the verified chart price.');continue;}
  const top=y(zone.priceHigh),bottom=y(zone.priceLow),heightPercent=bottom-top;
  if(top<bounds.top||bottom>bounds.bottom||heightPercent>(bounds.bottom-bounds.top)*.12){reject('The calibrated band exceeds the verified plot bounds or area limit.');continue;}
  if(!Array.isArray(zone.touchPoints)||zone.touchPoints.some(p=>![p.x,p.y].every(Number.isFinite)||p.x<bounds.left||p.x>right||p.y<top-2/height*100||p.y>bottom+2/height*100)){reject('Reported touch coordinates do not agree with the calibrated price band.');continue;}
  // Associate by the reported location inside a component. Never search for a candle
  // simply because its endpoint happens to fit the proposed price band.
  const used=new Set<number>(),touches:typeof zone.touchPoints=[];
  let supported=true;
  for(const point of zone.touchPoints){
   const px=point.x*width/100,py=point.y*height/100;
   const candidates=pixels.candles.filter(c=>px>=c.left-2&&px<=c.right+2&&py>=c.highY-2&&py<=c.lowY+2);
   if(candidates.length!==1){supported=false;break;}
   const candle=candidates[0];
   const edge=zone.pattern==='EQUAL_HIGHS'?'high':zone.pattern==='EQUAL_LOWS'?'low':zone.side==='ABOVE_PRICE'?'high':zone.side==='BELOW_PRICE'?'low':null;
   if(!edge||(edge==='high'&&zone.side==='BELOW_PRICE')||(edge==='low'&&zone.side==='ABOVE_PRICE')){supported=false;break;}
   const endpoint=edge==='high'?candle.highY:candle.lowY,wick=edge==='high'?candle.upperWick:candle.lowerWick;
   if(!wick||used.has(candle.id)||Math.abs(endpoint-py)>2||endpoint<top*height/100-2||endpoint>bottom*height/100+2||candle.x<bounds.left*width/100||candle.x>right*width/100){supported=false;break;}
   used.add(candle.id);touches.push({x:candle.x/width*100,y:endpoint/height*100});
  }
  if(!supported||touches.length<2||touches.some((p,i)=>touches.slice(0,i).some(q=>Math.abs(p.x-q.x)*width/100<3))){reject('Not every reported touch matches a distinct original candle wick endpoint.');continue;}
  // Keep the exact price interval. A zero-width price band stays a line;
  // never enlarge it to make a visually impressive pool.
  zones.push({...zone,touchPoints:touches,lineY:(top+bottom)/2,top,height:heightPercent,left:bounds.left,right});
 }
 return {zones,reason:zones.length?null:'Candidates did not pass the price, side and independent wick-pixel checks.',candidateReasons};
}
