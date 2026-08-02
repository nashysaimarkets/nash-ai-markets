"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";

type BriefExperienceToolsProps = {
  posture: string;
  risk: string;
  catalyst: string;
  level: string;
};

const TASKS = ["Context reviewed", "Risk defined", "Catalyst checked", "Plan prepared"] as const;
const STORE_KEY = "nash:brief:preparation:v1";

export function BriefExperienceTools({ posture, risk, catalyst, level }: BriefExperienceToolsProps) {
  const [completed, setCompleted] = useState<boolean[]>([false, false, false, false]);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const completeCount = completed.filter(Boolean).length;
  const progress = useMemo(() => completeCount * 25, [completeCount]);

  useEffect(() => {
    try {
      const stored = JSON.parse(window.localStorage.getItem(STORE_KEY) ?? "null");
      if (Array.isArray(stored) && stored.length === TASKS.length) setCompleted(stored.map(Boolean));
    } catch { /* Device-only preference remains optional. */ }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "/" && !event.metaKey && !event.ctrlKey && !event.altKey) {
        const target = event.target as HTMLElement | null;
        if (target?.matches("input, textarea, [contenteditable='true']")) return;
        event.preventDefault();
        setPaletteOpen(true);
      }
      if (event.key === "Escape") setPaletteOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const toggle = (index: number) => {
    setCompleted((current) => {
      const next = current.map((value, itemIndex) => itemIndex === index ? !value : value);
      window.localStorage.setItem(STORE_KEY, JSON.stringify(next));
      return next;
    });
  };

  const downloadMission = () => {
    const canvas = document.createElement("canvas");
    canvas.width = 1400; canvas.height = 788;
    const context = canvas.getContext("2d");
    if (!context) return;
    const gradient = context.createLinearGradient(0, 0, 1400, 788);
    gradient.addColorStop(0, "#06100d"); gradient.addColorStop(1, "#102019");
    context.fillStyle = gradient; context.fillRect(0, 0, 1400, 788);
    context.strokeStyle = "#2fe0a1"; context.lineWidth = 2; context.strokeRect(48, 48, 1304, 692);
    context.fillStyle = "#5ce7b5"; context.font = "700 24px monospace"; context.fillText("NASH AI MARKETS · DAILY MISSION", 90, 115);
    context.fillStyle = "#f0f5f2"; context.font = "700 66px sans-serif"; context.fillText(posture, 90, 215);
    const rows = [["KEY LEVEL", level], ["MAIN RISK", risk], ["NEXT CATALYST", catalyst]];
    rows.forEach(([label, value], index) => {
      const y = 330 + index * 120;
      context.fillStyle = "#83968e"; context.font = "700 18px monospace"; context.fillText(label, 90, y);
      context.fillStyle = "#e3ece8"; context.font = "600 30px sans-serif";
      context.fillText(value.slice(0, 70), 90, y + 43);
    });
    context.fillStyle = "#caa85a"; context.font = "700 18px monospace"; context.fillText("EVIDENCE BEFORE OPINION · RISK ALWAYS VISIBLE", 90, 690);
    const link = document.createElement("a");
    link.download = "nash-ai-markets-daily-mission.png";
    link.href = canvas.toDataURL("image/png"); link.click();
  };

  const commands = [
    ["Today’s decision", "#todays-posture"], ["Verified levels", "#verified-levels"],
    ["Risk and avoid", "#watch-avoid"], ["Trading Desk", "/terminal"],
    ["Dashboard", "/dashboard"], ["Risk & Journal", "/journal"],
  ];

  return (
    <section className="mbExperienceTools" aria-labelledby="preparation-progress-title">
      <div className="mbPreparationArc" style={{ "--brief-progress": `${progress}%` } as CSSProperties}>
        <div><strong>{completeCount}<small>/4</small></strong><span>READY</span></div>
      </div>
      <div className="mbPreparationCopy">
        <span className="mbEyebrow">Preparation state</span>
        <h2 id="preparation-progress-title">Build conviction through process</h2>
        <div className="mbPreparationChecks">
          {TASKS.map((task, index) => <button className={completed[index] ? "is-done" : ""} key={task} onClick={() => toggle(index)} type="button"><i aria-hidden="true" />{task}</button>)}
        </div>
      </div>
      <div className="mbExperienceActions">
        <button type="button" onClick={downloadMission}>Download mission card</button>
        <button type="button" onClick={() => setPaletteOpen(true)}>Open command palette <kbd>/</kbd></button>
      </div>
      {paletteOpen ? <div className="mbCommandBackdrop" role="presentation" onMouseDown={() => setPaletteOpen(false)}><section aria-modal="true" aria-labelledby="brief-command-title" role="dialog" onMouseDown={(event) => event.stopPropagation()}><header><div><span className="mbEyebrow">Command centre</span><h2 id="brief-command-title">Where do you need to go?</h2></div><button aria-label="Close command palette" onClick={() => setPaletteOpen(false)} type="button">×</button></header><nav>{commands.map(([label, href], index) => <a href={href} key={href}><b>{String(index + 1).padStart(2, "0")}</b>{label}<span>↗</span></a>)}</nav></section></div> : null}
    </section>
  );
}
