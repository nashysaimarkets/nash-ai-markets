"use client";

import { useEffect, useMemo, useState } from "react";

type Analysis = {
  direction: "BULLISH" | "BEARISH" | "NEUTRAL";
  instrument: string;
  timeframe: string;
  verdict: "WATCH" | "WAIT" | "STAND_ASIDE" | "REVIEW_REQUIRED";
  verdictHeadline: string;
  summary: string;
  marketStructure: string;
  levelStory: string;
  whatYouMayBeMissing: string[];
  contradictions: string[];
  riskFlags: string[];
  traderTrap: string;
  bullishCase: string;
  bearishCase: string;
  setupScore: { overall: number; grade: string };
  nextSequence: { now: string; confirmation: string; failure: string; reassess: string };
  levels: { kind: string; price: string; y: number }[];
};

type Props = {
  analysis: Analysis;
  sourceImage: string;
  viewerName: string;
  intention: "LONG" | "SHORT" | "UNSURE";
  onOpenReport: (target?: string) => void;
  onShare: () => void;
};

const POV_PLATE = "https://images.unsplash.com/photo-1773158742082-6f26389f7492?auto=format&fit=crop&fm=jpg&ixlib=rb-4.1.0&q=78&w=2200";
const STEPS = ["ROOM", "LAPTOP", "LEVELS", "PHONE", "VERDICT"] as const;

function clampY(y: number) { return Math.max(5, Math.min(95, Number.isFinite(y) ? y : 50)); }
function hasPrice(value: string) { return /^-?\d[\d,.]*$/.test(value.trim()); }

export default function GuidedPovSimulation({ analysis, sourceImage, viewerName, intention, onOpenReport, onShare }: Props) {
  const [step, setStep] = useState(0);
  const [auto, setAuto] = useState(true);

  const levels = useMemo(
    () => analysis.levels.filter((level) => ["support","resistance","pivot"].includes(level.kind) && hasPrice(level.price)).slice(0, 5),
    [analysis.levels]
  );

  const challenge = analysis.whatYouMayBeMissing[0]
    || analysis.contradictions[0]
    || analysis.riskFlags[0]
    || analysis.traderTrap
    || "The setup still needs proof.";

  useEffect(() => {
    if (!auto || step >= STEPS.length - 1) return;
    const delay = step === 0 ? 5200 : step === 2 ? 7000 : 6200;
    const timer = window.setTimeout(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), delay);
    return () => window.clearTimeout(timer);
  }, [step, auto]);

  const jump = (index: number) => { setAuto(false); setStep(Math.max(0, Math.min(index, STEPS.length - 1))); };

  return <section className="povSim" data-step={step} data-direction={analysis.direction}>
    <div className="povWorld">
      <img className="povWorldPlate" src={POV_PLATE} alt="First-person workspace with phone, laptop and coffee" />
      <div className="povWorldGrade" />

      <button className="povHotspot povLaptopHotspot" type="button" onClick={() => jump(1)} aria-label="Look at the laptop">
        <i/><span>LOOK AT CHART</span>
      </button>
      <button className="povHotspot povPhoneHotspot" type="button" onClick={() => jump(3)} aria-label="Look at Pocket Bullseye on the phone">
        <i/><span>CHECK POCKET</span>
      </button>

      <div className="povPresence" aria-hidden="true"><span/><span/></div>

      {step === 0 ? <div className="povBeat povArrival">
        <small>THE MOMENT BEFORE</small>
        <h1>{viewerName ? viewerName + ", " : ""}you've seen the setup.</h1>
        <p>Before money meets market, look again.</p>
        <button type="button" onClick={() => jump(1)}>FOCUS ON THE CHART →</button>
      </div> : null}

      {step === 1 || step === 2 ? <div className="povLaptopView">
        <div className="povLaptopBezel">
          <img src={sourceImage} alt="Uploaded chart displayed on the simulated laptop" />
          <div className="povLaptopReflection" />
          {step === 2 ? <>
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="povLevels" aria-label="Verified support and resistance levels">
              {levels.map((level, index) => <g key={level.kind+level.price+index} data-kind={level.kind}>
                <line x1="3" x2="97" y1={clampY(level.y)} y2={clampY(level.y)} />
                <circle cx="8" cy={clampY(level.y)} r="1.1" />
              </g>)}
            </svg>
            <div className="povLevelTags">{levels.map((level, index) => <span key={level.kind+level.price+index} data-kind={level.kind} style={{ top: clampY(level.y)+"%" }}><small>{level.kind.toUpperCase()}</small><b>{level.price}</b></span>)}</div>
          </> : null}
        </div>

        <div className="povWhisper">
          <small>{step === 1 ? "POCKET · STRUCTURE" : "POCKET · VERIFIED LEVELS"}</small>
          <strong>{step === 1 ? "What is price actually doing?" : levels.length ? "These are the levels Pocket can justify." : "No fake precision."}</strong>
          <p>{step === 1 ? analysis.marketStructure : analysis.levelStory}</p>
          <button type="button" onClick={() => jump(step === 1 ? 2 : 3)}>{step === 1 ? "SHOW LEVELS" : "WHAT DID I MISS?"} →</button>
        </div>
      </div> : null}

      {step === 3 ? <div className="povPhoneView">
        <div className="povPhoneHand" aria-hidden="true" />
        <div className="povPhoneDevice">
          <div className="povPhoneScreen">
            <small>POCKET BULLSEYE</small>
            <span>WHAT DID I MISS?</span>
            <h2>{challenge}</h2>
            <div className="povCaseGrid">
              <section data-side="bull"><small>BULL CASE</small><p>{analysis.bullishCase}</p></section>
              <section data-side="bear"><small>BEAR CASE</small><p>{analysis.bearishCase}</p></section>
            </div>
            <button type="button" onClick={() => jump(4)}>SHOW VERDICT</button>
          </div>
        </div>
      </div> : null}

      {step === 4 ? <div className="povVerdict">
        <div className="povVerdictPhone">
          <small>POCKET BULLSEYE</small>
          <h1>{analysis.verdict.replaceAll("_"," ")}</h1>
          <h2>{analysis.verdictHeadline}</h2>
          <p>{analysis.summary}</p>
          <div><span><small>READ</small><b>{analysis.direction}</b></span><span><small>GRADE</small><b>{analysis.setupScore.grade}</b></span><span><small>SCORE</small><b>{analysis.setupScore.overall}/100</b></span></div>
          <button type="button" onClick={() => onOpenReport()}>OPEN FULL EVIDENCE</button>
          <button type="button" onClick={onShare}>SHARE RESULT</button>
        </div>
      </div> : null}
    </div>

    <header className="povHud">
      <div><span>POCKET POV</span><small>{analysis.instrument} · {analysis.timeframe} · {intention === "UNSURE" ? "OPEN READ" : intention}</small></div>
      <button type="button" onClick={() => setAuto((v) => !v)}>{auto ? "PAUSE" : "PLAY"}</button>
    </header>

    <nav className="povRail" aria-label="Guided POV chapters">
      {STEPS.map((name,index) => <button type="button" key={name} data-active={step===index} data-complete={index<step} onClick={() => jump(index)}><i/><span>{name}</span></button>)}
    </nav>
    <footer className="povLegal">SIMULATED ENVIRONMENT · REAL POCKET ANALYSIS · NOT A TRADE INSTRUCTION</footer>
  </section>;
}
