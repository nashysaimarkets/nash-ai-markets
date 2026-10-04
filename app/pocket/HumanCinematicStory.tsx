"use client";

import { useEffect, useMemo, useState } from "react";

type Direction = "BULLISH" | "BEARISH" | "NEUTRAL";
type Verdict = "WATCH" | "WAIT" | "STAND_ASIDE" | "REVIEW_REQUIRED";
type Analysis = {
  direction: Direction;
  instrument: string;
  timeframe: string;
  currentPrice?: string;
  verdict: Verdict;
  verdictHeadline: string;
  summary: string;
  marketStructure: string;
  momentum: string;
  levelStory: string;
  bullishCase: string;
  bearishCase: string;
  noTradeCondition: string;
  traderTrap: string;
  contradictions: string[];
  riskFlags: string[];
  whatYouMayBeMissing: string[];
  setupScore: { overall: number; grade: string };
  nextSequence: { now: string; confirmation: string; failure: string; reassess: string };
  levels: { kind: string; price: string }[];
};

type Props = {
  analysis: Analysis;
  sourceImage: string;
  viewerName: string;
  intention: "LONG" | "SHORT" | "UNSURE";
  onOpenReport: (target?: string) => void;
  onShare: () => void;
};

const CHAPTERS = ["THE MOMENT", "STRUCTURE", "LEVELS", "CHALLENGE", "RISK", "VERDICT"] as const;

function numericPrice(value: string) {
  const cleaned = value.replace(/[^0-9.-]/g, "");
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

export default function HumanCinematicStory({ analysis, sourceImage, viewerName, intention, onOpenReport, onShare }: Props) {
  const [scene, setScene] = useState(0);
  const [paused, setPaused] = useState(false);

  const levels = useMemo(() => analysis.levels
    .filter((level) => ["support", "resistance", "pivot"].includes(level.kind) && numericPrice(level.price) !== null)
    .slice(0, 4), [analysis.levels]);

  const counterEvidence = analysis.whatYouMayBeMissing[0]
    || analysis.contradictions[0]
    || analysis.riskFlags[0]
    || analysis.traderTrap
    || "The chart still needs confirmation before conviction.";

  useEffect(() => {
    if (paused) return;
    const timer = window.setTimeout(() => setScene((current) => Math.min(current + 1, CHAPTERS.length - 1)), scene === 0 ? 5200 : 6200);
    return () => window.clearTimeout(timer);
  }, [scene, paused]);

  const tone = analysis.direction === "BULLISH" ? "bull" : analysis.direction === "BEARISH" ? "bear" : "wait";
  const next = () => setScene((current) => Math.min(current + 1, CHAPTERS.length - 1));
  const previous = () => setScene((current) => Math.max(current - 1, 0));

  return <section className="pbFilm" data-scene={scene} data-tone={tone}>
    <div className="pbRoom" aria-hidden="true">
      <div className="pbWindow"><i/><i/><i/></div>
      <div className="pbDesk"/>
      <div className="pbCoffee"><i/></div>
      <div className="pbHuman"><span className="pbHead"/><span className="pbShoulder"/><span className="pbHand"/></div>
      <div className="pbLaptop">
        <div className="pbLaptopScreen"><img src={sourceImage} alt=""/><div className="pbScreenShade"/></div>
        <div className="pbLaptopBase"/>
      </div>
      <div className="pbPhone"><div><span>POCKET BULLSEYE</span><strong>{analysis.verdict.replaceAll("_", " ")}</strong><small>{analysis.instrument} · {analysis.timeframe}</small></div></div>
      <div className="pbPracticalLight"/>
    </div>

    <header className="pbFilmTop">
      <div><span>POCKET BULLSEYE · CINEMATIC MODE</span><small>{viewerName ? viewerName.toUpperCase() + " · " : ""}{intention === "UNSURE" ? "OPEN-MINDED READ" : intention + " IDEA CHALLENGED"}</small></div>
      <button type="button" onClick={() => setPaused((value) => !value)}>{paused ? "▶ PLAY" : "Ⅱ PAUSE"}</button>
    </header>

    <nav className="pbFilmTimeline" aria-label="Cinematic analysis chapters">
      {CHAPTERS.map((chapter, index) => <button key={chapter} type="button" data-active={scene === index} data-complete={index < scene} onClick={() => setScene(index)}>
        <i/><span>{String(index + 1).padStart(2, "0")}</span><small>{chapter}</small>
      </button>)}
    </nav>

    <div className="pbFilmOverlay" aria-live="polite">
      {scene === 0 ? <article className="pbScene pbSceneMoment">
        <small>CHAPTER 01 · THE MOMENT BEFORE</small>
        <h1>{analysis.instrument}</h1>
        <p>{analysis.timeframe} chart loaded. Before money meets market, Pocket checks what the eye can miss.</p>
        <div><span>RIGHT NOW</span><strong>{analysis.nextSequence.now}</strong></div>
      </article> : null}

      {scene === 1 ? <article className="pbScene">
        <small>CHAPTER 02 · STRUCTURE</small>
        <h2>What is price actually doing?</h2>
        <p>{analysis.marketStructure}</p>
        <div className="pbEvidencePair"><section><span>MOMENTUM</span><strong>{analysis.momentum}</strong></section><section><span>SETUP</span><strong>{analysis.setupScore.grade} · {analysis.setupScore.overall}/100</strong></section></div>
      </article> : null}

      {scene === 2 ? <article className="pbScene">
        <small>CHAPTER 03 · LEVELS</small>
        <h2>{levels.length ? "The levels Pocket can justify." : "No fake precision."}</h2>
        <div className="pbLevelStrip">{levels.length ? levels.map((level, index) => <span key={level.kind + "-" + level.price + "-" + index} data-kind={level.kind}><small>{level.kind.toUpperCase()}</small><strong>{level.price}</strong></span>) : <span><small>PRECISION HOLD</small><strong>Clearer scale required</strong></span>}</div>
        <p>{analysis.levelStory}</p>
      </article> : null}

      {scene === 3 ? <article className="pbScene pbSceneChallenge">
        <small>CHAPTER 04 · WHAT DID I MISS?</small>
        <h2>The trade looked good. Pocket looked again.</h2>
        <blockquote>{counterEvidence}</blockquote>
        <div className="pbEvidencePair"><section data-side="bull"><span>BULL CASE</span><strong>{analysis.bullishCase}</strong></section><section data-side="bear"><span>BEAR CASE</span><strong>{analysis.bearishCase}</strong></section></div>
      </article> : null}

      {scene === 4 ? <article className="pbScene">
        <small>CHAPTER 05 · RISK</small>
        <h2>What makes this read fail?</h2>
        <div className="pbRiskList">{(analysis.riskFlags.length ? analysis.riskFlags : [analysis.noTradeCondition]).slice(0, 3).map((risk) => <p key={risk}><i>!</i>{risk}</p>)}</div>
        <div><span>BREAKS WHEN</span><strong>{analysis.nextSequence.failure}</strong></div>
      </article> : null}

      {scene === 5 ? <article className="pbScene pbSceneVerdict">
        <small>FINAL CHAPTER · BULLSEYE</small>
        <h1>{analysis.verdict.replaceAll("_", " ")}</h1>
        <h2>{analysis.verdictHeadline}</h2>
        <p>{analysis.summary}</p>
        <div className="pbVerdictStats"><span><small>DIRECTION</small><strong>{analysis.direction}</strong></span><span><small>GRADE</small><strong>{analysis.setupScore.grade}</strong></span><span><small>SCORE</small><strong>{analysis.setupScore.overall}/100</strong></span></div>
        <div className="pbVerdictActions"><button type="button" onClick={() => onOpenReport()}>OPEN EVIDENCE</button><button type="button" onClick={onShare}>SHARE RESULT</button></div>
      </article> : null}
    </div>

    <div className="pbFilmControls">
      <button type="button" onClick={previous} disabled={scene === 0}>‹</button>
      <button type="button" onClick={() => setPaused((value) => !value)}>{paused ? "PLAY" : "PAUSE"}</button>
      <button type="button" onClick={next} disabled={scene === CHAPTERS.length - 1}>›</button>
    </div>

    <footer className="pbFilmLegal">REAL ANALYSIS · CINEMATIC PRESENTATION · CONDITIONAL DECISION SUPPORT · NOT A TRADE INSTRUCTION</footer>
  </section>;
}
