import { NextResponse } from "next/server";
import { POST as analyse } from "../../analyse/route";
import { TORTURE_CASES, syntheticSvg } from "../../../../../tests/support/pocket-image-torture";

export const runtime = "nodejs";
export const maxDuration = 300;

type Counts={tp:number;fp:number;fn:number};
type Analysis={evidenceQuality?:{chartReadability?:string};levels?:Array<{kind?:string;y?:number}>;patterns?:Array<{name?:string}>;liquidity?:{state?:string;event?:string;zones?:unknown[]};error?:string};

export async function GET(request:Request){
  if(process.env.VERCEL_ENV!=="preview") return NextResponse.json({error:"Not available."},{status:404});
  if(new URL(request.url).searchParams.get("run")!=="1") return NextResponse.json({ready:true,cases:TORTURE_CASES.map(x=>x.id)});
  // @ts-expect-error sharp is supplied by the verified Next.js runtime stack.
  const sharp=(await import("sharp")).default;
  const metrics:Record<"levels"|"patterns"|"liquidity",Counts>={levels:{tp:0,fp:0,fn:0},patterns:{tp:0,fp:0,fn:0},liquidity:{tp:0,fp:0,fn:0}};
  const failures:string[]=[]; const observations:unknown[]=[];
  const match=(e:{kind:string;y:number;tolerance:number},a:Array<{kind?:string;y?:number}>)=>a.some(x=>x.kind===e.kind&&typeof x.y==="number"&&Math.abs(x.y-e.y)<=e.tolerance);
  for(let i=0;i<TORTURE_CASES.length;i++){
    const sample=TORTURE_CASES[i]!;
    const image=await sharp(Buffer.from(syntheticSvg(sample))).png().toBuffer();
    const req=new Request("http://preview/api/pocket/analyse",{method:"POST",headers:{"content-type":"application/json","x-forwarded-for":`10.77.0.${i+1}`},body:JSON.stringify({image:`data:image/png;base64,${image.toString("base64")}`,intention:"UNSURE",chartConfirmation:{instrument:sample.market,timeframe:sample.timeframe,currentPrice:"100",contextMatch:"NOT_PROVIDED"}})});
    const response=await analyse(req); const body=await response.json() as Analysis;
    if(!response.ok){failures.push(`${sample.id}: HTTP ${response.status} ${body.error??""}`);continue;}
    const levels=(body.levels??[]).filter(x=>x.kind==="support"||x.kind==="resistance");
    for(const e of sample.expectedLevels){if(match(e,levels))metrics.levels.tp++;else{metrics.levels.fn++;failures.push(`${sample.id}: missed ${e.kind}`);}}
    for(const a of levels)if(!sample.expectedLevels.some(e=>match(e,[a]))){metrics.levels.fp++;failures.push(`${sample.id}: false level ${a.kind}@${a.y}`);}
    const patterns=(body.patterns??[]).map(x=>x.name).filter((x):x is string=>Boolean(x));
    for(const e of sample.expectedPatterns){if(patterns.includes(e))metrics.patterns.tp++;else{metrics.patterns.fn++;failures.push(`${sample.id}: missed pattern ${e}`);}}
    for(const a of patterns)if(!sample.expectedPatterns.includes(a)){metrics.patterns.fp++;failures.push(`${sample.id}: false pattern ${a}`);}
    const positive=sample.expectedLiquidity.state!=="NONE", actual=body.liquidity?.state==="VERIFIED"||body.liquidity?.state==="PARTIAL";
    if(positive&&actual)metrics.liquidity.tp++;else if(positive&&!actual){metrics.liquidity.fn++;failures.push(`${sample.id}: missed liquidity`);}else if(!positive&&actual){metrics.liquidity.fp++;failures.push(`${sample.id}: false liquidity ${body.liquidity?.state}`);}
    if(sample.expectedLiquidity.event&&body.liquidity?.event!==sample.expectedLiquidity.event)failures.push(`${sample.id}: liquidity event ${body.liquidity?.event} != ${sample.expectedLiquidity.event}`);
    observations.push({id:sample.id,readability:body.evidenceQuality?.chartReadability,levels,patterns,liquidity:body.liquidity});
  }
  const rate=(m:Counts,d:"p"|"r")=>{const n=d==="p"?m.tp+m.fp:m.tp+m.fn;return n?m.tp/n:null};
  const scored=Object.fromEntries(Object.entries(metrics).map(([k,m])=>[k,{...m,precision:rate(m,"p"),recall:rate(m,"r")}]));
  return NextResponse.json({cases:TORTURE_CASES.length,metrics:scored,failures,observations,pass:failures.length===0},{status:failures.length?422:200});
}
