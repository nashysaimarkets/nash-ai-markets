import { NextResponse } from "next/server";
// @ts-expect-error sharp 0.35 exports omit its bundled declaration path under TS bundler resolution.
import sharp from "sharp";
import { POST as analyse } from "../analyse/route";
import { mayRunLiveTorture } from "./authorization";
import { TORTURE_CASES, syntheticSvg, unwrapTortureAnalysis, syntheticPrecisionCropSpec, buildTortureRequestPayload, scoreTortureAnalysis, summarizeTortureMeasurements } from "../../../../tests/support/pocket-image-torture";

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
  // Free raster proof stays accessible; billed scans require two explicit secrets.
  if (!mayRunLiveTorture(request, {
    enabled: process.env.POCKET_TORTURE_LIVE_ENABLED,
    token: process.env.POCKET_TORTURE_LIVE_TOKEN,
  })) return NextResponse.json({error:"Live benchmark not authorized."},{status:403});
  // A paid run must explicitly name one case; batch execution requires a budget check between calls.
  if (!requested) return NextResponse.json({error:"Live benchmark requires one named case."},{status:400});
  const metrics:Record<"levels"|"patterns"|"liquidity",Counts>={levels:{tp:0,fp:0,fn:0},patterns:{tp:0,fp:0,fn:0},liquidity:{tp:0,fp:0,fn:0}};
  const failures:string[]=[]; const observations:unknown[]=[];
  const measuredCaseIds: string[] = [];
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
    const startedAt = performance.now();
    try {
      response=await analyse(req);
      const payload = await response.json();
      body = response.ok ? unwrapTortureAnalysis(payload) as Analysis : payload as Analysis;
    } catch (error) {
      failures.push(`${sample.id}: analysis exception ${error instanceof Error ? error.message : String(error)}`);
      observations.push({id:sample.id,durationMs:Math.round(performance.now()-startedAt),exception:error instanceof Error ? error.message : String(error)});
      continue;
    }
    const durationMs = Math.round(performance.now()-startedAt);
    if(!response.ok){failures.push(`${sample.id}: HTTP ${response.status} ${body.error??""}`);observations.push({id:sample.id,durationMs,httpStatus:response.status,error:body.error??null});continue;}
    const scoredCase = scoreTortureAnalysis(sample, body);
    const { levels, patterns } = scoredCase;
    for (const key of ["levels", "patterns", "liquidity"] as const) {
      for (const count of ["tp", "fp", "fn"] as const) metrics[key][count] += scoredCase.metrics[key][count];
    }
    failures.push(...scoredCase.failures);
    measuredCaseIds.push(sample.id);
    observations.push({id:sample.id,durationMs,readability:body.evidenceQuality?.chartReadability,levels,patterns,liquidity:body.liquidity});
  }
  const summary = summarizeTortureMeasurements(selected.map(sample=>sample.id),measuredCaseIds,metrics);
  const pass = summary.measurementComplete && failures.length === 0;
  return NextResponse.json({cases:selected.length,...summary,failures,observations,pass},{status:pass?200:422});
}
