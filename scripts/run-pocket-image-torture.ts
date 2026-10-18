import { isBenchmarkPilotSpendHeld } from "../app/api/pocket/torture/spending-hold.ts";
import { recordPocketBenchmarkMeasurement, withPocketTestSpendScope } from "../app/api/pocket/torture/provider-spend.ts";
import { tortureHttpFailure } from "../app/api/pocket/torture/http-failure.ts";
import { POST } from "../app/api/pocket/analyse/route.ts";
import { TORTURE_CASES, syntheticSvg, syntheticPrecisionCropSpec, buildTortureRequestPayload, unwrapTortureAnalysis, scoreTortureAnalysis, summarizeTortureMeasurements } from "../tests/support/pocket-image-torture.ts";

const sharpModule = await import("sharp");
const sharp = sharpModule.default;

type Analysis = {
  evidenceQuality?: { chartReadability?: string };
  levels?: Array<{ kind?: string; y?: number }>;
  patterns?: Array<{ name?: string }>;
  liquidity?: { state?: string; event?: string; zones?: unknown[] };
};

type Counts = { tp:number; fp:number; fn:number };
const metrics: Record<"levels"|"patterns"|"liquidity",Counts> = {
  levels:{tp:0,fp:0,fn:0}, patterns:{tp:0,fp:0,fn:0}, liquidity:{tp:0,fp:0,fn:0},
};
const failures: string[]=[];
const measuredCaseIds: string[]=[];
const observations: unknown[]=[];
let reconciled=false;
let committedMicroUsd: number | null=null;
const requestedCase = process.env.POCKET_TORTURE_CASE?.trim();
const selected = TORTURE_CASES.filter(sample => sample.id === requestedCase);
// Fail before creating images, requests, or AI clients unless exactly one named case was selected.
if (selected.length !== 1) throw new Error("POCKET_TORTURE_CASE must name exactly one labelled fixture for a paid run.");

// CUMULATIVE_TEST_SPEND_HOLD: CI process restarts must never reset the dollar cap.
if (isBenchmarkPilotSpendHeld()) throw new Error("The separately approved benchmark pilot controls are not enabled. No AI request was sent.");

for(const sample of selected){
  let pipeline=sharp(Buffer.from(syntheticSvg(sample))).png();
  if(sample.degrade==="compress") pipeline=pipeline.jpeg({quality:28}).png();
  const image=await pipeline.toBuffer();
  const spec=syntheticPrecisionCropSpec(900,600);
  const crop=await sharp(image).extract({left:spec.left,top:spec.top,width:spec.width,height:spec.height}).resize(spec.targetWidth,spec.targetHeight,{fit:"fill"}).jpeg({quality:92}).toBuffer();
  const data=`data:image/png;base64,${image.toString("base64")}`;
  const req=new Request("http://localhost/api/pocket/analyse",{
    method:"POST",headers:{"content-type":"application/json","x-forwarded-for":`127.0.0.${TORTURE_CASES.indexOf(sample)+1}`},
    body:JSON.stringify(buildTortureRequestPayload(sample,data,"data:image/jpeg;base64,"+crop.toString("base64"))),
  });
  const startedAt = performance.now();
  let response: Response;
  let payload: {analysis?:unknown;error?:string};
  let body: Analysis;
  try {
    const run=await withPocketTestSpendScope(sample.id, async () => await POST(req));
    response=run.value;
    reconciled=run.reconciliation.reconciled;
    committedMicroUsd=run.reconciliation.committedMicroUsd;
    payload=await response.json() as {analysis?:unknown;error?:string};
    body = response.ok ? unwrapTortureAnalysis(payload) as Analysis : {};
  } catch (error) {
    const durationMs = Math.round(performance.now()-startedAt);
    failures.push(`${sample.id}: analysis exception ${error instanceof Error ? error.message : String(error)}`);
    console.log(JSON.stringify({id:sample.id,durationMs,scored:false,exception:error instanceof Error ? error.message : String(error)}));
    continue;
  }
  const durationMs = Math.round(performance.now()-startedAt);
  if(!response.ok){ failures.push(`${sample.id}: HTTP ${response.status} ${payload.error??""}`);console.log(JSON.stringify({id:sample.id,durationMs,scored:false,analysisHttpStatus:response.status,httpStatus:response.status,error:payload.error??null,...tortureHttpFailure(response)})); continue; }
  const scoredCase = scoreTortureAnalysis(sample, body);
  const { levels: actualLevels, patterns: actualPatterns } = scoredCase;
  const liq = body.liquidity ?? {};
  for (const key of ["levels", "patterns", "liquidity"] as const) {
    for (const count of ["tp", "fp", "fn"] as const) metrics[key][count] += scoredCase.metrics[key][count];
  }
  failures.push(...scoredCase.failures);
  measuredCaseIds.push(sample.id);

  observations.push({id:sample.id,durationMs,scored:true,httpStatus:response.status,analysisHttpStatus:response.status,caseMetrics: scoredCase.metrics,readability:body.evidenceQuality?.chartReadability,levels:actualLevels,patterns:actualPatterns,liquidity:liq});
}

const summary = summarizeTortureMeasurements(TORTURE_CASES.map(sample=>sample.id),measuredCaseIds,metrics);
if(measuredCaseIds.length===1){
  const measurement={...summary,casePass:failures.length===0,failures,observations,pass:summary.measurementComplete&&failures.length===0};
  await recordPocketBenchmarkMeasurement(selected[0]!.id,measurement);
  if(!reconciled){
    console.log("IMAGE_TORTURE_PENDING_SETTLEMENT",JSON.stringify({caseId:selected[0]!.id,scored:false,committedMicroUsd}));
    process.exitCode=2;
  }else console.log("IMAGE_TORTURE_MEASUREMENTS",JSON.stringify(measurement));
}else console.log("IMAGE_TORTURE_MEASUREMENTS",JSON.stringify(summary));
if(failures.length){console.error("IMAGE_TORTURE_FAILURES\n"+failures.join("\n"));process.exitCode=1;}
