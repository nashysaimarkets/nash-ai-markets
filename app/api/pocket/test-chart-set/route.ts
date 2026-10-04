import { NextResponse } from "next/server";
// @ts-ignore -- sharp is bundled in the Next.js runtime but its export map typings are incomplete here.
import sharp from "sharp";

export const runtime = "nodejs";
export const maxDuration = 60;

type Pattern = { name: string; status: string; confidence: string };
type Scan = { candles: number; swings: number; levels: number; patterns: Pattern[]; liquidity: number };

const CASES = [
  { id:"hs-btc", expected:"HEAD & SHOULDERS", url:"https://s3.tradingview.com/snapshots/f/fzD3jQZO.png" },
  { id:"ihs-btc", expected:"INVERSE H&S", url:"https://s3.tradingview.com/snapshots/u/UFenqU3j.png" },
  { id:"double-top-amzn", expected:"DOUBLE TOP", url:"https://miro.medium.com/v2/resize%3Afit%3A3094/1%2Ap1lx4gYYTCuucs82oPdsGQ.png" },
  { id:"bear-flag-usdjpy", expected:"BEAR FLAG", url:"https://cms.naga.com/bear_flag_pattern_b57453de92.png" },
  { id:"bear-flag-btc", expected:"BEAR FLAG", url:"https://cloudfront-us-east-1.images.arcpublishing.com/coindesk/4EXWGCIRQJHL5KVEFDQHB5Z3XY.png" },
  { id:"ascending-triangle", expected:"ASCENDING TRIANGLE", url:"https://s3.eu-west-1.amazonaws.com/cms.naga.com/ascending_triangle_8d89134892.png" },
  { id:"ascending-triangle-fincables", expected:"TRIANGLE", url:"https://s3.tradingview.com/snapshots/q/QDCtJbdz.png" },
  { id:"descending-triangle", expected:"DESCENDING TRIANGLE", url:"https://www.trading-fuer-anfaenger.de/wp-content/uploads/2023/06/Fallendes-Dreieck-scaled.jpg" },
  { id:"rising-wedge-btc", expected:"RISING WEDGE", url:"https://cimg.co/news/107636/261852/image.jpg" },
  { id:"rising-wedge", expected:"RISING WEDGE", url:"https://blueberrymarkets.com/media/10lhmzmj/unnamed.png" },
  { id:"range-eurusd", expected:"RECTANGLE / RANGE", url:"https://s3.tradingview.com/0/0ZKD0ccO_mid.webp" },
  { id:"range-stock", expected:"RECTANGLE / RANGE", url:"https://cms.naga.com/image_3bb66d0bfe.png" },
  { id:"range-brent", expected:"RECTANGLE / RANGE", url:"https://d32r1sh890xpii.cloudfront.net/tinymce/2023-07/1689963397-o_1h5sqlup11tbo1ofrmo83ql1lpq8_large.jpg" },
  { id:"range-eth", expected:"RECTANGLE / RANGE", url:"https://primexbt.com/media/2025/06/ETHUSDT_2025-06-16_07-44-25_cac52.png" },
  { id:"channel-gold", expected:"TREND CHANNEL", url:"https://illya.sh/staticthoughts/data/images/26a3b562-7ba3-5685-b375-488a0467d0c7.jpg" },
  { id:"channel-uptrend", expected:"TREND CHANNEL", url:"https://s3.tradingview.com/j/jhvoKjuU_mid.png" },
  { id:"fake-breakout", expected:"NO CLEAN PATTERN", url:"https://s3.tradingview.com/o/OamyAqgr_big.png" },
  { id:"chop-fx", expected:"NO CLEAN PATTERN", url:"https://indicatorvault.com/wp-content/uploads/2024/08/image6.png.webp" },
  { id:"straight-downtrend", expected:"NO CLEAN PATTERN", url:"https://pbs.twimg.com/media/G5qCfISX0AAC-TA.jpg" },
  { id:"sp500-uptrend", expected:"NO CLEAN PATTERN", url:"https://cdn.prod.website-files.com/67929b1ba94c8a3c19e0de70/682b5e7ee93ca89781a87458_68052b584c33f7138b689ab7_tradingview.png" },
  { id:"gold-levels", expected:"NO CLEAN PATTERN", url:"https://s3.tradingview.com/snapshots/s/s7h8BepM.png" },
  { id:"brent-levels", expected:"NO CLEAN PATTERN", url:"https://d1-invdn-com.akamaized.net/content/piccee72e0c5679dba090cf0eb8c57b78b4.png" },
] as const;

async function fetchImage(url:string){
  const r = await fetch(url, { headers: { "user-agent":"Mozilla/5.0 PocketBullseyeTest/1.0" }, cache:"no-store" });
  if(!r.ok) throw new Error(String(r.status));
  return Buffer.from(await r.arrayBuffer());
}

async function scan(buffer:Buffer):Promise<Scan>{
  const meta = await sharp(buffer).metadata();
  const naturalW = meta.width || 800, naturalH = meta.height || 600;
  const width = Math.min(420, naturalW);
  const height = Math.max(180, Math.round(naturalH * width / naturalW));
  const { data, info } = await sharp(buffer).resize(width,height,{fit:"fill"}).removeAlpha().raw().toBuffer({resolveWithObject:true});
  const channels=info.channels;
  const left=Math.round(width*.04), right=Math.round(width*.91), top=Math.round(height*.08), bottom=Math.round(height*.88);
  const collect=(allowBlue:boolean)=>{
    const runs:{x:number;ys:number[];span:number}[]=[];
    for(let x=left;x<=right;x++){
      const ys:number[]=[];
      for(let y=top;y<=bottom;y++){
        const i=(y*width+x)*channels, r=data[i], g=data[i+1], b=data[i+2];
        const hi=Math.max(r,g,b), lo=Math.min(r,g,b), sat=hi-lo;
        const rg=(g>r+18&&g>b+6)||(r>g+18&&r>b+6);
        const blue=allowBlue&&b>r+24&&b>g+10;
        if(sat>42&&hi>90&&(rg||blue)) ys.push(y);
      }
      if(ys.length>=2){ const span=Math.max(...ys)-Math.min(...ys); if(span>=3) runs.push({x,ys,span}); }
    }
    return runs;
  };
  let runs=collect(false); if(runs.length<12) runs=collect(true);
  const selected:{x:number;ys:number[];span:number}[]=[];
  for(const candidate of [...runs].sort((a,b)=>b.span-a.span)){
    if(selected.every(e=>Math.abs(e.x-candidate.x)>=3)) selected.push(candidate);
  }
  selected.sort((a,b)=>a.x-b.x);
  const candles=selected.map(c=>({x:c.x,high:Math.min(...c.ys),low:Math.max(...c.ys)}));
  type Swing={x:number;y:number;kind:"high"|"low"};
  const swings:Swing[]=[];
  for(let i=2;i<candles.length-2;i++){
    const c=candles[i], near=candles.slice(i-2,i+3);
    if(c.high===Math.min(...near.map(v=>v.high))) swings.push({x:c.x,y:c.high,kind:"high"});
    if(c.low===Math.max(...near.map(v=>v.low))) swings.push({x:c.x,y:c.low,kind:"low"});
  }
  const cluster=(kind:"high"|"low")=>{
    const src=swings.filter(s=>s.kind===kind).sort((a,b)=>a.y-b.y), groups:Swing[][]=[], tol=Math.max(3,height*.018);
    for(const s of src){ const g=groups.find(g=>Math.abs(g.reduce((n,v)=>n+v.y,0)/g.length-s.y)<=tol); if(g)g.push(s);else groups.push([s]); }
    return groups.map(items=>({items,y:items.reduce((n,v)=>n+v.y,0)/items.length,score:items.length}))
      .sort((a,b)=>b.score-a.score||(kind==="high"?a.y-b.y:b.y-a.y));
  };
  const highs=cluster("high"), lows=cluster("low");
  const levels=Math.min(3, highs.length+lows.length);
  const patterns:Pattern[]=[];
  const rh=highs.find(g=>g.score>=2), rl=lows.find(g=>g.score>=2);
  if(rh&&rl){
    const events=[...rh.items.map(x=>({x:x.x,k:"h"})),...rl.items.map(x=>({x:x.x,k:"l"}))].sort((a,b)=>a.x-b.x);
    const span=(Math.max(...events.map(e=>e.x))-Math.min(...events.map(e=>e.x)))/width*100;
    let alt=0;for(let i=1;i<events.length;i++)if(events[i].k!==events[i-1].k)alt++;
    const sep=rl.y-rh.y;
    if(rh.score>=2&&rl.score>=2&&sep>=height*.09&&sep<=height*.5&&span>=24&&alt>=3) patterns.push({name:"RECTANGLE / RANGE",status:"FORMING",confidence:"MEDIUM"});
    else if(rh.score>=2&&rl.score>=2&&sep>=height*.09&&span>=18&&alt>=2) patterns.push({name:"RANGE CANDIDATE",status:"AMBIGUOUS",confidence:"LOW"});
  }
  if(!patterns.length){
    const top=highs.find(g=>g.score===2), bot=lows.find(g=>g.score===2);
    if(top){ const [a,b]=[...top.items].sort((x,y)=>x.x-y.x); if(b&&b.x-a.x>=width*.18){ const between=candles.filter(v=>v.x>a.x&&v.x<b.x); if(between.length>=4&&Math.max(...between.map(v=>v.low))-((a.y+b.y)/2)>=height*.065) patterns.push({name:"DOUBLE TOP CANDIDATE",status:"AMBIGUOUS",confidence:"LOW"}); } }
    if(!patterns.length&&bot){ const [a,b]=[...bot.items].sort((x,y)=>x.x-y.x); if(b&&b.x-a.x>=width*.18){ const between=candles.filter(v=>v.x>a.x&&v.x<b.x); if(between.length>=4&&((a.y+b.y)/2)-Math.min(...between.map(v=>v.high))>=height*.065) patterns.push({name:"DOUBLE BOTTOM CANDIDATE",status:"AMBIGUOUS",confidence:"LOW"}); } }
  }
  const liquidity=(highs.length?1:0)+(lows.length?1:0);
  return {candles:candles.length,swings:swings.length,levels,patterns,liquidity};
}

export async function GET(request:Request){
  const url=new URL(request.url);
  if(url.searchParams.get("key")!=="pocket-next-internal") return NextResponse.json({error:"not found"},{status:404});
  const results=[] as any[];
  for(const test of CASES){
    try{
      const buffer=await fetchImage(test.url);
      const scanResult=await scan(buffer);
      results.push({...test,scan:scanResult});
    }catch(error){
      results.push({...test,error:error instanceof Error?error.message:String(error)});
    }
  }
  return NextResponse.json({count:results.length,results});
}
