"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Direction = "BULLISH" | "BEARISH" | "NEUTRAL";
type Intention = "LONG" | "SHORT" | "UNSURE";
type Tab = "overview" | "levels" | "structure" | "patterns" | "liquidity" | "risk";
type Level = { kind: "support" | "resistance" | "trend" | "pivot" | "zone" | "gap"; label: string; price: string; x: number; y: number; x2: number; y2: number };
type Pattern = { name: string; status: "FORMING" | "CONFIRMED" | "FAILED" | "AMBIGUOUS" | "EXTENDED"; confidence?: "LOW" | "MEDIUM" | "HIGH"; evidence: string; confirmation?: string; invalidation: string; geometry?: { points: { x: number; y: number }[]; labelX: number; labelY: number } };
type LiquidityZone = { side: "BUY_SIDE" | "SELL_SIDE"; basis: "EQUAL_HIGHS" | "EQUAL_LOWS" | "PRIOR_SWING_HIGH" | "PRIOR_SWING_LOW" | "RANGE_HIGH" | "RANGE_LOW"; price: string; x: number; x2: number; y: number };
type LiquidityRead = { state: "VERIFIED" | "PARTIAL" | "NONE"; event: "NONE" | "TESTING" | "SWEEP" | "RECLAIM" | "REJECTION"; confidence: "LOW" | "MEDIUM" | "HIGH"; evidence: string; confirmation: string; invalidation: string; zones: LiquidityZone[] };
type Analysis = {
  direction: Direction;
  confidence: "LOW" | "MEDIUM" | "HIGH";
  instrument: string;
  ticker: string;
  timeframe: string;
  currentPrice?: string;
  evidenceQuality: {
    chartReadability: "CLEAR" | "PARTIAL" | "POOR";
    instrumentConfidence: "HIGH" | "MEDIUM" | "LOW" | "UNKNOWN";
    timeframeConfidence: "HIGH" | "MEDIUM" | "LOW" | "UNKNOWN";
    scaleReadable: boolean;
    candlesReadable: boolean;
    limitations: string[];
  };
  higherTimeframe: { provided: boolean; timeframe: string; direction: Direction | "UNKNOWN"; alignment: "ALIGNED" | "CONFLICTING" | "MIXED" | "NOT_PROVIDED"; summary: string };
  patterns: Pattern[];
  liquidity?: LiquidityRead;
  nextSequence: { now: string; confirmation: string; failure: string; patience: string; reassess: string };
  summary: string;
  verdict: "WATCH" | "WAIT" | "STAND_ASIDE" | "REVIEW_REQUIRED";
  verdictHeadline: string;
  setupScore: { overall: number; grade: "A" | "B" | "C" | "D" | "F"; structure: number; momentum: number; location: number; confirmation: number; riskClarity: number; eventSafety: number };
  whatYouMayBeMissing: string[];
  improvesSetup: string[];
  killsSetup: string[];
  traderTrap: string;
  bullishCase: string;
  bearishCase: string;
  invalidation: string;
  marketStructure: string;
  levelStory: string;
  momentum: string;
  bullConfirmation: string;
  bearConfirmation: string;
  noTradeCondition: string;
  riskFlags: string[];
  observableFacts: string[];
  contradictions: string[];
  indicators: string[];
  checklist: string[];
  relevantEventTypes: string[];
  levels: Level[];
  plotBounds?: { left: number; top: number; right: number; bottom: number };
  priceScaleAnchors?: { price: number; y: number }[];
};

type PlotBounds = { left: number; top: number; right: number; bottom: number };\ntype LocalScan = { levels: Level[]; patterns: Pattern[]; liquidity: LiquidityRead; candleCount: number; plotBounds: PlotBounds };
type ChartSlot = { image: string | null; name: string; analysis: Analysis | null; localScan: LocalScan | null };

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
function emptyChartSlots(): ChartSlot[] { return Array.from({ length: 5 }, () => ({ image: null, name: "", analysis: null, localScan: null })); }
const TABS: Array<{ id: Tab; label: string; short: string }> = [
  { id: "overview", label: "Overview", short: "OV" },
  { id: "levels", label: "Levels", short: "LV" },
  { id: "structure", label: "Structure", short: "ST" },
  { id: "patterns", label: "Patterns", short: "PT" },
  { id: "liquidity", label: "Liquidity", short: "LQ" },
  { id: "risk", label: "Risk", short: "RK" },
];

function clamp(value: number) { return Math.max(2, Math.min(98, Number.isFinite(value) ? value : 50)); }

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) return reject(new Error("Use a JPEG, PNG or WebP chart."));
    if (file.size > MAX_IMAGE_BYTES) return reject(new Error("Keep each chart under 8 MB."));
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Could not read that chart."));
    reader.onerror = () => reject(new Error("Could not read that chart."));
    reader.readAsDataURL(file);
  });
}

function precisionCrop(dataUrl: string) {
  return new Promise<string | null>((resolve) => {
    const source = new Image();
    source.onload = () => {
      try {
        const top = Math.round(source.naturalHeight * 0.06);
        const height = Math.round(source.naturalHeight * 0.82);
        const targetWidth = Math.min(1800, Math.max(1400, source.naturalWidth));
        const canvas = document.createElement("canvas");
        canvas.width = targetWidth;
        canvas.height = Math.round(height * targetWidth / source.naturalWidth);
        const ctx = canvas.getContext("2d");
        if (!ctx) return resolve(null);
        ctx.drawImage(source, 0, top, source.naturalWidth, height, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.92));
      } catch { resolve(null); }
    };
    source.onerror = () => resolve(null);
    source.src = dataUrl;
  });
}


async function scanChartLocally(dataUrl: string): Promise<LocalScan> {
  return new Promise((resolve) => {
    const source = new Image();
    source.onload = () => {
      try {
        const width = Math.min(420, source.naturalWidth);
        const height = Math.max(180, Math.round(source.naturalHeight * width / source.naturalWidth));
        const canvas = document.createElement("canvas");
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) return resolve({ levels: [], patterns: [], liquidity: { state:"NONE",event:"NONE",confidence:"LOW",evidence:"",confirmation:"",invalidation:"",zones:[] }, candleCount: 0, plotBounds: { left: 4, top: 12, right: 91, bottom: 88 } });
        ctx.drawImage(source, 0, 0, width, height);
        const pixels = ctx.getImageData(0,0,width,height).data;
        const left = Math.round(width * .04), right = Math.round(width * .91);
        const top = Math.round(height * .08), bottom = Math.round(height * .88);
        const columnRuns: Array<{x:number;ys:number[];span:number}> = [];
        for (let x=left;x<=right;x++) {
          const ys:number[] = [];
          for (let y=top;y<=bottom;y++) {
            const i=(y*width+x)*4, r=pixels[i], g=pixels[i+1], b=pixels[i+2], a=pixels[i+3];
            if (a<180) continue;
            const hi=Math.max(r,g,b), lo=Math.min(r,g,b);
            const sat=hi-lo;
            const candleColour = sat>42 && hi>90 && ((g>r+18 && g>b+6) || (r>g+18 && r>b+6) || (b>r+24 && b>g+10));
            if (candleColour) ys.push(y);
          }
          if (ys.length>=2) {
            const span=Math.max(...ys)-Math.min(...ys);
            if (span>=3) columnRuns.push({x,ys,span});
          }
        }

        // Candles in screenshots frequently sit only a pixel or two apart.
        // Grouping neighbouring coloured columns merges an entire chart into
        // one blob. Instead use the longest vertical colour run as the
        // wick/body centre and suppress only nearby duplicate columns.
        const selected:Array<{x:number;ys:number[];span:number}> = [];
        for (const candidate of [...columnRuns].sort((a,b)=>b.span-a.span)) {
          if (selected.every(existing=>Math.abs(existing.x-candidate.x)>=3)) selected.push(candidate);
        }
        selected.sort((a,b)=>a.x-b.x);
        const candles:Array<{x:number;high:number;low:number;mid:number}> = selected.map(candidate=>{
          const high=Math.min(...candidate.ys), low=Math.max(...candidate.ys);
          return {x:candidate.x,high,low,mid:(high+low)/2};
        });

        const pctX=(x:number)=>x/width*100, pctY=(y:number)=>y/height*100;
        const candleLeft = candles.length ? Math.max(left, Math.min(...candles.map(v=>v.x)) - width*.012) : left;
        const candleRight = candles.length ? Math.min(right, Math.max(...candles.map(v=>v.x)) + width*.018) : right;
        const candleTop = candles.length ? Math.max(top, Math.min(...candles.map(v=>v.high)) - height*.012) : top;
        const candleBottom = candles.length ? Math.min(bottom, Math.max(...candles.map(v=>v.low)) + height*.012) : bottom;
        const plotBounds: PlotBounds = { left:pctX(candleLeft), top:pctY(candleTop), right:pctX(candleRight), bottom:pctY(candleBottom) };
        type Swing={x:number;y:number;kind:"high"|"low"};
        const swings:Swing[]=[];
        for(let i=2;i<candles.length-2;i++){
          const c=candles[i];
          const near=candles.slice(i-2,i+3);
          if (c.high===Math.min(...near.map(v=>v.high))) swings.push({x:c.x,y:c.high,kind:"high"});
          if (c.low===Math.max(...near.map(v=>v.low))) swings.push({x:c.x,y:c.low,kind:"low"});
        }
        const cluster=(kind:"high"|"low")=>{
          const src=swings.filter(s=>s.kind===kind).sort((a,b)=>a.y-b.y);
          const groups:Array<Swing[]>=[];
          const tol=Math.max(3,height*.018);
          for(const s of src){
            const found=groups.find(g=>Math.abs(g.reduce((n,v)=>n+v.y,0)/g.length-s.y)<=tol);
            if(found) found.push(s); else groups.push([s]);
          }
          return groups
            .map(g=>({items:g,y:g.reduce((n,v)=>n+v.y,0)/g.length,score:g.length}))
            .sort((a,b)=>b.score-a.score || (kind==="high"?a.y-b.y:b.y-a.y));
        };
        const highs=cluster("high"), lows=cluster("low");
        const chosenHighs=highs.filter(g=>g.score>=1).slice(0,2);
        const chosenLows=lows.filter(g=>g.score>=1).slice(0,2);
        const levels:Level[]=[
          ...chosenHighs.map((g,i)=>({kind:"resistance" as const,label:g.score>=2?"Repeated swing highs":"Swing high",price:"",x:plotBounds.left,y:pctY(g.y),x2:plotBounds.right,y2:pctY(g.y)})),
          ...chosenLows.map((g,i)=>({kind:"support" as const,label:g.score>=2?"Repeated swing lows":"Swing low",price:"",x:plotBounds.left,y:pctY(g.y),x2:plotBounds.right,y2:pctY(g.y)})),
        ].slice(0,4);

        const patterns:Pattern[]=[];
        const repeatedHigh=highs.find(g=>g.score>=2), repeatedLow=lows.find(g=>g.score>=2);
        if(repeatedHigh && repeatedLow){
          const hx=repeatedHigh.items.map(s=>pctX(s.x)), lx=repeatedLow.items.map(s=>pctX(s.x));
          const x1=Math.max(plotBounds.left,Math.min(...hx,...lx)), x2=Math.min(plotBounds.right,Math.max(...hx,...lx));
          if(x2-x1>=18){
            patterns.push({
              name:"RECTANGLE / RANGE",status:"FORMING",confidence:"MEDIUM",
              evidence:"Device geometry found repeated swing highs and lows forming a visible range.",
              confirmation:"Break and hold beyond one range edge.",invalidation:"Range geometry fails after a decisive break.",
              geometry:{points:[{x:x1,y:pctY(repeatedHigh.y)},{x:x2,y:pctY(repeatedHigh.y)},{x:x2,y:pctY(repeatedLow.y)},{x:x1,y:pctY(repeatedLow.y)}],labelX:Math.max(5,x2-16),labelY:Math.max(4,pctY(repeatedHigh.y)-4)}
            });
          }
        } else if (repeatedHigh && repeatedHigh.items.length>=2) {
          const a=repeatedHigh.items[0], b=repeatedHigh.items.at(-1)!;
          if(Math.abs(b.x-a.x)>width*.14) patterns.push({
            name:"DOUBLE TOP",status:"FORMING",confidence:"LOW",
            evidence:"Device geometry found two separated swing highs at a similar row.",
            confirmation:"Visible rejection followed by a lower structural break.",invalidation:"Clean acceptance above the twin highs.",
            geometry:{points:[{x:pctX(a.x),y:pctY(a.y)},{x:pctX((a.x+b.x)/2),y:pctY(Math.max(...candles.filter(v=>v.x>a.x&&v.x<b.x).map(v=>v.low),a.y))},{x:pctX(b.x),y:pctY(b.y)}],labelX:pctX(b.x),labelY:Math.max(4,pctY(b.y)-4)}
          });
        } else if (repeatedLow && repeatedLow.items.length>=2) {
          const a=repeatedLow.items[0], b=repeatedLow.items.at(-1)!;
          if(Math.abs(b.x-a.x)>width*.14) patterns.push({
            name:"DOUBLE BOTTOM",status:"FORMING",confidence:"LOW",
            evidence:"Device geometry found two separated swing lows at a similar row.",
            confirmation:"Visible reclaim followed by a higher structural break.",invalidation:"Clean acceptance below the twin lows.",
            geometry:{points:[{x:pctX(a.x),y:pctY(a.y)},{x:pctX((a.x+b.x)/2),y:pctY(Math.min(...candles.filter(v=>v.x>a.x&&v.x<b.x).map(v=>v.high),a.y))},{x:pctX(b.x),y:pctY(b.y)}],labelX:pctX(b.x),labelY:Math.min(96,pctY(b.y)+4)}
          });
        }

        const zones:LiquidityZone[]=[];
        const liquidityHigh=highs[0], liquidityLow=lows[0];
        if(liquidityHigh){
          const startX=pctX(Math.min(...liquidityHigh.items.map(s=>s.x)));
          zones.push({
            side:"BUY_SIDE",
            basis:liquidityHigh.score>=2?"EQUAL_HIGHS":"PRIOR_SWING_HIGH",
            price:"",
            x:startX,
            x2:Math.max(startX+5,plotBounds.right),
            y:pctY(liquidityHigh.y)
          });
        }
        if(liquidityLow){
          const startX=pctX(Math.min(...liquidityLow.items.map(s=>s.x)));
          zones.push({
            side:"SELL_SIDE",
            basis:liquidityLow.score>=2?"EQUAL_LOWS":"PRIOR_SWING_LOW",
            price:"",
            x:startX,
            x2:Math.max(startX+5,plotBounds.right),
            y:pctY(liquidityLow.y)
          });
        }
        const liquidity:LiquidityRead = zones.length ? {
          state:"PARTIAL",event:"TESTING",confidence:"LOW",
          evidence:"Device pixel geometry marked repeated or prior swing references only; hidden orders are not inferred.",
          confirmation:"A visible sweep/reclaim or rejection is still required.",
          invalidation:"The reference is invalid if price cleanly accepts beyond it.",
          zones
        } : {state:"NONE",event:"NONE",confidence:"LOW",evidence:"No repeated swing reference was strong enough on-device.",confirmation:"",invalidation:"",zones:[]};

        resolve({levels,patterns,liquidity,candleCount:candles.length,plotBounds});
      } catch {
        resolve({ levels: [], patterns: [], liquidity: { state:"NONE",event:"NONE",confidence:"LOW",evidence:"",confirmation:"",invalidation:"",zones:[] }, candleCount: 0, plotBounds: { left: 4, top: 12, right: 91, bottom: 88 } });
      }
    };
    source.onerror=()=>resolve({ levels: [], patterns: [], liquidity: { state:"NONE",event:"NONE",confidence:"LOW",evidence:"",confirmation:"",invalidation:"",zones:[] }, candleCount: 0, plotBounds: { left: 4, top: 12, right: 91, bottom: 88 } });
    source.src=dataUrl;
  });
}

function withinPlot(y: number, bounds: PlotBounds, pad = 1.5) {
  return Number.isFinite(y) && y >= bounds.top - pad && y <= bounds.bottom + pad;
}

function mergeOverlayLevels(ai: Level[], local: Level[], bounds: PlotBounds) {
  const safeAi = ai.filter(level => ["support","resistance","pivot"].includes(level.kind) && withinPlot(level.y, bounds));
  const merged = local.map(level => {
    const match = safeAi.find(candidate =>
      Math.abs(candidate.y - level.y) <= 4 &&
      (candidate.kind === level.kind || candidate.kind === "pivot")
    );
    return match ? { ...level, label: match.label || level.label, price: match.price || level.price } : level;
  });
  for (const level of safeAi) {
    if (!merged.some(existing => Math.abs(existing.y - level.y) <= 3)) merged.push(level);
  }
  return merged.sort((a,b)=>a.y-b.y).slice(0,6);
}

function mergeOverlayPatterns(ai: Pattern[], local: Pattern[], bounds: PlotBounds) {
  const safeAi = ai.filter(pattern => {
    const points = pattern.geometry?.points ?? [];
    return points.length >= 2 && points.every(point =>
      point.x >= bounds.left - 2 && point.x <= bounds.right + 2 && withinPlot(point.y, bounds, 2)
    );
  });
  const merged = [...safeAi];
  for (const pattern of local) {
    if (!merged.some(existing => existing.name === pattern.name)) merged.push(pattern);
  }
  return merged.slice(0,4);
}

function mergeOverlayLiquidity(ai: LiquidityRead | undefined, local: LiquidityRead | undefined, bounds: PlotBounds): LiquidityRead | undefined {
  const safeAiZones = (ai?.zones ?? []).filter(zone =>
    withinPlot(zone.y, bounds) &&
    Number.isFinite(zone.x) && Number.isFinite(zone.x2) &&
    zone.x2 - zone.x >= 3
  );
  const localZones = (local?.zones ?? []).filter(zone =>
    withinPlot(zone.y, bounds) &&
    Number.isFinite(zone.x) && Number.isFinite(zone.x2) &&
    zone.x2 - zone.x >= 3
  );
  const zones = [...safeAiZones];
  for (const zone of localZones) {
    if (!zones.some(existing => existing.side === zone.side && Math.abs(existing.y - zone.y) <= 3)) zones.push(zone);
  }
  if (!zones.length) return ai ?? local;
  const narrative = safeAiZones.length ? ai : local;
  return {
    state: narrative?.state === "VERIFIED" ? "VERIFIED" : "PARTIAL",
    event: narrative?.event ?? "TESTING",
    confidence: narrative?.confidence ?? "LOW",
    evidence: narrative?.evidence || "Device geometry marked visible swing references.",
    confirmation: narrative?.confirmation || "A visible sweep, reclaim or rejection is still required.",
    invalidation: narrative?.invalidation || "Clean acceptance beyond the reference invalidates it.",
    zones: zones.slice(0,4),
  };
}

function buildLocalAnalysis(scan: LocalScan): Analysis {
  return {
    direction:"NEUTRAL",confidence:"LOW",instrument:"DEVICE SCAN",ticker:"UNKNOWN",timeframe:"UNCONFIRMED",
    evidenceQuality:{chartReadability:scan.candleCount>=12?"PARTIAL":"POOR",instrumentConfidence:"UNKNOWN",timeframeConfidence:"UNKNOWN",scaleReadable:false,candlesReadable:scan.candleCount>=8,limitations:["Device zero-credit geometry only. Numeric prices and instrument labels are not verified."]},
    higherTimeframe:{provided:false,timeframe:"UNKNOWN",direction:"UNKNOWN",alignment:"NOT_PROVIDED",summary:"AI multi-timeframe narrative has not been run for this chart."},
    patterns:scan.patterns,liquidity:scan.liquidity,
    nextSequence:{now:"ZERO-CREDIT DEVICE SCAN READY",confirmation:"Use the visible chart reaction to confirm.",failure:"Ignore a device mark that does not match visible price structure.",patience:"AI enrichment is optional.",reassess:"Re-check after the chart materially changes."},
    summary:"Zero-credit device geometry is ready. This view has not used an OpenAI analysis call.",
    verdict:"REVIEW_REQUIRED",verdictHeadline:"Device geometry ready — AI judgement not run.",setupScore:{overall:0,grade:"F",structure:0,momentum:0,location:0,confirmation:0,riskClarity:0,eventSafety:0},
    whatYouMayBeMissing:["Local scanning can find screenshot geometry but cannot reliably read every price label or market context."],
    improvesSetup:[],killsSetup:[],traderTrap:"Treating a locally detected row as a trading signal instead of a chart reference.",
    bullishCase:"Not assessed on-device.",bearishCase:"Not assessed on-device.",invalidation:"Not assessed on-device.",
    marketStructure:"Device mode isolates visible swing geometry only.",levelStory:scan.levels.length?"Local support/resistance rows were detected from repeated or prominent swing geometry.":"No strong device level row was detected.",
    momentum:"Not assessed on-device.",bullConfirmation:"Not assessed on-device.",bearConfirmation:"Not assessed on-device.",noTradeCondition:"No AI decision has been run for this chart.",
    riskFlags:["Device geometry is provisional until visually confirmed."],observableFacts:[],contradictions:[],indicators:[],checklist:[],relevantEventTypes:[],levels:scan.levels,plotBounds:scan.plotBounds
  };
}

function demoChart() {
  const candles = Array.from({ length: 42 }, (_, i) => {
    const x = 72 + i * 27;
    const center = 360 - i * 4 + Math.sin(i * .9) * 48;
    const open = center + Math.sin(i * 1.7) * 18;
    const close = center + Math.cos(i * 1.3) * 17;
    const high = Math.min(open, close) - 25 - (i % 4) * 4;
    const low = Math.max(open, close) + 27 + (i % 3) * 5;
    const up = close < open;
    return '<line x1="'+x+'" x2="'+x+'" y1="'+high+'" y2="'+low+'" stroke="'+(up?"#6cae8a":"#b96f69")+'" stroke-width="2"/><rect x="'+(x-6)+'" y="'+Math.min(open,close)+'" width="12" height="'+Math.max(8,Math.abs(close-open))+'" fill="'+(up?"#6cae8a":"#b96f69")+'"/>';
  }).join("");
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720"><rect width="1280" height="720" fill="#111722"/><g stroke="#263140" stroke-width="1">'+
    [120,220,320,420,520,620].map(y=>'<line x1="48" x2="1230" y1="'+y+'" y2="'+y+'"/>').join("")+
    '</g>'+candles+'<text x="50" y="54" fill="#d8e0e8" font-family="Arial" font-size="22">US 500 · 15m · Interface demo</text><text x="50" y="682" fill="#718094" font-family="Arial" font-size="15">Synthetic chart — no market data</text></svg>';
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
}

const DEMO_ANALYSIS: Analysis = {
  direction: "NEUTRAL", confidence: "MEDIUM", instrument: "US 500", ticker: "SPX", timeframe: "15m", currentPrice: "7721",
  evidenceQuality: { chartReadability: "CLEAR", instrumentConfidence: "HIGH", timeframeConfidence: "HIGH", scaleReadable: true, candlesReadable: true, limitations: [] },
  higherTimeframe: { provided: true, timeframe: "1h", direction: "BULLISH", alignment: "MIXED", summary: "The 1h structure is constructive, but the 15m is pressing into nearby resistance." },
  patterns: [{ name: "RECTANGLE / RANGE", status: "FORMING", confidence: "MEDIUM", evidence: "Price is rotating between repeated upper and lower references.", confirmation: "Acceptance above the upper boundary.", invalidation: "Clean break below the lower boundary.", geometry: { points: [{x:18,y:34},{x:82,y:34},{x:82,y:68},{x:18,y:68}], labelX: 72, labelY: 27 } }],
  liquidity: { state: "PARTIAL", event: "TESTING", confidence: "MEDIUM", evidence: "Repeated highs form a visible buy-side reference, but no completed sweep is confirmed.", confirmation: "Trade beyond the highs followed by a return beneath them.", invalidation: "Clean acceptance above the highs.", zones: [{ side: "BUY_SIDE", basis: "EQUAL_HIGHS", price: "7740", x: 38, x2: 83, y: 31 }] },
  nextSequence: { now: "WAIT", confirmation: "Acceptance above 7740 with structure holding.", failure: "Loss of 7700 support.", patience: "Do not chase inside the range.", reassess: "After the next decisive break or rejection." },
  summary: "Price is holding constructively, but the immediate location is poor beneath resistance.",
  verdict: "WAIT", verdictHeadline: "Strength is visible. Confirmation is not.", setupScore: { overall: 61, grade: "C", structure: 7, momentum: 6, location: 4, confirmation: 4, riskClarity: 7, eventSafety: 8 },
  whatYouMayBeMissing: ["The higher-timeframe tone is constructive, but the current entry location is still underneath a repeated resistance reference."],
  improvesSetup: ["Acceptance above resistance", "Higher low holds after breakout"], killsSetup: ["Loss of 7700", "Failed breakout back into range"], traderTrap: "Chasing the top of a range because momentum feels strong.",
  bullishCase: "Break and acceptance above 7740 opens room for continuation.", bearishCase: "Failure at 7740 followed by loss of 7700 turns the range into rejection.", invalidation: "Sustained trade below 7700.",
  marketStructure: "Short-term higher lows are intact, but price remains inside a defined range.", levelStory: "7700 is the primary support reference; 7740 is the immediate resistance ceiling.", momentum: "Positive but not decisive.",
  bullConfirmation: "Acceptance above 7740.", bearConfirmation: "Loss of 7700.", noTradeCondition: "Remain inside the 7700–7740 range without confirmation.", riskFlags: ["Entry location is close to resistance", "Range breakout is not confirmed"],
  observableFacts: ["Higher lows are visible", "Repeated highs remain overhead"], contradictions: ["Momentum is positive while location remains poor"], indicators: [], checklist: [], relevantEventTypes: ["FOMC", "CPI"],
  levels: [
    { kind: "resistance", label: "Range high", price: "7740", x: 12, y: 31, x2: 92, y2: 31 },
    { kind: "pivot", label: "Midpoint", price: "7720", x: 18, y: 49, x2: 87, y2: 49 },
    { kind: "support", label: "Range support", price: "7700", x: 10, y: 68, x2: 94, y2: 68 },
  ],
};

function statusOf(analysis: Analysis, kind: "levels" | "patterns" | "liquidity" | "htf") {
  if (kind === "levels") return analysis.levels.some((l) => ["support","resistance","pivot"].includes(l.kind) && /^-?\d/.test(l.price)) ? "VERIFIED" : analysis.levels.length ? "PARTIAL" : "NONE";
  if (kind === "patterns") return analysis.patterns.some((p) => p.confidence !== "LOW" && p.status !== "AMBIGUOUS") ? "VERIFIED" : analysis.patterns.length ? "PARTIAL" : "NONE";
  if (kind === "liquidity") return analysis.liquidity?.state ?? "NONE";
  return analysis.higherTimeframe.provided ? "VERIFIED" : "NONE";
}

function statusLabel(value: string) { return value === "NONE" ? "NO EVIDENCE" : value; }

export default function PocketNext() {
  const [charts, setCharts] = useState<ChartSlot[]>(emptyChartSlots);
  const [activeChart, setActiveChart] = useState(0);
  const [intention, setIntention] = useState<Intention>("UNSURE");
  const [privacy, setPrivacy] = useState(false);
  const [active, setActive] = useState<Tab>("overview");
  const [busyChart, setBusyChart] = useState<number | null>(null);
  const [chartFocus, setChartFocus] = useState(false);
  const [error, setError] = useState("");
  const requestActive = useRef(false);
  const centreRef = useRef<HTMLElement | null>(null);

  const mainAnalysis = charts[0]?.analysis ?? null;
  const activeSlot = charts[activeChart];
  const analysis = activeSlot?.analysis
    ?? (activeSlot?.localScan ? buildLocalAnalysis(activeSlot.localScan) : null)
    ?? mainAnalysis;
  const image = activeSlot?.image ?? charts[0]?.image ?? null;
  const busy = busyChart !== null;

  useEffect(() => {
    if (!chartFocus) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setChartFocus(false); };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [chartFocus]);

  const selectTab = (tab: Tab) => {
    setActive(tab);
    if (typeof window !== "undefined" && window.matchMedia("(max-width: 760px)").matches) {
      window.requestAnimationFrame(() => centreRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    }
  };

  const loadChart = async (index: number, file?: File) => {
    if (!file) return;
    try {
      setError("");
      const nextImage = await fileToDataUrl(file);
      setCharts((current) => current.map((slot, slotIndex) => slotIndex === index
        ? { image: nextImage, name: file.name, analysis: null, localScan: null }
        : slot));
      if (index === 0) setActiveChart(0);
      const localScan = await scanChartLocally(nextImage);
      setCharts((current) => current.map((slot, slotIndex) => slotIndex === index && slot.image === nextImage
        ? { ...slot, localScan }
        : slot));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load that chart.");
    }
  };

  const analyseChart = async (index: number, switchAfter = false) => {
    const slot = charts[index];
    if (!slot?.image || !privacy || busy || requestActive.current) return;
    requestActive.current = true;
    setBusyChart(index);
    setError("");
    try {
      const precisionImage = await precisionCrop(slot.image);
      const response = await fetch("/api/pocket/analyse", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ image: slot.image, precisionImage, intention }),
      });
      const payload = await response.json() as { analysis?: Analysis; error?: string };
      if (!response.ok || !payload.analysis) throw new Error(payload.error || "Analysis could not complete.");
      setCharts((current) => current.map((chart, chartIndex) => chartIndex === index
        ? { ...chart, analysis: payload.analysis ?? null }
        : chart));
      if (switchAfter) setActiveChart(index);
      if (index === 0) setActive("overview");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analysis could not complete.");
    } finally {
      requestActive.current = false;
      setBusyChart(null);
    }
  };

  const run = async () => { await analyseChart(0, false); };

  const selectChart = async (index: number) => {
    const slot = charts[index];
    if (!slot?.image || index === activeChart) return;
    setActiveChart(index);
  };

  const openDemo = () => {
    const demo = emptyChartSlots();
    demo[0] = { image: demoChart(), name: "Interface demo", analysis: DEMO_ANALYSIS, localScan: null };
    setCharts(demo);
    setActiveChart(0);
    setActive("overview");
    setPrivacy(true);
  };
  const reset = () => {
    setCharts(emptyChartSlots());
    setActiveChart(0);
    setActive("overview");
    setChartFocus(false);
    setError("");
  };
  const share = async () => {
    if (!analysis) return;
    const text = "Pocket Bullseye · " + analysis.instrument + " · " + analysis.timeframe + "\n" + analysis.verdict + " · " + analysis.setupScore.overall + "/100\n" + analysis.verdictHeadline;
    try { if (navigator.share) await navigator.share({ title: "Pocket Bullseye", text }); else await navigator.clipboard?.writeText(text); } catch {}
  };

  const overlayMode = active;
  const activeLocal = activeSlot?.localScan;
  const plotBounds: PlotBounds = activeLocal?.plotBounds
    ?? analysis?.plotBounds
    ?? { left: 4, top: 12, right: 91, bottom: 88 };
  const levels = useMemo(() => mergeOverlayLevels(
    analysis?.levels.filter((l) => ["support","resistance","pivot"].includes(l.kind)) ?? [],
    activeLocal?.levels ?? [],
    plotBounds,
  ), [analysis, activeLocal, plotBounds.left, plotBounds.top, plotBounds.right, plotBounds.bottom]);
  const patterns = mergeOverlayPatterns(analysis?.patterns ?? [], activeLocal?.patterns ?? [], plotBounds);
  const liquidity = mergeOverlayLiquidity(analysis?.liquidity, activeLocal?.liquidity, plotBounds);

  if (!mainAnalysis || !analysis) return <main className="pnApp pnStartApp">
    <header className="pnTop">
      <div className="pnBrand"><span className="pnMark">PB</span><div><strong>POCKET BULLSEYE</strong><small>Decision intelligence</small></div></div>
      <div className="pnEngine"><i/> ANALYSIS ENGINE ONLINE</div>
    </header>

    <section className="pnStart">
      <article className="pnIntro">
        <p>PRE-TRADE DECISION WORKSPACE</p>
        <h1>A second opinion.<br/><em>Not another signal.</em></h1>
        <span>Upload the chart you are actually looking at. Pocket separates visible evidence from assumptions, then shows what confirms the idea, what weakens it and when doing nothing is the better decision.</span>
        <div className="pnPrinciples">
          <div><b>01</b><strong>VERIFY</strong><small>Evidence before precision</small></div>
          <div><b>02</b><strong>CHALLENGE</strong><small>Bias gets tested</small></div>
          <div><b>03</b><strong>DECIDE</strong><small>Wait is a valid answer</small></div>
        </div>
      </article>

      <aside className="pnIntake">
        <div className="pnIntakeHead"><span>NEW ANALYSIS</span><small>PRIMARY CHART REQUIRED</small></div>
        <label className="pnDrop" data-loaded={charts[0].image ? "true" : "false"}>
          {charts[0].image ? <img src={charts[0].image} alt="Selected main chart"/> : <div><b>+</b><strong>Add main chart</strong><span>JPEG · PNG · WEBP · max 8 MB</span></div>}
          <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e)=>loadChart(0,e.target.files?.[0])}/>
          {charts[0].image ? <footer><strong>{charts[0].name}</strong><span>Tap to replace</span></footer> : null}
        </label>

        <div className="pnStartChartRail" aria-label="Optional charts">
          <span>EXTRA CHARTS</span>
          <div>
            {charts.slice(1).map((slot, offset)=><label key={offset} className="pnStartSlot" data-loaded={Boolean(slot.image)}>
              <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e)=>loadChart(offset+1,e.target.files?.[0])}/>
              <b>{offset+2}</b><small>{slot.image ? "READY" : "+"}</small>
            </label>)}
          </div>
        </div>

        <div className="pnBias">
          <small>BIAS TO CHALLENGE</small>
          <div>{(["LONG","UNSURE","SHORT"] as Intention[]).map(v=><button key={v} type="button" data-active={intention===v} onClick={()=>setIntention(v)}>{v==="UNSURE"?"NO BIAS":v}</button>)}</div>
        </div>

        <label className="pnPrivacy"><input type="checkbox" checked={privacy} onChange={(e)=>setPrivacy(e.target.checked)}/><span><strong>Privacy check</strong>I removed account number, balance and personal notifications.</span></label>

        {error ? <p className="pnError">{error}</p> : null}
        <button className="pnRun" type="button" disabled={!charts[0].image || !privacy || busy} onClick={run}><span>{busyChart===0 ? "ANALYSING…" : "RUN ANALYSIS"}</span><b>→</b></button>
        <button className="pnDemo" type="button" onClick={openDemo}>OPEN NO-CREDIT INTERFACE DEMO</button>
      </aside>
    </section>
  </main>;

  const stateTone = analysis.direction === "BULLISH" ? "bull" : analysis.direction === "BEARISH" ? "bear" : "wait";

  return <main className="pnApp pnResultApp" data-tone={stateTone}>
    <header className="pnTop pnResultTop">
      <div className="pnBrand"><span className="pnMark">PB</span><div><strong>POCKET BULLSEYE</strong><small>{analysis.instrument} · {analysis.timeframe}</small></div></div>
      <div className="pnTopActions"><button type="button" onClick={share}>SHARE</button><button type="button" onClick={reset}>NEW ANALYSIS</button></div>
    </header>

    <section className="pnWorkspace">
      <nav className="pnTools" aria-label="Analysis views">
        {TABS.map(tab=><button key={tab.id} type="button" data-active={active===tab.id} onClick={()=>selectTab(tab.id)}><b>{tab.short}</b><span>{tab.label}</span></button>)}
      </nav>

      <section className="pnCentre" ref={centreRef}>
        <header className="pnChartHeader">
          <div><small>ACTIVE VIEW</small><strong>{TABS.find(t=>t.id===active)?.label}</strong></div>
          <div className="pnQuality">
            <span data-state={analysis.evidenceQuality.chartReadability==="CLEAR"?"VERIFIED":"PARTIAL"}>CHART {analysis.evidenceQuality.chartReadability}</span>
            <span data-state={statusOf(analysis,"levels")}>LEVELS {statusLabel(statusOf(analysis,"levels"))}</span>
            <span data-state={statusOf(analysis,"patterns")}>PATTERN {statusLabel(statusOf(analysis,"patterns"))}</span>
            <span data-state={statusOf(analysis,"liquidity")}>LIQUIDITY {statusLabel(statusOf(analysis,"liquidity"))}</span>
          </div>
        </header>

        <div className="pnMobileDecision" aria-label="Decision snapshot">
          <span>{analysis.verdict.replaceAll("_"," ")}</span>
          <strong>{analysis.setupScore.overall}<small>/100 · {analysis.setupScore.grade}</small></strong>
          <b>{analysis.instrument} · {analysis.timeframe}</b>
        </div>

        <div className="pnChartSwitcher" aria-label="Chart selector">
          {charts.map((slot,index)=>slot.image ? <button
            key={index}
            type="button"
            data-active={activeChart===index}
            data-busy={busyChart===index}
            onClick={()=>void selectChart(index)}
            disabled={busy && busyChart!==index}
          ><span>{index===0 ? "MAIN" : "C"+(index+1)}</span><strong>{busyChart===index ? "AI…" : slot.analysis?.timeframe && slot.analysis.timeframe!=="UNKNOWN" ? slot.analysis.timeframe : slot.analysis ? "READY" : slot.localScan ? "DEVICE" : "SCAN…"}</strong></button> : <label key={index} className="pnChartAdd">
            <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e)=>loadChart(index,e.target.files?.[0])}/>
            <span>{index===0 ? "MAIN" : "C"+(index+1)}</span><strong>+</strong>
          </label>)}
        </div>

        <div className="pnChart" data-focus={chartFocus ? "true" : "false"}>
          <img src={image ?? ""} alt="Analysed trading chart"/>
          <button className="pnFocusButton" type="button" onClick={()=>setChartFocus(v=>!v)} aria-pressed={chartFocus}>{chartFocus ? "CLOSE" : "FOCUS"}</button>
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-label="Pocket evidence overlay">
            <defs>
              <clipPath id="pnPlotClip">
                <rect x={plotBounds.left} y={plotBounds.top} width={Math.max(1,plotBounds.right-plotBounds.left)} height={Math.max(1,plotBounds.bottom-plotBounds.top)}/>
              </clipPath>
            </defs>
            <g clipPath="url(#pnPlotClip)">
              {(overlayMode==="overview"||overlayMode==="levels") ? levels.map((level,i)=><g key={"l"+i} data-kind={level.kind}><line x1={clamp(level.x || plotBounds.left)} x2={clamp(level.x2 || plotBounds.right)} y1={clamp(level.y)} y2={clamp(level.y2 || level.y)}/><circle cx={clamp(level.x || plotBounds.left)} cy={clamp(level.y)} r=".8"/></g>) : null}
              {overlayMode==="patterns" ? patterns.flatMap((p,pi)=>p.geometry?.points?.length ? [<polyline key={"p"+pi} points={p.geometry.points.map(pt=>clamp(pt.x)+","+clamp(pt.y)).join(" ")} data-pattern={p.status}/>] : []) : null}
              {overlayMode==="liquidity" ? (liquidity?.zones ?? []).map((z,i)=><g key={"q"+i} data-side={z.side}><line x1={clamp(z.x)} x2={clamp(z.x2)} y1={clamp(z.y)} y2={clamp(z.y)}/></g>) : null}
            </g>
          </svg>
          {overlayMode==="levels" ? <div className="pnLevelLabels">{levels.slice(0,5).filter(l=>withinPlot(l.y,plotBounds)).map((l,i)=><span key={i} data-kind={l.kind} style={{top:clamp(l.y)+"%"}}><small>{l.kind.toUpperCase()}</small><b>{l.price || l.label}</b></span>)}</div> : null}
          {overlayMode==="liquidity" ? <div className="pnLevelLabels">{(liquidity?.zones ?? []).filter(z=>withinPlot(z.y,plotBounds)).map((z,i)=><span key={i} data-kind={z.side==="BUY_SIDE"?"resistance":"support"} style={{top:clamp(z.y)+"%"}}><small>{z.side.replace("_"," ")}</small><b>{z.price || z.basis.replaceAll("_"," ")}</b></span>)}</div> : null}
        </div>

        <footer className="pnChartFoot">
          <span>SOURCE IMAGE PRESERVED</span>
          <span>{active==="levels" ? analysis.levelStory : active==="structure" ? analysis.marketStructure : active==="patterns" ? (patterns[0]?.evidence || "No defensible pattern is currently verified.") : active==="liquidity" ? (liquidity?.evidence || "No defensible liquidity event is currently verified.") : "Select a scanner to isolate its evidence on the chart."}</span>
        </footer>
      </section>

      <aside className="pnDecision">
        {active==="overview" ? <>
          <div className="pnDecisionLabel">DECISION SUMMARY</div>
          <div className="pnVerdict"><span>{analysis.verdict.replaceAll("_"," ")}</span><b>{analysis.setupScore.overall}</b><small>/100 · GRADE {analysis.setupScore.grade}</small></div>
          <h2>{analysis.verdictHeadline}</h2>
          <p>{analysis.summary}</p>
          <div className="pnTriptych"><article><small>NOW</small><strong>{analysis.nextSequence.now}</strong></article><article><small>CONFIRMS</small><strong>{analysis.nextSequence.confirmation}</strong></article><article><small>FAILS</small><strong>{analysis.nextSequence.failure}</strong></article></div>
          <section className="pnMiss"><small>STRONGEST COUNTER-EVIDENCE</small><strong>{analysis.whatYouMayBeMissing[0] || analysis.contradictions[0] || "No strong contradiction was returned."}</strong></section>
        </> : null}

        {active==="levels" ? <>
          <div className="pnDecisionLabel">VERIFIED PRICE REFERENCES</div>
          <h2>{levels.length ? levels.length+" structural levels" : "Precision held"}</h2>
          <p>{analysis.levelStory}</p>
          <div className="pnRows">{levels.length ? levels.map((l,i)=><article key={i}><span>{l.kind.toUpperCase()}</span><strong>{l.price || "NO NUMERIC PRICE"}</strong><small>{l.label}</small></article>) : <article><span>NO VERIFIED LEVEL</span><strong>—</strong><small>Pocket withheld numeric precision.</small></article>}</div>
        </> : null}

        {active==="structure" ? <>
          <div className="pnDecisionLabel">MARKET STRUCTURE</div>
          <h2>{analysis.direction} · {analysis.confidence}</h2>
          <p>{analysis.marketStructure}</p>
          <div className="pnRows"><article><span>MOMENTUM</span><strong>{analysis.momentum}</strong></article><article><span>HIGHER TIMEFRAME</span><strong>{analysis.higherTimeframe.alignment}</strong><small>{analysis.higherTimeframe.summary}</small></article><article><span>BULL CASE</span><strong>{analysis.bullishCase}</strong></article><article><span>BEAR CASE</span><strong>{analysis.bearishCase}</strong></article></div>
        </> : null}

        {active==="patterns" ? <>
          <div className="pnDecisionLabel">PATTERN REVIEW</div>
          <h2>{patterns.length ? patterns.length+" defensible read"+(patterns.length===1?"":"s") : "No clean pattern"}</h2>
          <p>Pocket only keeps named structures that survive the geometry check.</p>
          <div className="pnRows">{patterns.length ? patterns.map((p,i)=><article key={i}><span>{p.status} · {p.confidence ?? "LOW"}</span><strong>{p.name}</strong><small>{p.evidence}</small></article>) : <article><span>NO EVIDENCE</span><strong>Nothing forced.</strong><small>A wider or clearer chart may add evidence.</small></article>}</div>
        </> : null}

        {active==="liquidity" ? <>
          <div className="pnDecisionLabel">LIQUIDITY GUARD</div>
          <h2>{liquidity?.state==="VERIFIED" ? liquidity.event : liquidity?.state==="PARTIAL" ? "Partial evidence" : "No verified event"}</h2>
          <p>{liquidity?.evidence || "Pocket does not infer hidden orders or stop placement from ordinary price noise."}</p>
          <div className="pnRows"><article><span>STATE</span><strong>{liquidity?.state ?? "NONE"}</strong><small>{liquidity?.confidence ?? "LOW"} confidence</small></article><article><span>CONFIRMS</span><strong>{liquidity?.confirmation || "No defensible trigger."}</strong></article><article><span>INVALIDATES</span><strong>{liquidity?.invalidation || "No defensible invalidation."}</strong></article></div>
        </> : null}

        {active==="risk" ? <>
          <div className="pnDecisionLabel">RISK & DISCIPLINE</div>
          <h2>{analysis.riskFlags.length ? analysis.riskFlags.length+" active risk flag"+(analysis.riskFlags.length===1?"":"s") : "No major flag returned"}</h2>
          <p>{analysis.noTradeCondition}</p>
          <div className="pnRows">{analysis.riskFlags.map((r,i)=><article key={i}><span>RISK {String(i+1).padStart(2,"0")}</span><strong>{r}</strong></article>)}<article><span>INVALIDATION</span><strong>{analysis.invalidation}</strong></article><article><span>TRADER TRAP</span><strong>{analysis.traderTrap}</strong></article></div>
        </> : null}
      </aside>
    </section>
  </main>;
}
