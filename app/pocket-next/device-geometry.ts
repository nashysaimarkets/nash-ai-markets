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

function trendMove(candles:Candle[], x:number, width:number){
  const sample=candles.filter(c=>c.x>=x-width*.22&&c.x<x-width*.015);
  if(sample.length<6)return null;
  const first=sample.slice(0,Math.max(2,Math.floor(sample.length*.3))).reduce((s,c)=>s+c.mid,0)/Math.max(1,Math.floor(sample.length*.3));
  const last=sample.slice(-Math.max(2,Math.floor(sample.length*.3))).reduce((s,c)=>s+c.mid,0)/Math.max(1,Math.floor(sample.length*.3));
  return last-first;
}

function headShoulders(pivots:Swing[],candles:Candle[],width:number,height:number,pctX:(x:number)=>number,pctY:(y:number)=>number,bounds:DevicePlotBounds){
  const candidates:{pattern:DevicePattern;score:number}[]=[];
  const highs=pivots.filter(p=>p.kind==="high"), lows=pivots.filter(p=>p.kind==="low");
  const between=(items:Swing[],a:number,b:number)=>items.filter(p=>p.x>a&&p.x<b);

  for(let i=0;i<highs.length-2;i++) for(let j=i+1;j<highs.length-1;j++) for(let k=j+1;k<highs.length;k++){
    const ls=highs[i],head=highs[j],rs=highs[k], span=rs.x-ls.x;
    if(span<width*.22||span>width*.62||rs.x>width*.87)continue;
    const prior=trendMove(candles,ls.x,width);
    if(prior===null||prior> -height*.045)continue; // H&S should arrive after an actual advance.
    const leftSpace=head.x-ls.x,rightSpace=rs.x-head.x,symmetry=Math.min(leftSpace,rightSpace)/Math.max(leftSpace,rightSpace);
    if(symmetry<.48)continue;
    const headProm=Math.min(ls.y,rs.y)-head.y, shoulderDiff=Math.abs(ls.y-rs.y);
    if(headProm<height*.06||headProm>height*.24||shoulderDiff>height*.045)continue;
    const leftNecks=between(lows,ls.x,head.x),rightNecks=between(lows,head.x,rs.x);
    if(!leftNecks.length||!rightNecks.length)continue;
    const n1=leftNecks.reduce((a,b)=>a.y>b.y?a:b),n2=rightNecks.reduce((a,b)=>a.y>b.y?a:b);
    if(n1.y-Math.max(ls.y,head.y)<height*.035||n2.y-Math.max(rs.y,head.y)<height*.035)continue;
    const neckDiff=Math.abs(n1.y-n2.y);if(neckDiff>height*.065)continue;
    const slope=(n2.y-n1.y)/Math.max(1,n2.x-n1.x), after=candles.filter(x=>x.x>rs.x);
    if(after.length<4)continue;
    let breaks=0;
    for(const x of after){if(x.low>(n1.y+slope*(x.x-n1.x))+height*.015)breaks++;}
    const confirmed=breaks>=2;
    if(!confirmed)continue;
    const points=[ls,n1,head,n2,rs].map(x=>({x:pctX(x.x),y:pctY(x.y)}));
    candidates.push({score:headProm/height+symmetry*.12-neckDiff/height*.25,pattern:{
      name:"HEAD & SHOULDERS",status:"CONFIRMED",confidence:"MEDIUM",
      evidence:"A prior advance is followed by symmetric shoulders, a materially higher head and repeated acceptance below the neckline.",
      confirmation:"Visible acceptance below the neckline after the right shoulder.",invalidation:"Clean acceptance above the head or a materially higher right shoulder.",
      geometry:{points,labelX:pctX(rs.x),labelY:Math.max(bounds.top,pctY(Math.min(ls.y,head.y,rs.y))-4)}
    }});
  }

  for(let i=0;i<lows.length-2;i++) for(let j=i+1;j<lows.length-1;j++) for(let k=j+1;k<lows.length;k++){
    const ls=lows[i],head=lows[j],rs=lows[k], span=rs.x-ls.x;
    if(span<width*.22||span>width*.62||rs.x>width*.87)continue;
    const prior=trendMove(candles,ls.x,width);
    if(prior===null||prior<height*.045)continue; // inverse H&S should arrive after an actual decline.
    const leftSpace=head.x-ls.x,rightSpace=rs.x-head.x,symmetry=Math.min(leftSpace,rightSpace)/Math.max(leftSpace,rightSpace);
    if(symmetry<.48)continue;
    const headProm=head.y-Math.max(ls.y,rs.y), shoulderDiff=Math.abs(ls.y-rs.y);
    if(headProm<height*.06||headProm>height*.24||shoulderDiff>height*.045)continue;
    const leftNecks=between(highs,ls.x,head.x),rightNecks=between(highs,head.x,rs.x);
    if(!leftNecks.length||!rightNecks.length)continue;
    const n1=leftNecks.reduce((a,b)=>a.y<b.y?a:b),n2=rightNecks.reduce((a,b)=>a.y<b.y?a:b);
    if(Math.min(ls.y,head.y)-n1.y<height*.035||Math.min(rs.y,head.y)-n2.y<height*.035)continue;
    const neckDiff=Math.abs(n1.y-n2.y);if(neckDiff>height*.065)continue;
    const slope=(n2.y-n1.y)/Math.max(1,n2.x-n1.x), after=candles.filter(x=>x.x>rs.x);
    if(after.length<4)continue;
    let breaks=0;
    for(const x of after){if(x.high<(n1.y+slope*(x.x-n1.x))-height*.015)breaks++;}
    const confirmed=breaks>=2;
    if(!confirmed)continue;
    const points=[ls,n1,head,n2,rs].map(x=>({x:pctX(x.x),y:pctY(x.y)}));
    candidates.push({score:headProm/height+symmetry*.12-neckDiff/height*.25,pattern:{
      name:"INVERSE H&S",status:"CONFIRMED",confidence:"MEDIUM",
      evidence:"A prior decline is followed by symmetric shoulders, a materially lower head and repeated acceptance above the neckline.",
      confirmation:"Visible acceptance above the neckline after the right shoulder.",invalidation:"Clean acceptance below the head or a materially lower right shoulder.",
      geometry:{points,labelX:pctX(rs.x),labelY:Math.min(bounds.bottom,pctY(Math.max(ls.y,head.y,rs.y))+4)}
    }});
  }
  return candidates.sort((a,b)=>b.score-a.score)[0]?.pattern ?? null;
}


function doublePatternCandidates(
  structural:Swing[], candles:Candle[], width:number, height:number,
  pctX:(x:number)=>number,pctY:(y:number)=>number,bounds:DevicePlotBounds
){
  const out:{pattern:DevicePattern;score:number}[]=[];
  const highs=structural.filter(p=>p.kind==="high").sort((a,b)=>a.x-b.x);
  const lows=structural.filter(p=>p.kind==="low").sort((a,b)=>a.x-b.x);

  for(let i=0;i<highs.length-1;i++) for(let j=i+1;j<highs.length;j++){
    const a=highs[i],b=highs[j],span=b.x-a.x;
    if(span<width*.17||span>width*.58||b.x>width*.9)continue;
    const prior=trendMove(candles,a.x,width);
    if(prior===null||prior>=-height*.035)continue;
    const between=lows.filter(p=>p.x>a.x&&p.x<b.x);
    if(!between.length)continue;
    const neck=between.reduce((x,y)=>x.y>y.y?x:y);
    const topDiff=Math.abs(a.y-b.y),depth=neck.y-(a.y+b.y)/2;
    if(topDiff>height*.045||depth<height*.07||depth>height*.38)continue;
    const after=candles.filter(x=>x.x>b.x);
    const breaks=after.filter(x=>x.mid>neck.y+height*.008).length;
    const confirmed=after.length>=3&&breaks>=2;
    const pattern:DevicePattern={
      name:confirmed?"DOUBLE TOP":"DOUBLE TOP CANDIDATE",
      status:confirmed?"CONFIRMED":"AMBIGUOUS",
      confidence:confirmed?"MEDIUM":"LOW",
      evidence:confirmed
        ?"A prior advance is followed by two structural highs at a similar level, a meaningful valley and repeated acceptance below the neckline."
        :"Two structural highs and a meaningful valley are visible after an advance, but neckline confirmation is not proven.",
      confirmation:"Repeated acceptance below the intervening swing low after the second test.",
      invalidation:"Clean acceptance above the twin highs.",
      geometry:{points:[a,neck,b].map(p=>({x:pctX(p.x),y:pctY(p.y)})),labelX:pctX(b.x),labelY:Math.max(bounds.top,pctY(b.y)-4)}
    };
    out.push({pattern,score:depth/height-topDiff/height+(confirmed?.18:0)});
  }

  for(let i=0;i<lows.length-1;i++) for(let j=i+1;j<lows.length;j++){
    const a=lows[i],b=lows[j],span=b.x-a.x;
    if(span<width*.17||span>width*.58||b.x>width*.9)continue;
    const prior=trendMove(candles,a.x,width);
    if(prior===null||prior<=height*.035)continue;
    const between=highs.filter(p=>p.x>a.x&&p.x<b.x);
    if(!between.length)continue;
    const neck=between.reduce((x,y)=>x.y<y.y?x:y);
    const bottomDiff=Math.abs(a.y-b.y),depth=(a.y+b.y)/2-neck.y;
    if(bottomDiff>height*.045||depth<height*.07||depth>height*.38)continue;
    const after=candles.filter(x=>x.x>b.x);
    const breaks=after.filter(x=>x.mid<neck.y-height*.008).length;
    const confirmed=after.length>=3&&breaks>=2;
    const pattern:DevicePattern={
      name:confirmed?"DOUBLE BOTTOM":"DOUBLE BOTTOM CANDIDATE",
      status:confirmed?"CONFIRMED":"AMBIGUOUS",
      confidence:confirmed?"MEDIUM":"LOW",
      evidence:confirmed
        ?"A prior decline is followed by two structural lows at a similar level, a meaningful peak and repeated acceptance above the neckline."
        :"Two structural lows and a meaningful peak are visible after a decline, but neckline confirmation is not proven.",
      confirmation:"Repeated acceptance above the intervening swing high after the second test.",
      invalidation:"Clean acceptance below the twin lows.",
      geometry:{points:[a,neck,b].map(p=>({x:pctX(p.x),y:pctY(p.y)})),labelX:pctX(b.x),labelY:Math.min(bounds.bottom,pctY(b.y)+4)}
    };
    out.push({pattern,score:depth/height-bottomDiff/height+(confirmed?.18:0)});
  }
  return out.sort((a,b)=>b.score-a.score).map(item=>item.pattern).slice(0,2);
}

function boundaryPattern(pivots:Swing[],candles:Candle[],width:number,height:number,pctX:(x:number)=>number,pctY:(y:number)=>number,bounds:DevicePlotBounds){
  const candidates:{pattern:DevicePattern;score:number}[]=[];
  const maxWindow=Math.min(16,pivots.length);
  for(let size=6;size<=maxWindow;size++){
    for(let start=0;start+size<=pivots.length;start++){
      const window=pivots.slice(start,start+size), highs=window.filter(p=>p.kind==="high"), lows=window.filter(p=>p.kind==="low");
      if(highs.length<3||lows.length<3)continue;
      const x1=window[0].x,x2=window.at(-1)!.x,span=x2-x1;
      if(span<width*.3)continue;
      const hf=linearFit(highs),lf=linearFit(lows);if(!hf||!lf)continue;
      if(hf.rms>height*.022||lf.rms>height*.022)continue;
      const highCoverage=(Math.max(...highs.map(p=>p.x))-Math.min(...highs.map(p=>p.x)))/span;
      const lowCoverage=(Math.max(...lows.map(p=>p.x))-Math.min(...lows.map(p=>p.x)))/span;
      if(highCoverage<.62||lowCoverage<.62)continue;
      const touchEvents=[...highs.map(p=>({x:p.x,k:"h"})),...lows.map(p=>({x:p.x,k:"l"}))].sort((a,b)=>a.x-b.x);
      let alternations=0;for(let i=1;i<touchEvents.length;i++)if(touchEvents[i].k!==touchEvents[i-1].k)alternations++;
      if(alternations<5)continue;
      const sep1=lineY(lf,x1)-lineY(hf,x1),sep2=lineY(lf,x2)-lineY(hf,x2);
      if(sep1<height*.06||sep2<height*.025)continue;
      const ratio=sep2/sep1;
      const hChange=hf.slope*span/height,lChange=lf.slope*span/height;
      const inside=candles.filter(c=>c.x>=x1&&c.x<=x2),tol=height*.018;
      const violations=inside.filter(c=>c.mid<lineY(hf,c.x)-tol||c.mid>lineY(lf,c.x)+tol).length;
      if(violations>Math.max(1,Math.floor(inside.length*.04)))continue;
      const converging=ratio>.08&&ratio<.68;
      const parallel=ratio>.82&&ratio<1.18&&Math.abs(hChange-lChange)<.028;
      let name="",evidence="";
      if(Math.abs(hChange)<.025&&lChange<-.065&&converging){name="ASCENDING TRIANGLE";evidence="Three-plus upper and lower reactions support a flat ceiling with materially rising lows.";}
      else if(hChange>.065&&Math.abs(lChange)<.025&&converging){name="DESCENDING TRIANGLE";evidence="Three-plus upper and lower reactions support falling highs against a broadly flat floor.";}
      else if(hChange>.055&&lChange<-.055&&converging){name="TRIANGLE";evidence="Multiple falling highs and rising lows form a tightly fitted converging triangle.";}
      else if(hChange<-.045&&lChange<-.075&&lChange<hChange-.03&&converging){name="RISING WEDGE";evidence="Multiple touches show both boundaries rising while the lower boundary converges faster.";}
      else if(hChange>.075&&lChange>.045&&hChange>lChange+.03&&converging){name="FALLING WEDGE";evidence="Multiple touches show both boundaries falling while the upper boundary converges faster.";}
      else if(parallel&&Math.abs((hChange+lChange)/2)>.085){name="TREND CHANNEL";evidence="At least three swing highs and three swing lows track tightly fitted parallel boundaries.";}
      else continue;
      const score=(highs.length+lows.length)*.11+span/width*.3-(hf.rms+lf.rms)/height-violations*.04;
      const points=[
        {x:pctX(x1),y:pctY(lineY(hf,x1))},{x:pctX(x2),y:pctY(lineY(hf,x2))},
        {x:pctX(x2),y:pctY(lineY(lf,x2))},{x:pctX(x1),y:pctY(lineY(lf,x1))}
      ];
      if(points.some(p=>p.y<bounds.top-2||p.y>bounds.bottom+2))continue;
      candidates.push({score,pattern:{
        name,status:"AMBIGUOUS",confidence:"MEDIUM",evidence,
        confirmation:name==="TREND CHANNEL"?"Another clean boundary reaction or a decisive channel break.":"A decisive break and hold beyond the validated boundary.",
        invalidation:"Price action stops respecting the proposed boundary geometry.",
        geometry:{points,labelX:Math.max(bounds.left,pctX(x2)-18),labelY:Math.max(bounds.top,pctY(Math.min(lineY(hf,x1),lineY(hf,x2)))-4)}
      }});
    }
  }
  return candidates.sort((a,b)=>b.score-a.score)[0]?.pattern ?? null;
}

function flagPattern(candles:Candle[],width:number,height:number,pctX:(x:number)=>number,pctY:(y:number)=>number,bounds:DevicePlotBounds){
  if(candles.length<20)return null;
  let best:{score:number;pattern:DevicePattern}|null=null;
  for(let split=8;split<candles.length-9;split++){
    const poleStart=Math.max(0,split-8),a=candles[poleStart],b=candles[split],pole=b.mid-a.mid,poleMag=Math.abs(pole);
    if(poleMag<height*.18||b.x-a.x>width*.25)continue;
    const rest=candles.slice(split+1,Math.min(candles.length,split+14));
    if(rest.length<8)continue;
    const xSpan=rest.at(-1)!.x-rest[0].x;if(xSpan<width*.1||xSpan>width*.34)continue;
    const top=Math.min(...rest.map(c=>c.high)),bottom=Math.max(...rest.map(c=>c.low)),range=bottom-top;
    if(range>poleMag*.5)continue;
    const mx=rest.reduce((s,c)=>s+c.x,0)/rest.length,my=rest.reduce((s,c)=>s+c.mid,0)/rest.length;
    let num=0,den=0;for(const x of rest){num+=(x.x-mx)*(x.mid-my);den+=(x.x-mx)**2;}
    const slope=den?num/den:0,total=slope*xSpan;
    const rms=Math.sqrt(rest.reduce((s,x)=>{const e=x.mid-(my+slope*(x.x-mx));return s+e*e;},0)/rest.length);
    if(rms>Math.max(3,range*.34))continue;
    const bull=pole<0&&total>height*.025&&total<poleMag*.45;
    const bear=pole>0&&total< -height*.025&&Math.abs(total)<poleMag*.45;
    if(!bull&&!bear)continue;
    const poleCandles=candles.slice(poleStart,split+1);
    const steps=poleCandles.slice(1).map((c,i)=>c.mid-poleCandles[i].mid);
    const desired=bull?steps.filter(step=>step<0):steps.filter(step=>step>0);
    const directionalFraction=desired.length/Math.max(1,steps.length);
    const maxStep=Math.max(...steps.map(step=>Math.abs(step)),0);
    if(directionalFraction<.62||maxStep>poleMag*.48)continue;
    const name=bull?"BULL FLAG":"BEAR FLAG";
    const points=[{x:pctX(rest[0].x),y:pctY(top)},{x:pctX(rest.at(-1)!.x),y:pctY(top+total)},{x:pctX(rest.at(-1)!.x),y:pctY(bottom+total)},{x:pctX(rest[0].x),y:pctY(bottom)}];
    const pattern:DevicePattern={name,status:"AMBIGUOUS",confidence:"MEDIUM",evidence:"A strong directional pole is followed by a shorter, narrower and tightly fitted counter-trend consolidation.",confirmation:"Break from the flag in the direction of the preceding impulse.",invalidation:"The consolidation expands materially or breaks against the preceding impulse.",geometry:{points,labelX:pctX(rest.at(-1)!.x),labelY:Math.max(bounds.top,pctY(top)-4)}};
    const score=poleMag/height-range/height-rms/height;
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

    // Solid broker/UI buttons create long runs of neighbouring columns with
    // almost identical top/bottom edges. Real candles may have a body a few
    // pixels wide, but their wick/body silhouette is not a 15–40 px plateau.
    const withoutWideBlocks:{x:number;ys:number[];span:number}[]=[];
    const plateauLimit=Math.max(9,Math.round(width*.026));
    for(let i=0;i<columnRuns.length;){
      const seed=columnRuns[i], seedHigh=Math.min(...seed.ys), seedLow=Math.max(...seed.ys);
      let j=i+1;
      while(j<columnRuns.length){
        const next=columnRuns[j], nextHigh=Math.min(...next.ys), nextLow=Math.max(...next.ys);
        if(next.x-columnRuns[j-1].x>1||Math.abs(nextHigh-seedHigh)>1||Math.abs(nextLow-seedLow)>1)break;
        j++;
      }
      if(j-i<=plateauLimit) for(let k=i;k<j;k++) withoutWideBlocks.push(columnRuns[k]);
      i=j;
    }
    if(withoutWideBlocks.length>=8)columnRuns=withoutWideBlocks;

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
    const structureHeight=Math.max(40,candleBottom-candleTop);
    const swings:Swing[]=[];
    for(let i=2;i<candles.length-2;i++){
      const c=candles[i],near=candles.slice(i-2,i+3);
      if(c.high===Math.min(...near.map(v=>v.high)))swings.push({x:c.x,y:c.high,kind:"high"});
      if(c.low===Math.max(...near.map(v=>v.low)))swings.push({x:c.x,y:c.low,kind:"low"});
    }

    // Named chart patterns need slower structural pivots than levels/liquidity.
    // Keep 2/2 swings for local references, but require 3/3–5/5 structure
    // for pattern geometry so ordinary candle noise cannot impersonate a pattern.
    const patternRadius=candles.length>=50?5:candles.length>=30?4:3;
    const patternSwings:Swing[]=[];
    for(let i=patternRadius;i<candles.length-patternRadius;i++){
      const candle=candles[i],near=candles.slice(i-patternRadius,i+patternRadius+1);
      if(candle.high===Math.min(...near.map(v=>v.high)))patternSwings.push({x:candle.x,y:candle.high,kind:"high"});
      if(candle.low===Math.max(...near.map(v=>v.low)))patternSwings.push({x:candle.x,y:candle.low,kind:"low"});
    }

    const clusterFrom=(source:Swing[],kind:"high"|"low",tolPct=.018)=>{
      const src=source.filter(s=>s.kind===kind).sort((a,b)=>a.y-b.y),groups:Swing[][]=[],tol=Math.max(3,structureHeight*tolPct);
      for(const s of src){const found=groups.find(g=>Math.abs(g.reduce((n,v)=>n+v.y,0)/g.length-s.y)<=tol);if(found)found.push(s);else groups.push([s]);}
      return groups.map(items=>({items,y:items.reduce((n,v)=>n+v.y,0)/items.length,score:items.length} as Cluster)).sort((a,b)=>b.score-a.score||(kind==="high"?a.y-b.y:b.y-a.y));
    };
    const highs=clusterFrom(swings,"high"),lows=clusterFrom(swings,"low");
    const patternHighs=clusterFrom(patternSwings,"high",.035),patternLows=clusterFrom(patternSwings,"low",.035);
    const rank=(g:Cluster)=>{const recency=Math.max(...g.items.map(i=>i.x))/width,spread=Math.max(...g.items.map(i=>i.y))-Math.min(...g.items.map(i=>i.y));return g.score*4+recency*2-spread/Math.max(2,structureHeight*.02);};
    const ranked=[...highs.map(group=>({kind:"resistance" as const,group,rank:rank(group)})),...lows.map(group=>({kind:"support" as const,group,rank:rank(group)}))].sort((a,b)=>b.rank-a.rank);
    const picked=ranked.slice(0,3);
    if(!picked.some(x=>x.kind==="resistance")&&highs[0])picked[picked.length-1]={kind:"resistance",group:highs[0],rank:rank(highs[0])};
    if(!picked.some(x=>x.kind==="support")&&lows[0])picked[picked.length-1]={kind:"support",group:lows[0],rank:rank(lows[0])};
    const levels:DeviceLevel[]=picked.filter((item,index,array)=>array.findIndex(other=>other.kind===item.kind&&Math.abs(other.group.y-item.group.y)<structureHeight*.025)===index).map(({kind,group})=>({kind,label:group.score>=3?(kind==="resistance"?"Repeated rejection highs":"Repeated defended lows"):group.score>=2?(kind==="resistance"?"Repeated swing highs":"Repeated swing lows"):(kind==="resistance"?"Prominent swing high":"Prominent swing low"),price:"",x:plotBounds.left,y:pctY(group.y),x2:plotBounds.right,y2:pctY(group.y)})).slice(0,3);

    const pivots=normalizePivots(patternSwings);
    const patternCandidates:DevicePattern[]=[];
    const hs=headShoulders(pivots,candles,width,structureHeight,pctX,pctY,plotBounds);
    if(hs)patternCandidates.push(hs);

    for(const pattern of doublePatternCandidates(swings,candles,width,structureHeight,pctX,pctY,plotBounds)){
      patternCandidates.push(pattern);
    }

    const flag=flagPattern(candles,width,structureHeight,pctX,pctY,plotBounds);
    if(flag)patternCandidates.push(flag);
    const boundary=boundaryPattern(pivots,candles,width,structureHeight,pctX,pctY,plotBounds);
    if(boundary)patternCandidates.push(boundary);

    const rh=patternHighs.find(g=>g.score>=2),rl=patternLows.find(g=>g.score>=2);
    if(rh&&rl){
      const events=[...rh.items.map(i=>({x:i.x,kind:"high" as const})),...rl.items.map(i=>({x:i.x,kind:"low" as const}))].sort((a,b)=>a.x-b.x);
      const xStart=Math.min(...events.map(e=>e.x)),xEnd=Math.max(...events.map(e=>e.x)),spanPct=(xEnd-xStart)/width*100;
      let alternations=0;for(let i=1;i<events.length;i++)if(events[i].kind!==events[i-1].kind)alternations++;
      const separation=rl.y-rh.y,breakTol=structureHeight*.02,inside=candles.filter(c=>c.x>=xStart&&c.x<=xEnd);
      const upperBreaches=inside.filter(c=>c.mid<rh.y-breakTol).length,lowerBreaches=inside.filter(c=>c.mid>rl.y+breakTol).length;
      const x1=Math.max(plotBounds.left,pctX(xStart)),x2=Math.min(plotBounds.right,pctX(xEnd));
      const highCoverage=(Math.max(...rh.items.map(i=>i.x))-Math.min(...rh.items.map(i=>i.x)))/Math.max(1,xEnd-xStart);
      const lowCoverage=(Math.max(...rl.items.map(i=>i.x))-Math.min(...rl.items.map(i=>i.x)))/Math.max(1,xEnd-xStart);
      if(rh.score>=3&&rl.score>=3&&separation>=structureHeight*.09&&separation<=structureHeight*.5&&spanPct>=26&&alternations>=5&&highCoverage>=.5&&lowCoverage>=.5&&upperBreaches<=1&&lowerBreaches<=1){
        patternCandidates.push({name:"RECTANGLE / RANGE",status:"FORMING",confidence:"MEDIUM",evidence:"Repeated upper and lower reactions alternate across a sustained, largely intact range.",confirmation:"Break and hold beyond one range edge after repeated two-sided rotation.",invalidation:"A decisive breach through the opposite edge invalidates the range read.",geometry:{points:[{x:x1,y:pctY(rh.y)},{x:x2,y:pctY(rh.y)},{x:x2,y:pctY(rl.y)},{x:x1,y:pctY(rl.y)},{x:x1,y:pctY(rh.y)}],labelX:Math.max(plotBounds.left,x2-18),labelY:Math.max(plotBounds.top,pctY(rh.y)-4)}});
      }else if(rh.score>=2&&rl.score>=2&&separation>=structureHeight*.09&&spanPct>=20&&alternations>=3&&upperBreaches<=1&&lowerBreaches<=1){
        patternCandidates.push({name:"RANGE CANDIDATE",status:"AMBIGUOUS",confidence:"LOW",evidence:"Two-sided reactions are visible, but the geometry is not clean enough to call a rectangle.",confirmation:"More alternating tests with both boundaries holding.",invalidation:"A decisive break through either proposed boundary.",geometry:{points:[{x:x1,y:pctY(rh.y)},{x:x2,y:pctY(rh.y)},{x:x2,y:pctY(rl.y)},{x:x1,y:pctY(rl.y)},{x:x1,y:pctY(rh.y)}],labelX:Math.max(plotBounds.left,x2-18),labelY:Math.max(plotBounds.top,pctY(rh.y)-4)}});
      }
    }

    const familyPriority=(pattern:DevicePattern)=>{
      const confidence=pattern.confidence==="HIGH"?40:pattern.confidence==="MEDIUM"?25:0;
      const status=pattern.status==="CONFIRMED"?30:pattern.status==="FORMING"?12:pattern.status==="FAILED"?10:0;
      const family=/HEAD/.test(pattern.name)?18:/DOUBLE/.test(pattern.name)?14:/FLAG|WEDGE|TRIANGLE|CHANNEL/.test(pattern.name)?10:0;
      return confidence+status+family;
    };
    const sortedPatterns=patternCandidates
      .sort((a,b)=>familyPriority(b)-familyPriority(a))
      .filter((pattern,index,array)=>array.findIndex(other=>other.name===pattern.name)===index);
    const strongPatterns=sortedPatterns.filter(pattern=>pattern.confidence!=="LOW"||pattern.status==="CONFIRMED"||pattern.status==="FAILED");
    const patterns=(strongPatterns.length?strongPatterns:sortedPatterns.slice(0,1)).slice(0,1);

    const zones:DeviceLiquidityZone[]=[];
    const h=highs[0],l=lows[0];
    if(h){const sx=pctX(Math.min(...h.items.map(i=>i.x)));zones.push({side:"BUY_SIDE",basis:h.score>=2?"EQUAL_HIGHS":"PRIOR_SWING_HIGH",price:"",x:sx,x2:Math.max(sx+5,plotBounds.right),y:pctY(h.y)});}
    if(l){const sx=pctX(Math.min(...l.items.map(i=>i.x)));zones.push({side:"SELL_SIDE",basis:l.score>=2?"EQUAL_LOWS":"PRIOR_SWING_LOW",price:"",x:sx,x2:Math.max(sx+5,plotBounds.right),y:pctY(l.y)});}
    const liquidity:DeviceLiquidityRead=zones.length?{state:"PARTIAL",event:"NONE",confidence:"LOW",evidence:"Device scan found visible liquidity references only; this is not a verified liquidity event or hidden-order claim.",confirmation:"A visible sweep, reclaim or rejection is required before this becomes an event.",invalidation:"The reference is invalid if price cleanly accepts beyond it.",zones}:{...EMPTY_LIQUIDITY,zones:[]};
    return {levels,patterns:patterns.slice(0,2),liquidity,candleCount:candles.length,swingCount:swings.length,plotBounds};
  }catch{return emptyDeviceScan();}
}
