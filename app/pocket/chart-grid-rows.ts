/** Read horizontal rules from the original raster; never infer their prices.
 * Sparse column sampling keeps this linear in image height on mobile.
 */
export function chartGridRows(image: { data: Uint8ClampedArray; width: number; height: number }, bounds: {left:number;right:number;top:number;bottom:number}) {
  const {data,width,height}=image;
  if(!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0 || data.length !== width*height*4 || !Object.values(bounds).every(Number.isFinite))return [];
  const left=Math.max(0,Math.ceil(width*(bounds.left+.05*(bounds.right-bounds.left))/100));
  const right=Math.min(width-1,Math.floor(width*(bounds.right-.05*(bounds.right-bounds.left))/100));
  const top=Math.max(4,Math.floor(height*bounds.top/100)),bottom=Math.min(height-5,Math.ceil(height*bounds.bottom/100));
  if(right<=left || bottom<=top)return [];
  const samples=Math.min(120,right-left+1);
  const rows:Array<{coverage:number;tone:number}>=[];
  for(let y=top-4;y<=bottom+4;y++){
    const bins=new Map<number,{count:number;sum:number}>();
    for(let i=0;i<samples;i++){
      const x=Math.round(left+(right-left)*i/Math.max(1,samples-1));const offset=(y*width+x)*4;
      const r=data[offset],g=data[offset+1],b=data[offset+2];
      const key=(r>>3)*1024+(g>>3)*32+(b>>3);const bin=bins.get(key)??{count:0,sum:0};bin.count++;bin.sum+=(r+g+b)/3;bins.set(key,bin);
    }
    const dominant=[...bins.values()].sort((a,b)=>b.count-a.count)[0];
    rows[y]={coverage:dominant.count/samples,tone:dominant.sum/dominant.count};
  }
  const candidates:number[]=[];
  for(let y=top;y<=bottom;y++){
    const row=rows[y],before=rows[y-4],after=rows[y+4];
    if(row.coverage>=.7 && before.coverage>=.6 && after.coverage>=.6
      && Math.abs(before.tone-after.tone)<6 && Math.abs(row.tone-(before.tone+after.tone)/2)>=10)candidates.push(y);
  }
  const groups:number[][]=[];
  for(const y of candidates){const last=groups.at(-1);if(last && y<=last.at(-1)!+1)last.push(y);else groups.push([y]);}
  return groups.filter(g=>g.length<=7).map(g=>g.reduce((s,y)=>s+y,0)/g.length/height*100);
}
