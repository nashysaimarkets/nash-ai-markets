export type DevicePlotBounds = { left:number; top:number; right:number; bottom:number };
export type DeviceLevel = { kind:"support"|"resistance"; label:string; price:string; x:number; y:number; x2:number; y2:number };
export type DevicePattern = {
  name:string;
  status:"FORMING"|"CONFIRMED"|"FAILED"|"AMBIGUOUS"|"EXTENDED";
  confidence:"LOW"|"MEDIUM"|"HIGH";
  evidence:string;
  confirmation:string;
  invalidation:string;
  geometry:{ points:{x:number;y:number}[]; labelX:number; labelY:number };
};
export type DeviceLiquidityZone = {
  side:"BUY_SIDE"|"SELL_SIDE";
  basis:"EQUAL_HIGHS"|"EQUAL_LOWS"|"PRIOR_SWING_HIGH"|"PRIOR_SWING_LOW"|"RANGE_HIGH"|"RANGE_LOW";
  price:string; x:number; x2:number; y:number;
};
export type DeviceLiquidityRead = {
  state:"VERIFIED"|"PARTIAL"|"NONE";
  event:"NONE"|"TESTING"|"SWEEP"|"RECLAIM"|"REJECTION";
  confidence:"LOW"|"MEDIUM"|"HIGH";
  evidence:string; confirmation:string; invalidation:string; zones:DeviceLiquidityZone[];
};
export type DeviceLocalScan = {
  levels:DeviceLevel[];
  patterns:DevicePattern[];
  liquidity:DeviceLiquidityRead;
  candleCount:number;
  swingCount:number;
  plotBounds:DevicePlotBounds;
};

type Candle={x:number;high:number;low:number;mid:number};
type Swing={x:number;y:number;kind:"high"|"low"};
type Cluster={items:Swing[];y:number;score:number};

const EMPTY_LIQUIDITY:DeviceLiquidityRead={state:"NONE",event:"NONE",confidence:"LOW",evidence:"No repeated swing reference was strong enough on-device.",confirmation:"",invalidation:"",zones:[]};
export function emptyDeviceScan():DeviceLocalScan{
  return {levels:[],patterns:[],liquidity:{...EMPTY_LIQUIDITY,zones:[]},candleCount:0,swingCount:0,plotBounds:{left:4,top:12,right:91,bottom:88}};
}

function linearFit(points:Swing[]){
  if(points.length<2) return null;
  const n=points.length;
  const mx=points.reduce((s,p)=>s+p.x,0)/n, my=points.reduce((s,p)=>s+p.y,0)/n;
  let num=0,den=0;
  for(const p of points){num+=(p.x-mx)*(p.y-my);den+=(p.x-mx)*(p.x-mx);}
  if(den===0)return null;
  const slope=num/den, intercept=my-slope*mx;
  const rms=Math.sqrt(points.reduce((s,p)=>{const e=p.y-(slope*p.x+intercept);return s+e*e;},0)/n);
  return {slope,intercept,rms};
}
function lineY(fit:{slope:number;intercept:number},x:number){return fit.slope*x+fit.intercept;}

function normalizePivots(swings:Swing[]){
  const sorted=[...swings].sort((a,b)=>a.x-b.x || (a.kind==="high"?-1:1));
  const out:Swing[]=[];
  for(const s of sorted){
    const last=out.at(-1);
    if(!last){out.push(s);continue;}
    if(Math.abs(s.x-last.x)<2){
      if(s.kind===last.kind){
        if((s.kind==="high"&&s.y<last.y)||(s.kind==="low"&&s.y>last.y)) out[out.length-1]=s;
      }
      continue;
    }
    if(s.kind===last.kind){
      if((s.kind==="high"&&s.y<last.y)||(s.kind==="low"&&s.y>last.y)) out[out.length-1]=s;
    }else out.push(s);
  }
  return out;
}

function headShoulders(pivots:Swing[],candles:Candle[],width:number,height:number,pctX:(x:number)=>number,pctY:(y:number)=>number,bounds:DevicePlotBounds){
  const candidates:{pattern:DevicePattern;score:number}[]=[];
  for(let i=0;i<=pivots.length-5;i++){
    const p=pivots.slice(i,i+5);
    const span=p[4].x-p[0].x;
    if(span<width*.18)continue;
    const leftSpace=p[2].x-p[0].x,rightSpace=p[4].x-p[2].x;
    const symmetry=Math.min(leftSpace,rightSpace)/Math.max(leftSpace,rightSpace);
    if(symmetry<.34)continue;
    if(p.map(x=>x.kind).join("")==="highlowhighlowhigh"){
      const [ls,n1,head,n2,rs]=p;
      const shoulderDiff=Math.abs(ls.y-rs.y), headProm=Math.min(ls.y,rs.y)-head.y;
      const neckDiff=Math.abs(n1.y-n2.y);
      if(headProm<height*.045||shoulderDiff>height*.075||neckDiff>height*.1)continue;
      const slope=(n2.y-n1.y)/Math.max(1,n2.x-n1.x);
      const after=candles.filter(c=>c.x>rs.x);
      const confirmed=after.some(c=>c.low>(n1.y+slope*(c.x-n1.x))+height*.012);
      const points=[ls,n1,head,n2,rs].map(x=>({x:pctX(x.x),y:pctY(x.y)}));
      candidates.push({score:headProm/height+symmetry*.08-neckDiff/height*.25,pattern:{
        name:"HEAD & SHOULDERS",status:confirmed?"CONFIRMED":"AMBIGUOUS",confidence:confirmed?"MEDIUM":"LOW",
        evidence:confirmed?"Three-peak geometry with a higher head is followed by a visible neckline break.":"Three-peak geometry with a higher head is visible, but neckline breakdown is not proven on-device.",
        confirmation:"Visible close/acceptance below the neckline after the right shoulder.",invalidation:"Clean acceptance above the head or a materially higher right shoulder.",
        geometry:{points,labelX:pctX(rs.x),labelY:Math.max(bounds.top,pctY(Math.min(ls.y,head.y,rs.y))-4)}
      }});
    }
    if(p.map(x=>x.kind).join("")==="lowhighlowhighlow"){
      const [ls,n1,head,n2,rs]=p;
      const shoulderDiff=Math.abs(ls.y-rs.y), headProm=head.y-Math.max(ls.y,rs.y);
      const neckDiff=Math.abs(n1.y-n2.y);
      if(headProm<height*.045||shoulderDiff>height*.075||neckDiff>height*.1)continue;
      const slope=(n2.y-n1.y)/Math.max(1,n2.x-n1.x);
      const after=candles.filter(c=>c.x>rs.x);
      const confirmed=after.some(c=>c.high<(n1.y+slope*(c.x-n1.x))-height*.012);
      const points=[ls,n1,head,n2,rs].map(x=>({x:pctX(x.x),y:pctY(x.y)}));
      candidates.push({score:headProm/height+symmetry*.08-neckDiff/height*.25,pattern:{
        name:"INVERSE H&S",status:confirmed?"CONFIRMED":"AMBIGUOUS",confidence:confirmed?"MEDIUM":"LOW",
        evidence:confirmed?"Three-trough geometry with a lower head is followed by a visible neckline break.":"Three-trough geometry with a lower head is visible, but neckline breakout is not proven on-device.",
        confirmation:"Visible close/acceptance above the neckline after the right shoulder.",invalidation:"Clean acceptance below the head or a materially lower right shoulder.",
        geometry:{points,labelX:pctX(rs.x),labelY:Math.min(bounds.bottom,pctY(Math.max(ls.y,head.y,rs.y))+4)}
      }});
    }
  }
  return candidates.sort((a,b)=>b.score-a.score)[0]?.pattern ?? null;
}

function boundaryPattern(pivots:Swing[],width:number,height:number,pctX:(x:number)=>number,pctY:(y:number)=>number,bounds:DevicePlotBounds){
  const candidates:{pattern:DevicePattern;score:number}[]=[];
  const maxWindow=Math.min(16,pivots.length);
  for(let size=6;size<=maxWindow;size++){
    for(let start=0;start+size<=pivots.length;start++){
      const window=pivots.slice(start,start+size), highs=window.filter(p=>p.kind==="high"), lows=window.filter(p=>p.kind==="low");
      if(highs.length<2||lows.length<2)continue;
      const x1=window[0].x,x2=window.at(-1)!.x,span=x2-x1;
      if(span<width*.18)continue;
      const hf=linearFit(highs),lf=linearFit(lows);if(!hf||!lf)continue;
      if(hf.rms>height*.05||lf.rms>height*.05)continue;
      const sep1=lineY(lf,x1)-lineY(hf,x1),sep2=lineY(lf,x2)-lineY(hf,x2);
      if(sep1<height*.045||sep2<height*.025)continue;
      const hChange=hf.slope*span/height,lChange=lf.slope*span/height;
      const converging=sep2<sep1*.82;
      const parallel=Math.abs(hChange-lChange)<.055 && sep2/sep1>.58 && sep2/sep1<1.48;
      let name="",evidence="";
      if(Math.abs(hChange)<.035&&lChange<-.055&&converging){name="ASCENDING TRIANGLE";evidence="Flat upper reactions and rising swing lows form a converging structure.";}
      else if(hChange>.055&&Math.abs(lChange)<.035&&converging){name="DESCENDING TRIANGLE";evidence="Falling swing highs and a broadly flat lower boundary form a converging structure.";}
      else if(hChange>.045&&lChange<-.045&&converging){name="TRIANGLE";evidence="Falling highs and rising lows form a converging triangle.";}
      else if(hChange<-.03&&lChange<-.06&&lChange<hChange-.02&&converging){name="RISING WEDGE";evidence="Both boundaries rise while the lower boundary converges faster into the upper boundary.";}
      else if(hChange>.06&&lChange>.03&&hChange>lChange+.02&&converging){name="FALLING WEDGE";evidence="Both boundaries fall while the upper boundary converges faster into the lower boundary.";}
      else if(parallel&&Math.abs((hChange+lChange)/2)>.055){name="TREND CHANNEL";evidence="Swing highs and lows track approximately parallel sloping boundaries.";}
      else continue;
      const touchScore=Math.min(6,highs.length+lows.length);
      const score=touchScore*.1+span/width*.25-(hf.rms+lf.rms)/height;
      const points=[
        {x:pctX(x1),y:pctY(lineY(hf,x1))},{x:pctX(x2),y:pctY(lineY(hf,x2))},
        {x:pctX(x2),y:pctY(lineY(lf,x2))},{x:pctX(x1),y:pctY(lineY(lf,x1))}
      ];
      candidates.push({score,pattern:{
        name,status:"AMBIGUOUS",confidence:highs.length>=3&&lows.length>=3?"MEDIUM":"LOW",evidence,
        confirmation:name==="TREND CHANNEL"?"A further clean reaction at either boundary or a decisive channel break.":"A decisive break/hold beyond the converging boundary.",
        invalidation:"Price action no longer respects the proposed boundary geometry.",
        geometry:{points,labelX:Math.max(bounds.left,pctX(x2)-18),labelY:Math.max(bounds.top,pctY(Math.min(lineY(hf,x1),lineY(hf,x2)))-4)}
      }});
    }
  }
  return candidates.sort((a,b)=>b.score-a.score)[0]?.pattern ?? null;
}

function flagPattern(candles:Candle[],width:number,height:number,pctX:(x:number)=>number,pctY:(y:number)=>number,bounds:DevicePlotBounds){
  if(candles.length<18)return null;
  let best:{score:number;pattern:DevicePattern}|null=null;
  for(let split=8;split<candles.length-8;split++){
    const poleStart=Math.max(0,split-8), a=candles[poleStart], b=candles[split];
    const pole=b.mid-a.mid, poleMag=Math.abs(pole);
    if(poleMag<height*.14||b.x-a.x>width*.28)continue;
    const rest=candles.slice(split+1,Math.min(candles.length,split+15));
    if(rest.length<7)continue;
    const range=Math.max(...rest.map(c=>c.low))-Math.min(...rest.map(c=>c.high));
    if(range>poleMag*.62)continue;
    const xMean=rest.reduce((s,c)=>s+c.x,0)/rest.length,yMean=rest.reduce((s,c)=>s+c.mid,0)/rest.length;
    let num=0,den=0;for(const c of rest){num+=(c.x-xMean)*(c.mid-yMean);den+=(c.x-xMean)**2;}
    const slope=den?num/den:0,total=slope*(rest.at(-1)!.x-rest[0].x);
    const bull=pole<0&&total>height*.015, bear=pole>0&&total< -height*.015;
    if(!bull&&!bear)continue;
    const name=bull?"BULL FLAG":"BEAR FLAG";
    const top=Math.min(...rest.map(c=>c.high)),bottom=Math.max(...rest.map(c=>c.low));
    const points=[{x:pctX(rest[0].x),y:pctY(top)},{x:pctX(rest.at(-1)!.x),y:pctY(top+total)},{x:pctX(rest.at(-1)!.x),y:pctY(bottom+total)},{x:pctX(rest[0].x),y:pctY(bottom)}];
    const pattern:DevicePattern={name,status:"AMBIGUOUS",confidence:"LOW",evidence:"A strong directional pole is followed by a shorter, narrower counter-trend consolidation.",confirmation:"Break from the flag in the direction of the preceding impulse.",invalidation:"The consolidation expands materially or breaks against the preceding impulse.",geometry:{points,labelX:pctX(rest.at(-1)!.x),labelY:Math.max(bounds.top,pctY(top)-4)}};
    const score=poleMag/height-range/height;
    if(!best||score>best.score)best={score,pattern};
  }
  return best?.pattern ?? null;
}

export function scanDevicePixels(input:{pixels:ArrayLike<number>;width:number;height:number;channels?:number}):DeviceLocalScan{
  try{
    const {pixels,width,height}=input,channels=input.channels??4;
    if(width<20||height<20)return emptyDeviceScan();
    const left=Math.round(width*.04),right=Math.round(width*.91),top=Math.round(height*.08),bottom=Math.round(height*.88);
    const collectColumns=(allowBlue:boolean)=>{
      const runs:{x:number;ys:number[];span:number}[]=[];
      for(let x=left;x<=right;x++){
        const ys:number[]=[];
        for(let y=top;y<=bottom;y++){
          const i=(y*width+x)*channels,r=Number(pixels[i]??0),g=Number(pixels[i+1]??0),b=Number(pixels[i+2]??0),a=channels>=4?Number(pixels[i+3]??255):255;
          if(a<180)continue;
          const hi=Math.max(r,g,b),lo=Math.min(r,g,b),sat=hi-lo;
          const redOrGreen=(g>r+18&&g>b+6)||(r>g+18&&r>b+6);
          const blueFallback=allowBlue&&b>r+24&&b>g+10;
          if(sat>42&&hi>90&&(redOrGreen||blueFallback))ys.push(y);
        }
        if(ys.length>=2){const span=Math.max(...ys)-Math.min(...ys);if(span>=3)runs.push({x,ys,span});}
      }
      return runs;
    };
    let columnRuns=collectColumns(false);if(columnRuns.length<12)columnRuns=collectColumns(true);
    const selected:{x:number;ys:number[];span:number}[]=[];
    for(const candidate of [...columnRuns].sort((a,b)=>b.span-a.span)){
      if(selected.every(existing=>Math.abs(existing.x-candidate.x)>=3))selected.push(candidate);
    }
    selected.sort((a,b)=>a.x-b.x);
    const candles:Candle[]=selected.map(c=>{const high=Math.min(...c.ys),low=Math.max(...c.ys);return{x:c.x,high,low,mid:(high+low)/2};});
    if(candles.length<6)return emptyDeviceScan();
    const pctX=(x:number)=>x/width*100,pctY=(y:number)=>y/height*100;
    const candleLeft=Math.max(left,Math.min(...candles.map(v=>v.x))-width*.012);
    const candleRight=Math.min(right,Math.max(...candles.map(v=>v.x))+width*.018);
    const candleTop=Math.max(top,Math.min(...candles.map(v=>v.high))-height*.012);
    const candleBottom=Math.min(bottom,Math.max(...candles.map(v=>v.low))+height*.012);
    const plotBounds={left:pctX(candleLeft),top:pctY(candleTop),right:pctX(candleRight),bottom:pctY(candleBottom)};
    const swings:Swing[]=[];
    for(let i=2;i<candles.length-2;i++){
      const c=candles[i],near=candles.slice(i-2,i+3);
      if(c.high===Math.min(...near.map(v=>v.high)))swings.push({x:c.x,y:c.high,kind:"high"});
      if(c.low===Math.max(...near.map(v=>v.low)))swings.push({x:c.x,y:c.low,kind:"low"});
    }
    const cluster=(kind:"high"|"low")=>{
      const src=swings.filter(s=>s.kind===kind).sort((a,b)=>a.y-b.y),groups:Swing[][]=[],tol=Math.max(3,height*.018);
      for(const s of src){const found=groups.find(g=>Math.abs(g.reduce((n,v)=>n+v.y,0)/g.length-s.y)<=tol);if(found)found.push(s);else groups.push([s]);}
      return groups.map(items=>({items,y:items.reduce((n,v)=>n+v.y,0)/items.length,score:items.length} as Cluster)).sort((a,b)=>b.score-a.score||(kind==="high"?a.y-b.y:b.y-a.y));
    };
    const highs=cluster("high"),lows=cluster("low");
    const rank=(g:Cluster)=>{const recency=Math.max(...g.items.map(i=>i.x))/width,spread=Math.max(...g.items.map(i=>i.y))-Math.min(...g.items.map(i=>i.y));return g.score*4+recency*2-spread/Math.max(2,height*.02);};
    const ranked=[...highs.map(group=>({kind:"resistance" as const,group,rank:rank(group)})),...lows.map(group=>({kind:"support" as const,group,rank:rank(group)}))].sort((a,b)=>b.rank-a.rank);
    const picked=ranked.slice(0,3);
    if(!picked.some(x=>x.kind==="resistance")&&highs[0])picked[picked.length-1]={kind:"resistance",group:highs[0],rank:rank(highs[0])};
    if(!picked.some(x=>x.kind==="support")&&lows[0])picked[picked.length-1]={kind:"support",group:lows[0],rank:rank(lows[0])};
    const levels:DeviceLevel[]=picked.filter((item,index,array)=>array.findIndex(other=>other.kind===item.kind&&Math.abs(other.group.y-item.group.y)<height*.025)===index).map(({kind,group})=>({kind,label:group.score>=3?(kind==="resistance"?"Repeated rejection highs":"Repeated defended lows"):group.score>=2?(kind==="resistance"?"Repeated swing highs":"Repeated swing lows"):(kind==="resistance"?"Prominent swing high":"Prominent swing low"),price:"",x:plotBounds.left,y:pctY(group.y),x2:plotBounds.right,y2:pctY(group.y)})).slice(0,3);

    const pivots=normalizePivots(swings);
    const patterns:DevicePattern[]=[];
    const hs=headShoulders(pivots,candles,width,height,pctX,pctY,plotBounds);
    if(hs)patterns.push(hs);

    if(!patterns.length){
      for(let i=0;i<=pivots.length-3;i++){
        const [a,m,b]=pivots.slice(i,i+3),span=b.x-a.x;if(span<width*.18)continue;
        if(a.kind==="high"&&m.kind==="low"&&b.kind==="high"&&Math.abs(a.y-b.y)<=height*.045&&m.y-(a.y+b.y)/2>=height*.065){
          patterns.push({name:"DOUBLE TOP CANDIDATE",status:"AMBIGUOUS",confidence:"LOW",evidence:"Two separated swing highs and an intervening valley are visible, but neckline confirmation is not proven on-device.",confirmation:"Break below the intervening swing low after the second test.",invalidation:"Clean acceptance above the twin highs.",geometry:{points:[a,m,b].map(p=>({x:pctX(p.x),y:pctY(p.y)})),labelX:pctX(b.x),labelY:Math.max(plotBounds.top,pctY(b.y)-4)}});break;
        }
        if(a.kind==="low"&&m.kind==="high"&&b.kind==="low"&&Math.abs(a.y-b.y)<=height*.045&&(a.y+b.y)/2-m.y>=height*.065){
          patterns.push({name:"DOUBLE BOTTOM CANDIDATE",status:"AMBIGUOUS",confidence:"LOW",evidence:"Two separated swing lows and an intervening peak are visible, but neckline confirmation is not proven on-device.",confirmation:"Break above the intervening swing high after the second test.",invalidation:"Clean acceptance below the twin lows.",geometry:{points:[a,m,b].map(p=>({x:pctX(p.x),y:pctY(p.y)})),labelX:pctX(b.x),labelY:Math.min(plotBounds.bottom,pctY(b.y)+4)}});break;
        }
      }
    }
    if(!patterns.length){const boundary=boundaryPattern(pivots,width,height,pctX,pctY,plotBounds);if(boundary)patterns.push(boundary);}
    if(!patterns.length){const flag=flagPattern(candles,width,height,pctX,pctY,plotBounds);if(flag)patterns.push(flag);}

    if(!patterns.length){
      const rh=highs.find(g=>g.score>=2),rl=lows.find(g=>g.score>=2);
      if(rh&&rl){
        const events=[...rh.items.map(i=>({x:i.x,kind:"high" as const})),...rl.items.map(i=>({x:i.x,kind:"low" as const}))].sort((a,b)=>a.x-b.x);
        const xStart=Math.min(...events.map(e=>e.x)),xEnd=Math.max(...events.map(e=>e.x)),spanPct=(xEnd-xStart)/width*100;
        let alternations=0;for(let i=1;i<events.length;i++)if(events[i].kind!==events[i-1].kind)alternations++;
        const separation=rl.y-rh.y,breakTol=height*.02,inside=candles.filter(c=>c.x>=xStart&&c.x<=xEnd);
        const upperBreaches=inside.filter(c=>c.high<rh.y-breakTol).length,lowerBreaches=inside.filter(c=>c.low>rl.y+breakTol).length;
        const x1=Math.max(plotBounds.left,pctX(xStart)),x2=Math.min(plotBounds.right,pctX(xEnd));
        if(rh.score>=2&&rl.score>=2&&separation>=height*.09&&separation<=height*.5&&spanPct>=24&&alternations>=3&&upperBreaches<=1&&lowerBreaches<=1){
          patterns.push({name:"RECTANGLE / RANGE",status:"FORMING",confidence:"MEDIUM",evidence:"Repeated upper and lower reactions alternate across a sustained, largely intact range.",confirmation:"Break and hold beyond one range edge after repeated two-sided rotation.",invalidation:"A decisive breach through the opposite edge invalidates the range read.",geometry:{points:[{x:x1,y:pctY(rh.y)},{x:x2,y:pctY(rh.y)},{x:x2,y:pctY(rl.y)},{x:x1,y:pctY(rl.y)},{x:x1,y:pctY(rh.y)}],labelX:Math.max(plotBounds.left,x2-18),labelY:Math.max(plotBounds.top,pctY(rh.y)-4)}});
        }else if(rh.score>=2&&rl.score>=2&&separation>=height*.09&&spanPct>=18&&alternations>=2&&upperBreaches<=1&&lowerBreaches<=1){
          patterns.push({name:"RANGE CANDIDATE",status:"AMBIGUOUS",confidence:"LOW",evidence:"Two-sided reactions are visible, but the geometry is not clean enough to call a rectangle.",confirmation:"More alternating tests with both boundaries holding.",invalidation:"A decisive break through either proposed boundary.",geometry:{points:[{x:x1,y:pctY(rh.y)},{x:x2,y:pctY(rh.y)},{x:x2,y:pctY(rl.y)},{x:x1,y:pctY(rl.y)},{x:x1,y:pctY(rh.y)}],labelX:Math.max(plotBounds.left,x2-18),labelY:Math.max(plotBounds.top,pctY(rh.y)-4)}});
        }
      }
    }


    const zones:DeviceLiquidityZone[]=[];
    const h=highs[0],l=lows[0];
    if(h){const sx=pctX(Math.min(...h.items.map(i=>i.x)));zones.push({side:"BUY_SIDE",basis:h.score>=2?"EQUAL_HIGHS":"PRIOR_SWING_HIGH",price:"",x:sx,x2:Math.max(sx+5,plotBounds.right),y:pctY(h.y)});}
    if(l){const sx=pctX(Math.min(...l.items.map(i=>i.x)));zones.push({side:"SELL_SIDE",basis:l.score>=2?"EQUAL_LOWS":"PRIOR_SWING_LOW",price:"",x:sx,x2:Math.max(sx+5,plotBounds.right),y:pctY(l.y)});}
    const liquidity:DeviceLiquidityRead=zones.length?{state:"PARTIAL",event:"NONE",confidence:"LOW",evidence:"Device scan found visible liquidity references only; this is not a verified liquidity event or hidden-order claim.",confirmation:"A visible sweep, reclaim or rejection is required before this becomes an event.",invalidation:"The reference is invalid if price cleanly accepts beyond it.",zones}:{...EMPTY_LIQUIDITY,zones:[]};
    return {levels,patterns:patterns.slice(0,2),liquidity,candleCount:candles.length,swingCount:swings.length,plotBounds};
  }catch{return emptyDeviceScan();}
}
