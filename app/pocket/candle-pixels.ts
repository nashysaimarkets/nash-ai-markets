import type {LiquidityPlotBounds} from './liquidity-guard';

export type PixelCandle={id:number;left:number;right:number;x:number;highY:number;lowY:number;upperWick:boolean;lowerWick:boolean};
export type CandlePixels={width:number;height:number;candles:PixelCandle[]};
type Raster={width:number;height:number;data:Uint8ClampedArray};

/** Conservative red/green candle witnesses, in original pixels. Ambiguous shapes stay absent. */
export function readCandlePixels(raster:Raster,bounds:LiquidityPlotBounds):CandlePixels|null{
 const {width,height,data}=raster;
 if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width*height>16_000_000||data.length!==width*height*4||
  ![bounds.left,bounds.right,bounds.top,bounds.bottom].every(Number.isFinite)||bounds.left<0||bounds.top<0||bounds.right>100||bounds.bottom>100||bounds.left>=bounds.right||bounds.top>=bounds.bottom)return null;
 const left=Math.ceil(bounds.left*width/100),right=Math.min(width-1,Math.floor(bounds.right*width/100)),top=Math.ceil(bounds.top*height/100),bottom=Math.min(height-1,Math.floor(bounds.bottom*height/100));
 const mask=new Uint8Array(width*height),seen=new Uint8Array(width*height),candles:PixelCandle[]=[];
 for(let y=top;y<=bottom;y++)for(let x=left;x<=right;x++){
  const i=(y*width+x)*4,r=data[i],g=data[i+1],b=data[i+2];
  if(data[i+3]<240)continue;
  mask[y*width+x]=r>110&&r>g*1.3&&r>b*1.3?1:g>85&&g>r*1.3&&g>b*.9?2:0;
 }
 for(let y=top;y<=bottom;y++)for(let x=left;x<=right;x++){
  const start=y*width+x;if(!mask[start]||seen[start])continue;
  const colour=mask[start],points=[start];seen[start]=1;let minX=x,maxX=x,minY=y,maxY=y;
  for(let k=0;k<points.length;k++){
   const n=points[k],nx=n%width,ny=Math.floor(n/width);minX=Math.min(minX,nx);maxX=Math.max(maxX,nx);minY=Math.min(minY,ny);maxY=Math.max(maxY,ny);
   for(const v of[nx>left?n-1:-1,nx<right?n+1:-1,ny>top?n-width:-1,ny<bottom?n+width:-1])if(v>=0&&!seen[v]&&mask[v]===colour){seen[v]=1;points.push(v);}
  }
  const w=maxX-minX+1,h=maxY-minY+1;
  // Reject horizontal annotations, huge merged structures, and plot-edge truncation.
  if(w<2||w>Math.max(4,width*.02)||h<5||h>(bottom-top)*.4||minY<=top||maxY>=bottom||minX<=left||maxX>=right)continue;
  const columns=new Uint32Array(w),rows=new Uint32Array(h);
  for(const n of points){columns[n%width-minX]++;rows[Math.floor(n/width)-minY]++;}
  const best=Math.max(...columns);if(best<h*.85)continue;
  const stems=Array.from(columns).flatMap((v,i)=>v===best?[i]:[]);
  // A flat wide rectangle is a body/label, not an independently located wick.
  const maxBody=rows.reduce((max,n)=>Math.max(max,n),0),upperWick=rows[0]<maxBody,lowerWick=rows[h-1]<maxBody;
  if(maxBody<2||(!upperWick&&!lowerWick)||rows.filter(v=>v>=2).length<2)continue;
  const supportedStems=stems.filter(i=>mask[minY*width+minX+i]===colour&&mask[maxY*width+minX+i]===colour);
  if(!supportedStems.length)continue;
  const stem=supportedStems[Math.floor(supportedStems.length/2)],stemX=minX+stem;
  if(mask[minY*width+stemX]!==colour||mask[maxY*width+stemX]!==colour)continue;
  candles.push({id:candles.length,left:minX,right:maxX,x:stemX,highY:minY,lowY:maxY,upperWick,lowerWick});
 }
 return {width,height,candles};
}
