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

export const SYNTHETIC_PRICE_AXIS = [
  {price:110,y:80},{price:105,y:185},{price:100,y:290},{price:95,y:395},{price:90,y:500},
] as const;

export function syntheticCandleGeometry(sample: TortureCase) {
  return sample.points.map((point, index) => {
    const closeY = 60 + point * 4.6;
    const openY = index === 0 ? closeY + 5 : 60 + sample.points[index - 1]! * 4.6;
    const bodyTop = Math.min(openY, closeY);
    const bodyBottom = Math.max(openY, closeY);
    return { openY, closeY, bodyTop, bodyBottom, highY: bodyTop - 8, lowY: bodyBottom + 8 };
  });
}

/** Font-independent price glyphs: Vercel Sharp may lack a usable fontconfig setup. */
function vectorPriceLabel(price: number, y: number): string {
  const segments: Record<string, string> = {
    "0": "abcdef", "1": "bc", "2": "abged", "3": "abgcd", "4": "fgbc",
    "5": "afgcd", "6": "afgecd", "7": "abc", "8": "abcdefg", "9": "abcfgd",
  };
  const strokes: Record<string, string> = {
    a: "M1 0H7", b: "M8 1V6", c: "M8 8V13", d: "M1 14H7",
    e: "M0 8V13", f: "M0 1V6", g: "M1 7H7",
  };
  const digits = String(price).split("").map((digit, index) => {
    const d = [...(segments[digit] ?? "")].map((segment) => strokes[segment]).join(" ");
    return `<path data-axis-digit="${digit}" d="${d}" transform="translate(${832 + index * 11} ${y - 7})" fill="none" stroke="#111" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`;
  }).join("");
  return `<g data-axis-price="${price}" data-axis-y="${y}">${digits}</g>`;
}
const esc=(s:string)=>s.replace(/[&<>"]/g,(c)=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]!));

export function syntheticSvg(sample:TortureCase): string {
  const width=900,height=600,left=70,right=820,top=60,bottom=520;
  const xs=sample.points.map((_,i)=>90+i*(700/Math.max(1,sample.points.length-1)));
  const candles=syntheticCandleGeometry(sample).map((candle,i)=>{
    const x=xs[i]!;
    return `<line x1="${x}" y1="${candle.highY}" x2="${x}" y2="${candle.lowY}" stroke="#111" stroke-width="2"/><rect x="${x-5}" y="${candle.bodyTop}" width="10" height="${Math.max(1,candle.bodyBottom-candle.bodyTop)}" fill="${candle.closeY<=candle.openY?"#fff":"#777"}" stroke="#111"/>`;
  }).join("");
  const grid=[60,152,244,336,428,520].map(y=>`<line x1="${left}" y1="${y}" x2="${right}" y2="${y}" stroke="#ddd"/>`).join("");
  const scale=sample.degrade==="crop-scale"?"":SYNTHETIC_PRICE_AXIS.map(({price,y})=>vectorPriceLabel(price,y)).join("");
  const filter=sample.degrade==="blur"?' filter="url(#blur)"':"";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="white"/><defs><filter id="blur"><feGaussianBlur stdDeviation="3.2"/></filter></defs><text x="75" y="30" font-size="18" font-family="Arial">${esc(sample.market)} · ${sample.timeframe}</text><g${filter}>${grid}<rect x="${left}" y="${top}" width="${right-left}" height="${bottom-top}" fill="none" stroke="#555" stroke-width="2"/>${candles}</g>${scale}</svg>`;
}

/** The production analyse route returns { analysis }, never bare scanner fields. */
export function unwrapTortureAnalysis(payload: unknown): {
  levels?: Array<{kind?: string; y?: number}>;
  patterns?: Array<{name?: string}>;
  liquidity?: {state?: string; event?: string; zones?: unknown[]};
  evidenceQuality?: {chartReadability?: string};
} {
  if (!payload || typeof payload !== "object" || !("analysis" in payload) ||
      !payload.analysis || typeof payload.analysis !== "object" || Array.isArray(payload.analysis)) {
    throw new Error("Missing analysis envelope in live torture response");
  }
  return payload.analysis as ReturnType<typeof unwrapTortureAnalysis>;
}

/** Mirror PocketBullseye.tsx createPrecisionReadingCrop's 6%/82% full-width crop. */
export function syntheticPrecisionCropSpec(width: number, height: number) {
  const top = Math.round(height * 0.06);
  const cropHeight = Math.round(height * 0.82);
  const targetWidth = Math.min(1800, Math.max(1400, width));
  return { left: 0, top, width, height: cropHeight, targetWidth,
    targetHeight: Math.round(cropHeight * targetWidth / width) };
}

/** Scale drawn by syntheticSvg: 110 at pixel y=80 and 90 at pixel y=500. */
export function syntheticLastPrice(sample: TortureCase): string {
  const last = sample.points.at(-1);
  if (last === undefined) throw new Error(sample.id + ": empty chart");
  const lastPixelY = 60 + last * 4.6;
  return (110 - (lastPixelY - 80) / 21).toFixed(2);
}

export function buildTortureRequestPayload(sample: TortureCase, image: string, precisionImage: string) {
  return { image, precisionImage, intention: "UNSURE" as const,
    chartConfirmation: {
      instrument: sample.market, timeframe: sample.timeframe,
      currentPrice: syntheticLastPrice(sample), contextMatch: "NOT_PROVIDED" as const,
    },
  };
}

/** Additional negative and zone-count assertions shared by live torture scoring. */
export function tortureExpectationFailures(
  sample: TortureCase,
  patterns: string[],
  liquidity: {state?: string;event?: string;zones?: unknown[]} | undefined,
): string[] {
  const failures: string[] = [];
  for (const forbidden of sample.forbiddenPatterns ?? []) {
    if (patterns.includes(forbidden)) failures.push(`${sample.id}: forbidden pattern ${forbidden}`);
  }
  const minimum = sample.expectedLiquidity.minimumZones;
  if (minimum !== undefined && (liquidity?.zones?.length ?? 0) < minimum) {
    failures.push(`${sample.id}: liquidity zones ${liquidity?.zones?.length ?? 0} < ${minimum}`);
  }
  return failures;
}

export type TortureCounts = { tp: number; fp: number; fn: number };
export type TortureMetrics = Record<"levels" | "patterns" | "liquidity", TortureCounts>;

/** Rates describe the complete selected corpus, never a silent successful subset. */
export function summarizeTortureMeasurements(caseIds: string[], measuredCaseIds: string[], counts: TortureMetrics) {
  if (new Set(measuredCaseIds).size !== measuredCaseIds.length || measuredCaseIds.some(id => !caseIds.includes(id))) {
    throw new Error("Invalid measurement IDs");
  }
  const unmeasuredCaseIds = caseIds.filter(id => !measuredCaseIds.includes(id));
  const measurementComplete = caseIds.length > 0 && unmeasuredCaseIds.length === 0;
  const rates = (metric: TortureCounts) => ({...metric,
    precision: measurementComplete && metric.tp + metric.fp > 0 ? metric.tp / (metric.tp + metric.fp) : null,
    recall: measurementComplete && metric.tp + metric.fn > 0 ? metric.tp / (metric.tp + metric.fn) : null,
  });
  return {measurementComplete,measuredCases:measuredCaseIds.length,unmeasuredCaseIds,
    metrics:{levels:rates(counts.levels),patterns:rates(counts.patterns),liquidity:rates(counts.liquidity)}};
}

/** One-to-one detections; a wrong liquidity state/event is both a miss and a false detection. */
export function scoreTortureAnalysis(sample: TortureCase, body: ReturnType<typeof unwrapTortureAnalysis>) {
  const metrics: TortureMetrics = {levels:{tp:0,fp:0,fn:0},patterns:{tp:0,fp:0,fn:0},liquidity:{tp:0,fp:0,fn:0}};
  const failures: string[] = [];
  const levels = (body.levels ?? []).filter(level => level.kind === "support" || level.kind === "resistance");
  const matchedActual = new Map<number, number>();
  // Augmenting paths avoid order-dependent greedy matching when tolerances overlap.
  function assign(expectedIndex: number, visited: Set<number>): boolean {
    const expected = sample.expectedLevels[expectedIndex]!;
    for (const [index, actual] of levels.entries()) {
      if (visited.has(index) || actual.kind !== expected.kind || !Number.isFinite(actual.y) ||
          Math.abs(actual.y! - expected.y) > expected.tolerance) continue;
      visited.add(index);
      const previous = matchedActual.get(index);
      if (previous === undefined || assign(previous, visited)) {
        matchedActual.set(index, expectedIndex);
        return true;
      }
    }
    return false;
  }
  sample.expectedLevels.forEach((expected, index) => {
    if (assign(index, new Set())) metrics.levels.tp++;
    else { metrics.levels.fn++; failures.push(`${sample.id}: missed ${expected.kind}@${expected.y}`); }
  });
  levels.forEach((actual, index) => {
    if (!matchedActual.has(index)) { metrics.levels.fp++; failures.push(`${sample.id}: false level ${actual.kind}@${actual.y}`); }
  });
  const patterns = (body.patterns ?? []).map(pattern => pattern.name).filter((name): name is string => Boolean(name));
  const remainingPatterns = [...sample.expectedPatterns];
  for (const name of patterns) {
    const index = remainingPatterns.indexOf(name);
    if (index >= 0) { metrics.patterns.tp++; remainingPatterns.splice(index, 1); }
    else { metrics.patterns.fp++; failures.push(`${sample.id}: false pattern ${name}`); }
  }
  for (const name of remainingPatterns) { metrics.patterns.fn++; failures.push(`${sample.id}: missed pattern ${name}`); }
  const expected = sample.expectedLiquidity;
  const actual = body.liquidity;
  const expectedPositive = expected.state !== "NONE";
  const actualPositive = actual?.state === "VERIFIED" || actual?.state === "PARTIAL";
  const correct = actualPositive && actual?.state === expected.state &&
    (!expected.event || actual.event === expected.event) &&
    (actual.zones?.length ?? 0) >= (expected.minimumZones ?? 0);
  if (expectedPositive && correct) metrics.liquidity.tp++;
  else {
    if (expectedPositive) { metrics.liquidity.fn++; failures.push(`${sample.id}: missed expected liquidity ${expected.state}/${expected.event ?? "any event"}`); }
    if (actualPositive) { metrics.liquidity.fp++; failures.push(`${sample.id}: false liquidity ${actual?.state}/${actual?.event ?? "no event"}`); }
  }
  if (expected.event && actual?.event !== expected.event) failures.push(`${sample.id}: liquidity event ${actual?.event} != ${expected.event}`);
  failures.push(...tortureExpectationFailures(sample, patterns, actual));
  return {metrics, failures, levels, patterns};
}
