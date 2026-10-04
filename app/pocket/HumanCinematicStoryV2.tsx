"use client";

import { useEffect, useMemo, useState } from "react";

type Direction = "BULLISH" | "BEARISH" | "NEUTRAL";
type Verdict = "WATCH" | "WAIT" | "STAND_ASIDE" | "REVIEW_REQUIRED";
type Level = { kind: string; price: string; y: number };

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
  levels: Level[];
};

type Props = {
  analysis: Analysis;
  sourceImage: string;
  viewerName: string;
  intention: "LONG" | "SHORT" | "UNSURE";
  onOpenReport: (target?: string) => void;
  onShare: () => void;
};

const HUMAN_PLATE = "https://images.pexels.com/videos/6931252/accounting-afro-angry-architect-6931252.jpeg?auto=compress&dpr=1&h=1080&w=1920";
const SCENES = ["MOMENT", "STRUCTURE", "LEVELS", "CHALLENGE", "VERDICT"] as const;

function clamp(value: number) {
  return Math.max(4, Math.min(96, Number.isFinite(value) ? value : 50));
}

function validPrice(value: string) {
  return /^-?\d[\d,.]*$/.test(value.trim());
}

export default function HumanCinematicStoryV2({ analysis, sourceImage, viewerName, intention, onOpenReport, onShare }: Props) {
  const [scene, setScene] = useState(0);
  const [paused, setPaused] = useState(false);

  const levels = useMemo(() => analysis.levels
    .filter((level) => ["support", "resistance", "pivot"].includes(level.kind) && validPrice(level.price))
    .slice(0, 5), [analysis.levels]);

  const counter = analysis.whatYouMayBeMissing[0]
    || analysis.contradictions[0]
    || analysis.riskFlags[0]
    || analysis.traderTrap
    || "Confirmation is still incomplete.";

  useEffect(() => {
    if (paused || scene >= SCENES.length - 1) return;
    const delay = scene === 0 ? 5200 : scene === 3 ? 7000 : 6000;
    const timer = window.setTimeout(() => setScene((current) => Math.min(current + 1, SCENES.length - 1)), delay);
    return () => window.clearTimeout(timer);
  }, [scene, paused]);

  const go = (index: number) => {
    setPaused(true);
    setScene(Math.max(0, Math.min(index, SCENES.length - 1)));
  };

  return <section className="pb2Film" data-scene={scene} data-direction={analysis.direction}>
    <div className="pb2Frame">
      {scene === 0 || scene === 3 ? <img className="pb2HumanPlate" src={HUMAN_PLATE} alt="" /> : null}
      {scene === 1 || scene === 2 ? <img className="pb2ChartPlate" src={sourceImage} alt="Uploaded trading chart used by Pocket Bullseye" /> : null}

      {scene === 0 ? <div className="pb2Scene pb2Moment">
        <div className="pb2Kicker">THE MOMENT BEFORE</div>
        <div className="pb2MomentCopy">
          <p>{viewerName ? viewerName.toUpperCase() + "," : "YOU'VE SEEN THE SETUP."}</p>
          <h1>{viewerName ? "you've seen the setup." : "Now challenge it."}</h1>
          <button type="button" onClick={() => go(1)}>RUN THE EVIDENCE <span>→</span></button>
        </div>
        <div className="pb2AmbientTag"><span>{analysis.instrument}</span><b>{analysis.timeframe}</b><small>{intention === "UNSURE" ? "OPEN-MINDED READ" : intention + " IDEA"}</small></div>
      </div> : null}

      {scene === 1 ? <div className="pb2Scene pb2ChartScene">
        <div className="pb2TopLine"><span>STRUCTURE</span><b>{analysis.instrument} · {analysis.timeframe}</b></div>
        <div className="pb2Caption">
          <small>WHAT IS PRICE ACTUALLY DOING?</small>
          <p>{analysis.marketStructure}</p>
          <button type="button" onClick={() => go(2)}>SHOW VERIFIED LEVELS →</button>
        </div>
      </div> : null}

      {scene === 2 ? <div className="pb2Scene pb2LevelsScene">
        <div className="pb2TopLine"><span>VERIFIED LEVELS</span><b>{levels.length ? levels.length + " READABLE" : "PRECISION HOLD"}</b></div>
        <svg className="pb2LevelOverlay" viewBox="0 0 100 100" preserveAspectRatio="none" aria-label="Verified chart levels">
          {levels.map((level, index) => <g key={level.kind + level.price + index} data-kind={level.kind}>
            <line x1="4" x2="96" y1={clamp(level.y)} y2={clamp(level.y)} />
            <circle cx="8" cy={clamp(level.y)} r="1.2" />
          </g>)}
        </svg>
        <div className="pb2LevelLabels">
          {levels.map((level, index) => <span key={level.kind + level.price + index} data-kind={level.kind} style={{ top: clamp(level.y) + "%" }}><small>{level.kind.toUpperCase()}</small><b>{level.price}</b></span>)}
        </div>
        <div className="pb2Caption">
          <small>{levels.length ? "POCKET ONLY SHOWS PRICES IT CAN JUSTIFY." : "NO FAKE PRECISION."}</small>
          <p>{analysis.levelStory}</p>
          <button type="button" onClick={() => go(3)}>WHAT DID I MISS? →</button>
        </div>
      </div> : null}

      {scene === 3 ? <div className="pb2Scene pb2ChallengeScene">
        <div className="pb2Kicker">WHAT DID I MISS?</div>
        <div className="pb2ChallengeCopy">
          <h2>The trade looked good.</h2>
          <h1>Pocket looked again.</h1>
          <blockquote>{counter}</blockquote>
          <div><span>BULL CASE</span><p>{analysis.bullishCase}</p></div>
          <div><span>BEAR CASE</span><p>{analysis.bearishCase}</p></div>
          <button type="button" onClick={() => go(4)}>SHOW VERDICT →</button>
        </div>
      </div> : null}

      {scene === 4 ? <div className="pb2Scene pb2VerdictScene">
        <div className="pb2VerdictWash"/>
        <div className="pb2VerdictCore">
          <small>POCKET BULLSEYE</small>
          <h1>{analysis.verdict.replaceAll("_", " ")}</h1>
          <h2>{analysis.verdictHeadline}</h2>
          <p>{analysis.summary}</p>
          <div className="pb2VerdictMeta"><span><small>READ</small><b>{analysis.direction}</b></span><span><small>GRADE</small><b>{analysis.setupScore.grade}</b></span><span><small>SCORE</small><b>{analysis.setupScore.overall}/100</b></span></div>
          <div className="pb2VerdictActions"><button type="button" onClick={() => onOpenReport()}>OPEN THE EVIDENCE</button><button type="button" onClick={onShare}>SHARE</button></div>
        </div>
      </div> : null}

      <button className="pb2TapLeft" type="button" aria-label="Previous scene" disabled={scene === 0} onClick={() => go(scene - 1)} />
      <button className="pb2TapRight" type="button" aria-label="Next scene" disabled={scene === SCENES.length - 1} onClick={() => go(scene + 1)} />
    </div>

    <nav className="pb2Transport" aria-label="Film navigation">
      <button type="button" onClick={() => setPaused((value) => !value)}>{paused ? "PLAY" : "PAUSE"}</button>
      <div>{SCENES.map((name, index) => <button key={name} type="button" data-active={scene === index} data-complete={index < scene} onClick={() => go(index)}><i/><span>{name}</span></button>)}</div>
      <button type="button" onClick={() => onOpenReport()}>REPORT</button>
    </nav>
    <footer className="pb2Legal">REAL SCAN · REAL EVIDENCE · CINEMATIC PRESENTATION · NOT A TRADE INSTRUCTION</footer>
  </section>;
}
