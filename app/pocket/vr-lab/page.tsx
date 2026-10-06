"use client";

import { useState } from "react";
import PocketVrSimulationRealism from "../PocketVrSimulationRealism";
import "../pocket-vr-simulation.css";
import "../pocket-vr-realism.css";

const chartSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="820" viewBox="0 0 1400 820"><rect width="1400" height="820" fill="#0b1117"/><g stroke="#26323d" stroke-width="1"><line x1="100" x2="100" y1="30" y2="760"/><line x1="300" x2="300" y1="30" y2="760"/><line x1="500" x2="500" y1="30" y2="760"/><line x1="700" x2="700" y1="30" y2="760"/><line x1="900" x2="900" y1="30" y2="760"/><line x1="1100" x2="1100" y1="30" y2="760"/><line x1="1300" x2="1300" y1="30" y2="760"/><line x1="40" x2="1360" y1="140" y2="140"/><line x1="40" x2="1360" y1="280" y2="280"/><line x1="40" x2="1360" y1="420" y2="420"/><line x1="40" x2="1360" y1="560" y2="560"/><line x1="40" x2="1360" y1="700" y2="700"/></g><polyline fill="none" stroke="#8fb5c7" stroke-width="5" points="55,610 140,570 220,600 300,515 380,540 470,435 550,460 635,390 720,430 805,330 900,365 980,280 1060,310 1140,235 1230,265 1340,190"/><polyline fill="none" stroke="#60d89a" stroke-width="3" points="55,650 170,620 275,635 395,560 510,575 630,510 760,525 875,455 990,470 1120,395 1340,360"/><text x="55" y="65" fill="#dbe8eb" font-family="Arial" font-size="30" font-weight="700">US 500 · 15m · VR LAB DEMO</text><text x="55" y="105" fill="#728792" font-family="Arial" font-size="20">Synthetic chart for interface testing only</text></svg>';
const chart = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(chartSvg);

const analysis = {
  direction: "NEUTRAL" as const,
  instrument: "US 500",
  timeframe: "15m",
  verdict: "WAIT" as const,
  verdictHeadline: "The setup has strength, but confirmation is incomplete.",
  summary: "Price is holding above support, but nearby resistance and incomplete confirmation keep this in wait territory.",
  marketStructure: "Short-term structure is constructive, but price remains beneath a nearby resistance shelf.",
  levelStory: "Support is holding below price while resistance remains close enough to challenge the setup.",
  whatYouMayBeMissing: ["Higher-timeframe resistance is still overhead and the breakout has not proved acceptance."],
  contradictions: ["Momentum improved, but location remains awkward beneath resistance."],
  riskFlags: ["Breakout confirmation is incomplete."],
  traderTrap: "Chasing strength directly into resistance.",
  bullishCase: "Support holds and price accepts above resistance.",
  bearishCase: "Resistance rejects and price rotates back through the recent higher low.",
  setupScore: { overall: 58, grade: "C" },
  nextSequence: { now: "WAIT", confirmation: "Acceptance above resistance", failure: "Loss of nearby support", reassess: "After the next confirmed move" },
  levels: [
    { kind: "resistance", price: "7750", y: 25 },
    { kind: "resistance", price: "7730", y: 39 },
    { kind: "support", price: "7710", y: 62 },
    { kind: "support", price: "7690", y: 76 }
  ]
};

export default function VrLabPage(){
  const [message,setMessage]=useState("");
  return <>
    <PocketVrSimulationRealism
      analysis={analysis}
      sourceImage={chart}
      viewerName="Nash"
      intention="UNSURE"
      onOpenReport={()=>setMessage("VR Lab: full evidence would open here in the live app.")}
      onShare={()=>setMessage("VR Lab: sharing is disabled in this test scene.")}
    />
    {message?<button type="button" onClick={()=>setMessage("")} style={{position:"fixed",left:12,right:12,bottom:12,zIndex:9999,padding:12,borderRadius:12,border:"1px solid #345",background:"#091013",color:"#eaf4f4"}}>{message} · TAP TO CLOSE</button>:null}
  </>;
}
