import { NextResponse } from "next/server";
import { inflateSync } from "node:zlib";

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
  { id:"rising-wedge", expected:"RISING WEDGE", url:"https://blueberrymarkets.com/media/10lhmzmj/unnamed.png" },
  { id:"range-stock", expected:"RECTANGLE / RANGE", url:"https://cms.naga.com/image_3bb66d0bfe.png" },
  { id:"range-eth", expected:"RECTANGLE / RANGE", url:"https://primexbt.com/media/2025/06/ETHUSDT_2025-06-16_07-44-25_cac52.png" },
  { id:"fake-breakout", expected:"NO CLEAN PATTERN", url:"https://s3.tradingview.com/o/OamyAqgr_big.png" },
  { id:"sp500-uptrend", expected:"NO CLEAN PATTERN", url:"https://cdn.prod.website-files.com/67929b1ba94c8a3c19e0de70/682b5e7ee93ca89781a87458_68052b584c33f7138b689ab7_tradingview.png" },
  { id:"gold-levels", expected:"NO CLEAN PATTERN", url:"https://s3.tradingview.com/snapshots/s/s7h8BepM.png" },
  { id:"brent-levels", expected:"NO CLEAN PATTERN", url:"https://d1-invdn-com.akamaized.net/content/piccee72e0c5679dba090cf0eb8c57b78b4.png" },
  { id:"ihs-fcel", expected:"INVERSE H&S", url:"https://s3.tradingview.com/j/Jm7wpOeW_mid.png" },
  { id:"wti-levels", expected:"NO CLEAN PATTERN", url:"https://substackcdn.com/image/fetch/f_auto%2Cq_auto%3Agood%2Cfl_progressive%3Asteep/https%3A/substack-post-media.s3.amazonaws.com/public/images/216a71c4-c6a3-45dc-8753-87eb017f1282_1282x728.png" },
  { id:"btc-bull-flag", expected:"BULL FLAG", url:"https://cdn.sanity.io/images/s3y3vcno/production/a8dc6b10a6b35add73f41533c63b4176b74f213a-1007x748.png?auto=format" },
  { id:"tsla-break-retest", expected:"BREAKOUT & RETEST", url:"https://www.shootingstocks.com/wp-content/uploads/2022/08/10.-Break-and-retest-chart-example.png" },
  { id:"eurusd-channel", expected:"TREND CHANNEL", url:"https://tradeciety.com/hs-fs/hubfs/Trendline%20Channel%20Upward.png?height=4635&name=Trendline+Channel+Upward.png&width=8994" }
] as const;

async function fetchImage(url:string){
  const r = await fetch(url, { headers: { "user-agent":"Mozilla/5.0 PocketBullseyeTest/1.0", "accept":"image/png,image/*;q=0.8" }, cache:"no-store" });
  if(!r.ok) throw new Error("HTTP "+String(r.status));
  const type=r.headers.get("content-type")||"";
  const buffer=Buffer.from(await r.arrayBuffer());
  if(!type.includes("png") && !buffer.subarray(1,4).equals(Buffer.from("PNG"))) throw new Error("NOT_PNG "+type);
  return buffer;
}

function paeth(a:number,b:number,c:number){
  const p=a+b-c, pa=Math.abs(p-a), pb=Math.abs(p-b), pc=Math.abs(p-c);
  return pa<=pb&&pa<=pc?a:pb<=pc?b:c;
}

function decodePng(buffer:Buffer){
  const sig=Buffer.from([137,80,78,71,13,10,26,10]);
  if(buffer.length<24||!buffer.subarray(0,8).equals(sig)) throw new Error("Invalid PNG");
  let pos=8, width=0, height=0, bitDepth=0, colorType=-1, interlace=0;
  let palette:Buffer|null=null, transparency:Buffer|null=null;
  const idat:Buffer[]=[];
  while(pos+12<=buffer.length){
    const len=buffer.readUInt32BE(pos), type=buffer.toString("ascii",pos+4,pos+8);
    const data=buffer.subarray(pos+8,pos+8+len);
    pos+=12+len;
    if(type==="IHDR"){
      width=data.readUInt32BE(0); height=data.readUInt32BE(4);
      bitDepth=data[8]; colorType=data[9]; interlace=data[12];
    } else if(type==="PLTE") palette=Buffer.from(data);
    else if(type==="tRNS") transparency=Buffer.from(data);
    else if(type==="IDAT") idat.push(Buffer.from(data));
    else if(type==="IEND") break;
  }
  if(!width||!height||bitDepth!==8||interlace!==0) throw new Error("Unsupported PNG layout");
  const bpp=colorType===6?4:colorType===2?3:colorType===4?2:colorType===0?1:colorType===3?1:0;
  if(!bpp) throw new Error("Unsupported PNG colour type "+colorType);
  const rowBytes=width*bpp;
  const packed=inflateSync(Buffer.concat(idat));
  const raw=Buffer.alloc(rowBytes*height);
  let src=0;
  for(let y=0;y<height;y++){
    const filter=packed[src++];
    const row=y*rowBytes, prev=(y-1)*rowBytes;
    for(let x=0;x<rowBytes;x++){
      const value=packed[src++], left=x>=bpp?raw[row+x-bpp]:0, up=y?raw[prev+x]:0, upLeft=y&&x>=bpp?raw[prev+x-bpp]:0;
      raw[row+x]=(value+(filter===0?0:filter===1?left:filter===2?up:filter===3?Math.floor((left+up)/2):filter===4?paeth(left,up,upLeft):0))&255;
    }
  }
  const rgb=Buffer.alloc(width*height*3);
  for(let i=0;i<width*height;i++){
    const s=i*bpp, d=i*3;
    if(colorType===6||colorType===2){ rgb[d]=raw[s]; rgb[d+1]=raw[s+1]; rgb[d+2]=raw[s+2]; }
    else if(colorType===4||colorType===0){ rgb[d]=rgb[d+1]=rgb[d+2]=raw[s]; }
    else {
      const pi=raw[s]*3;
      rgb[d]=palette?.[pi]??0; rgb[d+1]=palette?.[pi+1]??0; rgb[d+2]=palette?.[pi+2]??0;
      void transparency;
    }
  }
  return {width,height,rgb};
}

function resizeRgb(decoded:{width:number;height:number;rgb:Buffer}){
  const width=Math.min(420,decoded.width);
  const height=Math.max(180,Math.round(decoded.height*width/decoded.width));
  const data=Buffer.alloc(width*height*3);
  for(let y=0;y<height;y++){
    const sy=Math.min(decoded.height-1,Math.floor(y*decoded.height/height));
    for(let x=0;x<width;x++){
      const sx=Math.min(decoded.width-1,Math.floor(x*decoded.width/width));
      const s=(sy*decoded.width+sx)*3,d=(y*width+x)*3;
      data[d]=decoded.rgb[s];data[d+1]=decoded.rgb[s+1];data[d+2]=decoded.rgb[s+2];
    }
  }
  return {data,width,height,channels:3};
}

async function scan(buffer:Buffer):Promise<Scan>{
  const {data,width,height,channels}=resizeRgb(decodePng(buffer));
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
