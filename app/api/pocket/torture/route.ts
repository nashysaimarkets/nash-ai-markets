import { NextResponse } from "next/server";
// @ts-expect-error sharp 0.35 exports omit its bundled declaration path under TS bundler resolution.
import sharp from "sharp";
import { POST as analyse } from "../analyse/route";
import { TORTURE_CASES, syntheticSvg, unwrapTortureAnalysis, syntheticPrecisionCropSpec, buildTortureRequestPayload } from "../../../../tests/support/pocket-image-torture";

export const runtime = "nodejs";
export const maxDuration = 300;

async function makePrecisionCrop(image: Buffer) {
  const spec = syntheticPrecisionCropSpec(900, 600);
  return sharp(image).extract({ left: spec.left, top: spec.top, width: spec.width, height: spec.height })
    .resize(spec.targetWidth, spec.targetHeight, { fit: "fill" }).jpeg({ quality: 92 }).toBuffer();
}


type Counts={tp:number;fp:number;fn:number};
type Analysis={evidenceQuality?:{chartReadability?:string};levels?:Array<{kind?:string;y?:number}>;patterns?:Array<{name?:string}>;liquidity?:{state?:string;event?:string;zones?:unknown[]};error?:string};

export async function GET(request:Request){
  if(process.env.VERCEL_ENV!=="preview") return NextResponse.json({error:"Not available."},{status:404});
  const params=new URL(request.url).searchParams;
  const requested=params.get("case");
  if(params.get("run")!=="1") return NextResponse.json({ready:true,cases:TORTURE_CASES.map(x=>x.id)});
  const selected=requested ? TORTURE_CASES.filter(x=>x.id===requested) : TORTURE_CASES;
  if(requested && selected.length===0) return NextResponse.json({error:"Unknown torture case."},{status:400});
  // Exercise the deployed native package without invoking a paid AI provider.
  if(params.get("raster")==="1") {
    const images=[];
    for(const sample of selected) {
      const image=await sharp(Buffer.from(syntheticSvg(sample))).png().toBuffer();
      const metadata=await sharp(image).metadata();
      if(image.subarray(0,8).toString("hex")!=="89504e470d0a1a0a" || metadata.width!==900 || metadata.height!==600) throw new Error(`${sample.id}: invalid raster fixture`);
      const precisionCrop = await makePrecisionCrop(image);
      const precisionMetadata = await sharp(precisionCrop).metadata();
      if (precisionMetadata.format !== "jpeg" || precisionMetadata.width !== 1400 || precisionMetadata.height !== 765) throw new Error(`${sample.id}: invalid precision crop`);
      images.push({id:sample.id,bytes:image.length,width:metadata.width,height:metadata.height,format:metadata.format,
        precisionFormat:precisionMetadata.format,precisionWidth:precisionMetadata.width,precisionHeight:precisionMetadata.height});
    }
    return NextResponse.json({cases:images.length,images,providerCalls:0,pass:true});
  }
  const metrics:Record<"levels"|"patterns"|"liquidity",Counts>={levels:{tp:0,fp:0,fn:0},patterns:{tp:0,fp:0,fn:0},liquidity:{tp:0,fp:0,fn:0}};
  const failures:string[]=[]; const observations:unknown[]=[];
  const match=(e:{kind:string;y:number;tolerance:number},a:Array<{kind?:string;y?:number}>)=>a.some(x=>x.kind===e.kind&&typeof x.y==="number"&&Math.abs(x.y-e.y)<=e.tolerance);
  for(let i=0;i<selected.length;i++){
    const sample=selected[i]!;
    const image=await sharp(Buffer.from(syntheticSvg(sample))).png().toBuffer();
    if(image.length < 8 || image.subarray(0,8).toString("hex") !== "89504e470d0a1a0a") throw new Error(`${sample.id}: torture fixture did not rasterize to PNG`);
    const precisionCrop = await makePrecisionCrop(image);
    const requestPayload = buildTortureRequestPayload(sample,
      `data:image/png;base64,${image.toString("base64")}`,
      `data:image/jpeg;base64,${precisionCrop.toString("base64")}`);
    const req=new Request("http://preview/api/pocket/analyse",{method:"POST",headers:{"content-type":"application/json","x-forwarded-for":`10.77.0.${i+1}`},body:JSON.stringify(requestPayload)});
    let response: Response;
    let body: Analysis;
    try {
      response=await analyse(req);
      const payload = await response.json();
      body = response.ok ? unwrapTortureAnalysis(payload) as Analysis : payload as Analysis;
    } catch (error) {
      failures.push(`${sample.id}: analysis exception ${error instanceof Error ? error.message : String(error)}`);
      observations.push({id:sample.id,exception:error instanceof Error ? error.message : String(error)});
      continue;
    }
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
  return NextResponse.json({cases:selected.length,metrics:scored,failures,observations,pass:failures.length===0},{status:failures.length?422:200});
}
