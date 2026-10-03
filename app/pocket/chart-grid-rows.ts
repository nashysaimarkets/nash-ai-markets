import {axisReadingBounds} from './axis-reading-bounds';
/** Read horizontal rules from the original raster; never infer their prices.
 * Sparse column sampling keeps this linear in image height on mobile.
 */
export function chartGridRows(image:{data:Uint8ClampedArray;width:number;height:number},bounds:{left:number;right:number;top:number;bottom:number}){
 const {data,width,height}=image;
 if(!Number.isInteger(width)||!Number.isInteger(height)||width<=0||height<=0||data.length!==width*height*4||!Object.values(bounds).every(Number.isFinite))return [];
 const left=Math.max(0,Math.ceil(width*(bounds.left+.05*(bounds.right-bounds.left))/100));
 const right=Math.min(width-1,Math.floor(width*(bounds.right-.05*(bounds.right-bounds.left))/100));
 const reading=axisReadingBounds(bounds,height);
 const top=Math.max(4,Math.floor(height*reading.top/100)),bottom=Math.min(height-5,Math.ceil(height*reading.bottom/100));
 if(right<=left||bottom<=top)return [];
 const samples=Math.min(120,right-left+1),rows:Float64Array[]=[];
 for(let y=top-4;y<=bottom+4;y++){
  const tones=new Float64Array(samples);
  for(let i=0;i<samples;i++){const x=Math.round(left+(right-left)*i/Math.max(1,samples-1)),offset=(y*width+x)*4;tones[i]=(data[offset]+data[offset+1]+data[offset+2])/3;}
  rows[y]=tones;
 }
 const candidates:number[]=[];
 for(let y=top;y<=bottom;y++){
  let stable=0;
  const polarities=[{count:0,segments:0,first:samples,last:0},{count:0,segments:0,first:samples,last:0}];
  for(let i=0;i<samples;i++){
   const before=rows[y-4][i],after=rows[y+4][i];
   if(Math.abs(before-after)>=6)continue;
   stable++;
   const difference=rows[y][i]-(before+after)/2;
   if(Math.abs(difference)<10)continue;
   const rule=polarities[difference>0?0:1];rule.count++;rule.first=Math.min(rule.first,i);rule.last=i;rule.segments|=1<<Math.min(5,Math.floor(i*6/samples));
  }
  // Compare each column to its own neighbours: gradient backgrounds must
  // not change the calibration. Same-polarity contrast must span the plot.
  if(stable>=samples*.7 && polarities.some(rule=>rule.count>=Math.max(5,samples*.04)
   && (rule.last-rule.first)/Math.max(1,samples-1)>=.75
   && rule.segments.toString(2).replaceAll('0','').length>=4))candidates.push(y);
 }
 const groups:number[][]=[];
 for(const y of candidates){const last=groups.at(-1);if(last&&y<=last.at(-1)!+1)last.push(y);else groups.push([y]);}
 return groups.filter(g=>g.length<=7).map(g=>g.reduce((sum,y)=>sum+y,0)/g.length/height*100);
}
