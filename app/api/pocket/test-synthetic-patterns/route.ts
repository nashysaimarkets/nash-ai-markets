import { NextResponse } from "next/server";
import { scanDevicePixels } from "../../../pocket-next/device-geometry";

export const runtime="nodejs";

type Point={i:number;y:number};
type Case={id:string;expected:string;anchors:Point[]};

const W=420,H=300,LEFT=28,RIGHT=382,N=88;

const CASES:Case[]=[
  {id:"head-shoulders",expected:"HEAD & SHOULDERS",anchors:[
    {i:0,y:225},{i:16,y:155},{i:24,y:105},{i:32,y:160},{i:41,y:68},{i:50,y:158},{i:60,y:108},{i:69,y:172},{i:87,y:220}]},
  {id:"inverse-head-shoulders",expected:"INVERSE H&S",anchors:[
    {i:0,y:78},{i:16,y:145},{i:24,y:195},{i:32,y:140},{i:41,y:232},{i:50,y:142},{i:60,y:192},{i:69,y:128},{i:87,y:78}]},
  {id:"double-top",expected:"DOUBLE TOP",anchors:[
    {i:0,y:225},{i:18,y:140},{i:28,y:78},{i:40,y:154},{i:54,y:80},{i:65,y:166},{i:87,y:218}]},
  {id:"double-bottom",expected:"DOUBLE BOTTOM",anchors:[
    {i:0,y:76},{i:18,y:140},{i:28,y:224},{i:40,y:146},{i:54,y:222},{i:65,y:132},{i:87,y:78}]},
  {id:"range",expected:"RECTANGLE / RANGE",anchors:[
    {i:0,y:150},{i:10,y:96},{i:20,y:204},{i:30,y:98},{i:40,y:202},{i:50,y:97},{i:60,y:203},{i:70,y:99},{i:80,y:201},{i:87,y:150}]},
  {id:"ascending-triangle",expected:"ASCENDING TRIANGLE",anchors:[
    {i:0,y:225},{i:14,y:102},{i:24,y:220},{i:34,y:101},{i:44,y:188},{i:54,y:100},{i:64,y:158},{i:74,y:99},{i:87,y:82}]},
  {id:"descending-triangle",expected:"DESCENDING TRIANGLE",anchors:[
    {i:0,y:78},{i:14,y:198},{i:24,y:82},{i:34,y:200},{i:44,y:112},{i:54,y:201},{i:64,y:146},{i:74,y:202},{i:87,y:220}]},
  {id:"triangle",expected:"TRIANGLE",anchors:[
    {i:0,y:150},{i:12,y:82},{i:22,y:220},{i:32,y:106},{i:42,y:194},{i:52,y:128},{i:62,y:172},{i:72,y:145},{i:82,y:158},{i:87,y:151}]},
  {id:"rising-wedge",expected:"RISING WEDGE",anchors:[
    {i:0,y:230},{i:12,y:185},{i:22,y:220},{i:32,y:150},{i:42,y:178},{i:52,y:118},{i:62,y:137},{i:72,y:88},{i:82,y:98},{i:87,y:82}]},
  {id:"falling-wedge",expected:"FALLING WEDGE",anchors:[
    {i:0,y:70},{i:12,y:118},{i:22,y:84},{i:32,y:155},{i:42,y:128},{i:52,y:190},{i:62,y:171},{i:72,y:220},{i:82,y:210},{i:87,y:224}]},
  {id:"up-channel",expected:"TREND CHANNEL",anchors:[
    {i:0,y:220},{i:10,y:180},{i:20,y:205},{i:30,y:155},{i:40,y:180},{i:50,y:130},{i:60,y:155},{i:70,y:105},{i:80,y:130},{i:87,y:92}]},
  {id:"down-channel",expected:"TREND CHANNEL",anchors:[
    {i:0,y:82},{i:10,y:122},{i:20,y:98},{i:30,y:148},{i:40,y:124},{i:50,y:174},{i:60,y:150},{i:70,y:200},{i:80,y:176},{i:87,y:218}]},
  {id:"bull-flag",expected:"BULL FLAG",anchors:[
    {i:0,y:230},{i:25,y:220},{i:34,y:92},{i:40,y:105},{i:47,y:126},{i:54,y:112},{i:61,y:134},{i:68,y:118},{i:76,y:92},{i:87,y:72}]},
  {id:"bear-flag",expected:"BEAR FLAG",anchors:[
    {i:0,y:70},{i:25,y:82},{i:34,y:214},{i:40,y:200},{i:47,y:180},{i:54,y:194},{i:61,y:173},{i:68,y:188},{i:76,y:214},{i:87,y:232}]},
  {id:"straight-up",expected:"NO CLEAN PATTERN",anchors:[{i:0,y:230},{i:87,y:72}]},
  {id:"straight-down",expected:"NO CLEAN PATTERN",anchors:[{i:0,y:72},{i:87,y:230}]},
  {id:"one-spike",expected:"NO CLEAN PATTERN",anchors:[{i:0,y:160},{i:35,y:150},{i:43,y:70},{i:51,y:158},{i:87,y:150}]},
  {id:"random-chop",expected:"NO CLEAN PATTERN",anchors:[
    {i:0,y:150},{i:8,y:130},{i:16,y:174},{i:24,y:118},{i:32,y:164},{i:40,y:137},{i:48,y:182},{i:56,y:122},{i:64,y:170},{i:72,y:140},{i:80,y:166},{i:87,y:146}]}
];

function interp(anchors:Point[],i:number){
  let a=anchors[0],b=anchors[anchors.length-1];
  for(let k=1;k<anchors.length;k++){if(i<=anchors[k].i){a=anchors[k-1];b=anchors[k];break;}}
  const t=(i-a.i)/Math.max(1,b.i-a.i);
  return a.y+(b.y-a.y)*t;
}

function render(test:Case,variant:number){
  const data=new Uint8Array(W*H*3);data.fill(248);
  const set=(x:number,y:number,r:number,g:number,b:number)=>{
    if(x<0||x>=W||y<0||y>=H)return;
    const p=(Math.round(y)*W+Math.round(x))*3;data[p]=r;data[p+1]=g;data[p+2]=b;
  };
  const line=(x:number,y1:number,y2:number,r:number,g:number,b:number,half=0)=>{
    const lo=Math.max(1,Math.round(Math.min(y1,y2))),hi=Math.min(H-2,Math.round(Math.max(y1,y2)));
    for(let y=lo;y<=hi;y++)for(let dx=-half;dx<=half;dx++)set(x+dx,y,r,g,b);
  };
  let prev=interp(test.anchors,0);
  const amp=[0,1.2,2.1,3.1][variant%4];
  for(let i=0;i<N;i++){
    const x=Math.round(LEFT+(RIGHT-LEFT)*i/(N-1));
    const base=interp(test.anchors,i);
    const jitter=Math.sin(i*1.77+variant*.83)*amp+Math.sin(i*.41+variant)*amp*.45;
    const close=base+jitter;
    const open=prev+Math.cos(i*.93+variant)*2.2;
    const wick=4+(i%3)+variant*.35;
    const high=Math.min(open,close)-wick;
    const low=Math.max(open,close)+wick;
    const up=close<open;
    const rgb=up?[38,166,82]:[224,70,66];
    line(x,high,low,rgb[0],rgb[1],rgb[2],0);
    line(x,Math.min(open,close),Math.max(open,close),rgb[0],rgb[1],rgb[2],1);
    prev=close;
  }
  return data;
}

function norm(name:string){return name.replace(" CANDIDATE","").trim();}
function visible(scan:ReturnType<typeof scanDevicePixels>){return scan.patterns.filter(p=>p.confidence!=="LOW");}

export async function GET(request:Request){
  const u=new URL(request.url);
  if(u.searchParams.get("key")!=="pocket-next-internal")return NextResponse.json({error:"not found"},{status:404});
  const variants=Math.min(8,Math.max(1,Number(u.searchParams.get("variants")||4)));
  const results:any[]=[];
  let total=0,exact=0,negativePass=0,negativeTotal=0,strongWrong=0,stable=0;
  for(const test of CASES){
    const runs=[] as any[];
    for(let v=0;v<variants;v++){
      const scan=scanDevicePixels({pixels:render(test,v),width:W,height:H,channels:3});
      const pats=visible(scan);
      const names=pats.map(p=>p.name);
      const hit=test.expected==="NO CLEAN PATTERN"?!names.length:names.some(n=>norm(n)===norm(test.expected));
      if(test.expected==="NO CLEAN PATTERN"){negativeTotal++;if(!names.length)negativePass++;}
      if(test.expected!=="NO CLEAN PATTERN"&&names.length&&!hit)strongWrong++;
      if(test.expected!=="NO CLEAN PATTERN"&&hit)exact++;
      total++;
      runs.push({variant:v,names,levels:scan.levels.length,liquidity:scan.liquidity.zones.length,candles:scan.candleCount,hit});
    }
    const signature=JSON.stringify(runs[0]?.names??[]);
    if(runs.every(r=>JSON.stringify(r.names)===signature))stable++;
    results.push({id:test.id,expected:test.expected,runs});
  }
  return NextResponse.json({
    cases:CASES.length,variants,total,exact,positiveTotal:(CASES.filter(c=>c.expected!=="NO CLEAN PATTERN").length*variants),
    negativePass,negativeTotal,strongWrong,stableCases:stable,results
  });
}
