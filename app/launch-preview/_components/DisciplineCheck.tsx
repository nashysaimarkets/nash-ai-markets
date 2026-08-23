"use client";

import { useMemo, useState } from "react";
import {
  calculateDisciplineScore,
  createDisciplineShareText,
  createEmptyDisciplineAnswers,
  DISCIPLINE_QUESTIONS,
  getDisciplineScoreBand,
  type DisciplineAnswers,
  type DisciplineQuestionId,
} from "../lib/discipline-check.ts";
import { SessionChallenge } from "./SessionChallenge.tsx";

export function DisciplineCheck() {
  const [answers, setAnswers] = useState<DisciplineAnswers>(() => createEmptyDisciplineAnswers());
  const [touched, setTouched] = useState(false);
  const [status, setStatus] = useState("Answers stay on this device and are never submitted.");
  const score = useMemo(() => calculateDisciplineScore(answers), [answers]);
  const band = getDisciplineScoreBand(score);

  function toggle(id: DisciplineQuestionId) {
    setTouched(true);
    setAnswers((current) => ({ ...current, [id]: !current[id] }));
    setStatus("Score updated locally. Nothing has been submitted.");
  }

  function reset() {
    setAnswers(createEmptyDisciplineAnswers());
    setTouched(false);
    setStatus("Discipline Check reset. Answers stay on this device.");
  }

  function prepareNextSession() {
    setAnswers(createEmptyDisciplineAnswers());
    setTouched(false);
    setStatus("Session recorded locally. Checklist reset for the next review.");
  }

  async function shareResult() {
    const text = createDisciplineShareText(score, band.label);
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ title: "Bullseye Discipline Check", text });
        setStatus("Share sheet opened. No Bullseye account data was included.");
        return;
      }
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(text);
        setStatus("Result copied. Paste it into your preferred social app.");
        return;
      }
      setStatus("Sharing is unavailable in this browser. Download the scorecard instead.");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        setStatus("Sharing cancelled. Your answers remain on this device.");
        return;
      }
      setStatus("Sharing was unavailable. Download the scorecard instead.");
    }
  }

  function downloadScorecard() {
    const canvas = document.createElement("canvas");
    canvas.width = 1200;
    canvas.height = 1200;
    const context = canvas.getContext("2d");
    if (!context) {
      setStatus("Scorecard download is unavailable in this browser.");
      return;
    }

    const background = context.createRadialGradient(870, 220, 40, 650, 420, 920);
    background.addColorStop(0, "#143f30");
    background.addColorStop(0.52, "#07110f");
    background.addColorStop(1, "#020706");
    context.fillStyle = background;
    context.fillRect(0, 0, canvas.width, canvas.height);

    context.strokeStyle = "rgba(56, 242, 142, 0.24)";
    context.lineWidth = 3;
    for (const radius of [250, 170, 92]) {
      context.beginPath();
      context.arc(920, 260, radius, 0, Math.PI * 2);
      context.stroke();
    }
    context.fillStyle = "#d9ab52";
    context.beginPath();
    context.arc(920, 260, 15, 0, Math.PI * 2);
    context.fill();

    context.fillStyle = "#38f28e";
    context.font = "700 25px monospace";
    context.fillText("NASH AI MARKETS · PROJECT BULLSEYE", 84, 110);
    context.fillStyle = "#f4f3ec";
    context.font = "700 62px Arial";
    context.fillText("DISCIPLINE CHECK", 84, 235);
    context.fillStyle = "#d9ab52";
    context.font = "700 210px Arial";
    context.fillText(`${score}/8`, 76, 540);
    context.fillStyle = "#f4f3ec";
    context.font = "600 55px Arial";
    context.fillText(band.label, 84, 650);
    context.fillStyle = "#9ba9a3";
    context.font = "400 31px Arial";
    context.fillText("PROCESS OVER PREDICTION", 84, 745);
    context.fillStyle = "#38f28e";
    context.font = "700 28px monospace";
    context.fillText("#BullseyeBeforeTheBell", 84, 820);
    context.strokeStyle = "rgba(255,255,255,0.14)";
    context.beginPath();
    context.moveTo(84, 910);
    context.lineTo(1116, 910);
    context.stroke();
    context.fillStyle = "#78857f";
    context.font = "400 23px Arial";
    context.fillText("Educational process score — not a market signal or permission to trade.", 84, 980);
    context.fillText("Example share card generated locally. No answers were uploaded.", 84, 1023);

    canvas.toBlob((blob) => {
      if (!blob) {
        setStatus("Scorecard download could not be created.");
        return;
      }
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "bullseye-discipline-scorecard.png";
      anchor.click();
      URL.revokeObjectURL(url);
      setStatus("Scorecard downloaded as a share-ready image.");
    }, "image/png");
  }

  return (
    <section className="vlDiscipline" id="discipline-check" aria-labelledby="vl-discipline-title">
      <header>
        <div>
          <span className="vlEyebrow">FREE · DEVICE-LOCAL · ZERO DATA COST</span>
          <h2 id="vl-discipline-title">Bullseye Discipline Check</h2>
          <p>Tick only the preparation steps you have genuinely completed. This scores process, never direction, profit probability or trade quality.</p>
        </div>
        <div className={`vlScore is-${band.tone}`} aria-live="polite">
          <span>PROCESS SCORE</span>
          <strong>{score}<small>/8</small></strong>
          <b>{band.label}</b>
        </div>
      </header>

      <div className="vlDisciplineLayout">
        <fieldset>
          <legend>My preparation gates</legend>
          {DISCIPLINE_QUESTIONS.map((question, index) => (
            <label key={question.id} className={answers[question.id] ? "is-complete" : undefined}>
              <input
                type="checkbox"
                checked={answers[question.id]}
                onChange={() => toggle(question.id)}
              />
              <span><b>{String(index + 1).padStart(2, "0")}</b>{question.label}</span>
            </label>
          ))}
        </fieldset>

        <aside className={`vlScoreDetail is-${band.tone}`} aria-label="Discipline Check result">
          <span>CURRENT READING</span>
          <h3>{band.label}</h3>
          <p>{band.detail}</p>
          <label htmlFor="vl-score-progress">Completed preparation gates</label>
          <progress id="vl-score-progress" max={DISCIPLINE_QUESTIONS.length} value={score}>{score} of {DISCIPLINE_QUESTIONS.length}</progress>
          <div className="vlScoreActions">
            <button type="button" onClick={shareResult} disabled={!touched}>Share result</button>
            <button type="button" onClick={downloadScorecard} disabled={!touched}>Download scorecard</button>
            <button type="button" className="is-secondary" onClick={reset}>Reset safely</button>
          </div>
          <small>No answers, identifiers or market data leave this page. The share action contains no private-preview link.</small>
          <p className="vlScoreStatus" role="status" aria-live="polite">{status}</p>
        </aside>
      </div>

      <SessionChallenge score={score} touched={touched} onRecorded={prepareNextSession} />
    </section>
  );
}
