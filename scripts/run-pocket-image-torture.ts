import { POST } from "../app/api/pocket/analyse/route.ts";
import { TORTURE_CASES, syntheticSvg, syntheticPrecisionCropSpec, buildTortureRequestPayload, unwrapTortureAnalysis } from "../tests/support/pocket-image-torture.ts";

// @ts-expect-error sharp 0.35 exports omit its bundled declaration path under TS bundler resolution.
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

const matchLevel=(expected:{kind:string;y:number;tolerance:number}, actual:Array<{kind?:string;y?:number}>) =>
  actual.some(x=>x.kind===expected.kind && typeof x.y==="number" && Math.abs(x.y-expected.y)<=expected.tolerance);

for(const sample of TORTURE_CASES){
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
  const response=await POST(req);
  const payload=await response.json() as {analysis?:unknown;error?:string};
  if(!response.ok){ failures.push(`${sample.id}: HTTP ${response.status} ${payload.error??""}`); continue; }
  const body=unwrapTortureAnalysis(payload) as Analysis;

  const actualLevels=(body.levels??[]).filter(x=>x.kind==="support"||x.kind==="resistance");
  for(const expected of sample.expectedLevels){
    if(matchLevel(expected,actualLevels)) metrics.levels.tp++; else {metrics.levels.fn++; failures.push(`${sample.id}: missed ${expected.kind} @ ${expected.y}%±${expected.tolerance}`);}
  }
  for(const actual of actualLevels){
    if(!sample.expectedLevels.some(e=>matchLevel(e,[actual]))) {metrics.levels.fp++; failures.push(`${sample.id}: unexpected ${actual.kind} @ ${actual.y}%`);}
  }

  const actualPatterns=(body.patterns??[]).map(x=>x.name).filter((x):x is string=>Boolean(x));
  for(const expected of sample.expectedPatterns){
    if(actualPatterns.includes(expected)) metrics.patterns.tp++; else {metrics.patterns.fn++; failures.push(`${sample.id}: missed pattern ${expected}`);}
  }
  for(const actual of actualPatterns){
    if(!sample.expectedPatterns.includes(actual)){metrics.patterns.fp++; failures.push(`${sample.id}: unexpected pattern ${actual}`);}
  }
  for(const forbidden of sample.forbiddenPatterns??[]){
    if(actualPatterns.includes(forbidden)) failures.push(`${sample.id}: forbidden false pattern ${forbidden}`);
  }

  const liq=body.liquidity??{};
  const expectedPositive=sample.expectedLiquidity.state!=="NONE";
  const actualPositive=liq.state==="VERIFIED"||liq.state==="PARTIAL";
  if(expectedPositive&&actualPositive) metrics.liquidity.tp++;
  else if(expectedPositive&&!actualPositive){metrics.liquidity.fn++; failures.push(`${sample.id}: missed liquidity structure`);}
  else if(!expectedPositive&&actualPositive){metrics.liquidity.fp++; failures.push(`${sample.id}: false liquidity structure ${liq.state}`);}
  if(sample.expectedLiquidity.event && liq.event!==sample.expectedLiquidity.event) failures.push(`${sample.id}: liquidity event ${liq.event} != ${sample.expectedLiquidity.event}`);
  if(sample.expectedLiquidity.minimumZones!=null && (liq.zones?.length??0)<sample.expectedLiquidity.minimumZones) failures.push(`${sample.id}: liquidity zones below minimum`);

  console.log(JSON.stringify({id:sample.id,readability:body.evidenceQuality?.chartReadability,levels:actualLevels,patterns:actualPatterns,liquidity:liq}));
}

const rate=(m:Counts,key:"precision"|"recall")=>{
  const d=key==="precision"?m.tp+m.fp:m.tp+m.fn;
  return d?m.tp/d:null;
};
console.log("IMAGE_TORTURE_METRICS",JSON.stringify(Object.fromEntries(Object.entries(metrics).map(([k,m])=>[k,{...m,precision:rate(m,"precision"),recall:rate(m,"recall")}]))));
if(failures.length){console.error("IMAGE_TORTURE_FAILURES\n"+failures.join("\n"));process.exitCode=1;}
