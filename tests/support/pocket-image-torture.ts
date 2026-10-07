export type TortureCase = {
  id: string;
  market: string;
  timeframe: "5m" | "30m" | "1h" | "4h";
  points: number[];
  expectedLevels: Array<{ kind: "support" | "resistance"; y: number; tolerance: number }>;
  expectedPatterns: string[];
  forbiddenPatterns?: string[];
  expectedLiquidity: { state: "VERIFIED" | "PARTIAL" | "NONE"; event?: "NONE" | "TESTING" | "SWEEP" | "RECLAIM" | "REJECTION"; minimumZones?: number };
  degrade?: "blur" | "compress" | "crop-scale";
};

export const TORTURE_CASES: TortureCase[] = [
  { id:"range-clear", market:"SYNTH-RANGE", timeframe:"30m", points:[72,65,35,28,62,70,40,30,64,69,42,33,58,61],
    expectedLevels:[{kind:"resistance",y:31,tolerance:7},{kind:"support",y:64,tolerance:7}], expectedPatterns:["RECTANGLE / RANGE"],
    expectedLiquidity:{state:"VERIFIED",minimumZones:1} },
  { id:"double-top", market:"SYNTH-DTOP", timeframe:"1h", points:[75,58,32,52,70,50,31,48,67,78],
    expectedLevels:[{kind:"resistance",y:34,tolerance:8}], expectedPatterns:["DOUBLE TOP"], expectedLiquidity:{state:"PARTIAL"} },
  { id:"head-shoulders", market:"SYNTH-HS", timeframe:"4h", points:[75,55,38,62,22,61,37,64,80],
    expectedLevels:[], expectedPatterns:["HEAD & SHOULDERS"], expectedLiquidity:{state:"PARTIAL"} },
  { id:"sweep-reclaim", market:"SYNTH-SWEEP", timeframe:"5m", points:[70,45,30,48,31,50,29,18,38,52],
    expectedLevels:[{kind:"resistance",y:32,tolerance:9}], expectedPatterns:[], forbiddenPatterns:["HEAD & SHOULDERS","DOUBLE TOP"],
    expectedLiquidity:{state:"VERIFIED",event:"SWEEP",minimumZones:1} },
  { id:"near-miss-chop", market:"SYNTH-CHOP", timeframe:"30m", points:[55,48,52,45,50,47,54,49,51,46,53],
    expectedLevels:[], expectedPatterns:[], forbiddenPatterns:["HEAD & SHOULDERS","DOUBLE TOP","DOUBLE BOTTOM","TRIANGLE","PENNANT"],
    expectedLiquidity:{state:"NONE",minimumZones:0} },
  { id:"degraded-no-signal", market:"SYNTH-NOISE", timeframe:"30m", points:[60,52,57,49,55,51,58,50],
    expectedLevels:[], expectedPatterns:[], forbiddenPatterns:["HEAD & SHOULDERS","DOUBLE TOP","DOUBLE BOTTOM","TRIANGLE","PENNANT"],
    expectedLiquidity:{state:"NONE",minimumZones:0}, degrade:"blur" },
];

const esc=(s:string)=>s.replace(/[&<>"]/g,(c)=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]!));

export function syntheticSvg(sample:TortureCase): string {
  const width=900,height=600,left=70,right=820,top=60,bottom=520;
  const xs=sample.points.map((_,i)=>90+i*(700/Math.max(1,sample.points.length-1)));
  const ys=sample.points.map(v=>top+v*4.6);
  const candles=xs.map((x,i)=>{
    const y=ys[i]!, prev=i?ys[i-1]!:y;
    const bodyTop=Math.min(y,prev)-3, bodyHeight=Math.max(7,Math.abs(y-prev)*0.28);
    return `<line x1="${x}" y1="${y-12}" x2="${x}" y2="${y+12}" stroke="#111" stroke-width="2"/><rect x="${x-5}" y="${bodyTop}" width="10" height="${bodyHeight}" fill="${y<=prev?"#fff":"#777"}" stroke="#111"/>`;
  }).join("");
  const grid=[60,152,244,336,428,520].map(y=>`<line x1="${left}" y1="${y}" x2="${right}" y2="${y}" stroke="#ddd"/>`).join("");
  const scale=sample.degrade==="crop-scale"?"":[["110",80],["105",190],["100",300],["95",410],["90",500]].map(([p,y])=>`<text x="832" y="${y}" font-size="16" font-family="Arial">${p}</text>`).join("");
  const filter=sample.degrade==="blur"?' filter="url(#blur)"':"";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="white"/><defs><filter id="blur"><feGaussianBlur stdDeviation="3.2"/></filter></defs><text x="75" y="30" font-size="18" font-family="Arial">${esc(sample.market)} · ${sample.timeframe}</text><g${filter}>${grid}<rect x="${left}" y="${top}" width="${right-left}" height="${bottom-top}" fill="none" stroke="#555" stroke-width="2"/>${candles}</g>${scale}</svg>`;
}
