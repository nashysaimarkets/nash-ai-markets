"use client";

import Image from "next/image";
import { useMemo, useState, type ChangeEvent, type FormEvent } from "react";

const MAX_IMAGE_BYTES = 1_000_000;
const ACCEPTED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

type Opinion = {
  chartReadability: "clear" | "partial" | "unreadable";
  summary: string;
  observations: string[];
  bullCase: string;
  bearCase: string;
  invalidation: string;
  noTradeReasons: string[];
  disciplineCheck: string;
  uncertainties: string[];
  riskReward: number | null;
  extracted: {
    market: string | null;
    timeframe: "1m" | "5m" | "15m" | "1h" | "4h" | "daily" | null;
    platform: string | null;
    visiblePrice: number | null;
    intendedDirection: "long" | "short" | "neutral";
    entry: number | null;
    stop: number | null;
    target: number | null;
    indicators: string[];
    confidence: "low" | "medium" | "high";
    confirmationNeeded: string[];
  };
};

type FormSnapshot = {
  market: string;
  timeframe: string;
  currentPrice: number | null;
  direction: "long" | "short" | "neutral";
  entry: number | null;
  stop: number | null;
  target: number | null;
  stake: string;
  emotion: string;
  thesis: string;
};

function optionalNumber(value: FormDataEntryValue | null): number | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function readSnapshot(form: HTMLFormElement): FormSnapshot {
  const data = new FormData(form);
  return {
    market: String(data.get("market") ?? "").trim(),
    timeframe: String(data.get("timeframe") ?? "").trim(),
    currentPrice: optionalNumber(data.get("currentPrice")),
    direction: String(data.get("direction") ?? "neutral") as FormSnapshot["direction"],
    entry: optionalNumber(data.get("entry")),
    stop: optionalNumber(data.get("stop")),
    target: optionalNumber(data.get("target")),
    stake: String(data.get("stake") ?? "").trim(),
    emotion: String(data.get("emotion") ?? "").trim(),
    thesis: String(data.get("thesis") ?? "").trim(),
  };
}

export function SecondOpinionWorkbench({ canSaveToJournal }: { canSaveToJournal: boolean }) {
  const [imageDataUrl, setImageDataUrl] = useState("");
  const [imageName, setImageName] = useState("");
  const [imageError, setImageError] = useState("");
  const [privacyConfirmed, setPrivacyConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [opinion, setOpinion] = useState<Opinion | null>(null);
  const [lastInput, setLastInput] = useState<FormSnapshot | null>(null);
  const [journalState, setJournalState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [autoReadComplete, setAutoReadComplete] = useState(false);

  const previewLabel = useMemo(
    () => imageName ? `Selected chart: ${imageName}` : "No chart selected",
    [imageName],
  );

  function chooseImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setImageError("");
    setOpinion(null);
    setMessage("");
    setAutoReadComplete(false);
    if (!file) {
      setImageDataUrl("");
      setImageName("");
      return;
    }
    if (!ACCEPTED_IMAGE_TYPES.has(file.type)) {
      setImageError("Use a JPEG, PNG or WebP chart screenshot.");
      event.target.value = "";
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setImageError("For privacy and cost control, the screenshot must be under 1 MB.");
      event.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setImageDataUrl(typeof reader.result === "string" ? reader.result : "");
      setImageName(file.name.slice(0, 100));
    };
    reader.onerror = () => setImageError("The screenshot could not be opened. Please try another image.");
    reader.readAsDataURL(file);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!imageDataUrl || !privacyConfirmed) return;
    const form = event.currentTarget;
    const snapshot = readSnapshot(form);
    setSubmitting(true);
    setMessage("");
    setOpinion(null);
    setJournalState("idle");
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 18_000);
    try {
      const response = await fetch("/api/second-opinion", {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ ...snapshot, imageDataUrl, privacyConfirmed }),
        signal: controller.signal,
      });
      const payload = await response.json().catch(() => ({})) as { message?: string; opinion?: Opinion; mode?: string };
      if (!response.ok || !payload.opinion) {
        setMessage(payload.message ?? "A private second opinion could not be produced. No trade instruction has been generated.");
        return;
      }
      setLastInput(snapshot);
      setOpinion(payload.opinion);
      const extracted = payload.opinion.extracted;
      const setField = (name: string, value: string | number | null) => {
        if (value == null || value === "") return;
        const field = form.elements.namedItem(name);
        if (field instanceof HTMLInputElement || field instanceof HTMLSelectElement || field instanceof HTMLTextAreaElement) {
          field.value = String(value);
        }
      };
      setField("market", extracted.market);
      setField("timeframe", extracted.timeframe);
      setField("currentPrice", extracted.visiblePrice);
      setField("direction", extracted.intendedDirection);
      setField("entry", extracted.entry);
      setField("stop", extracted.stop);
      setField("target", extracted.target);
      setAutoReadComplete(payload.mode !== "plan-only");
      if (payload.mode === "plan-only") {
        setMessage("The Auto-Read interface is ready, but genuine AI chart reading is awaiting private API activation. No chart details were invented.");
      }
    } catch {
      setMessage("The review timed out or became unavailable. Do not treat this as confirmation of a trade.");
    } finally {
      window.clearTimeout(timeout);
      setSubmitting(false);
    }
  }

  async function savePlan() {
    if (!opinion || !lastInput || !canSaveToJournal) return;
    setJournalState("saving");
    const notes = [
      `Second Opinion (${lastInput.timeframe})`,
      opinion.summary,
      `Bull case: ${opinion.bullCase}`,
      `Bear case: ${opinion.bearCase}`,
      `Discipline: ${opinion.disciplineCheck}`,
      `Uncertainty: ${opinion.uncertainties.join(" ")}`,
    ].join("\n").slice(0, 2000);
    try {
      const response = await fetch("/api/journal", {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({
          tradedAt: new Date().toISOString(),
          instrumentClass: "futures",
          underlying: lastInput.market,
          direction: lastInput.direction,
          entryPrice: lastInput.entry,
          stopPrice: lastInput.stop,
          targetPrice: lastInput.target,
          positionSize: lastInput.stake || null,
          plannedMaxRisk: lastInput.stake || null,
          emotion: lastInput.emotion || null,
          reason: lastInput.thesis || null,
          notes,
        }),
      });
      setJournalState(response.ok ? "saved" : "error");
    } catch {
      setJournalState("error");
    }
  }

  return (
    <div className="secondOpinionShell">
      <section className="secondOpinionHero">
        <div>
          <span>PRIVATE PILOT · AI OFF · PROCESS FIRST</span>
          <h1>Before risking your money,<br /><em>get a second opinion.</em></h1>
          <p>Bring a chart from the platform you already use. Bullseye challenges your plan, shows both sides and checks the risk — without placing a trade.</p>
          <div className="secondOpinionStatus" aria-label="Protected staging status">
            <span><i aria-hidden="true" /> OWNER-ONLY STAGING</span>
            <span>AI ANALYSIS DISABLED</span>
            <span>NO BROKER CONNECTION</span>
          </div>
        </div>
        <aside aria-label="Second Opinion boundaries">
          <div className="secondOpinionRadar" aria-hidden="true"><i /><i /><i /></div>
          <strong>NOT A SIGNAL</strong>
          <p>No BUY or SELL command. No broker connection. No live-feed redistribution.</p>
        </aside>
      </section>

      <section className="secondOpinionFlow" aria-label="Second Opinion workflow">
        <span><b>01</b> Add chart</span><i aria-hidden="true" />
        <span><b>02</b> Plan is checked</span><i aria-hidden="true" />
        <span><b>03</b> Confirm details</span><i aria-hidden="true" />
        <span><b>04</b> Decide yourself</span>
      </section>

      <form className="secondOpinionForm" onSubmit={submit}>
        <section className="chartIntakeCard">
          <header><span>CHART INTAKE</span><h2>Add a private screenshot</h2></header>
          <label className="chartDropzone">
            {imageDataUrl ? <Image src={imageDataUrl} alt="Selected chart screenshot preview" fill sizes="(max-width: 850px) calc(100vw - 80px), 420px" unoptimized /> : <span aria-hidden="true">＋</span>}
            <strong>{imageDataUrl ? "Replace screenshot" : "Choose chart screenshot"}</strong>
            <small>JPEG, PNG or WebP · maximum 1 MB</small>
            <input type="file" accept="image/jpeg,image/png,image/webp" onChange={chooseImage} required />
          </label>
          <p className="selectedChart" aria-live="polite">{previewLabel}</p>
          {imageError ? <p className="secondOpinionError" role="alert">{imageError}</p> : null}
          <div className="privacyShield">
            <strong>Privacy check before upload</strong>
            <p>Crop out your name, email, account number, balance and notifications. The screenshot is analysed for this request and is not added to your journal.</p>
            <label><input type="checkbox" checked={privacyConfirmed} onChange={(event) => setPrivacyConfirmed(event.target.checked)} /> I have removed personal and account information.</label>
          </div>
        </section>

        <section className="tradePlanCard">
          <header><span>PROTECTED PLAN CHECK</span><h2>Pressure-test the plan</h2></header>
          <p className="autoReadIntro">AI chart reading is intentionally switched off. Add any details you want checked; Bullseye leaves missing information blank rather than guessing.</p>
          <details className="autoReadReview" open={autoReadComplete}>
            <summary>Review or add optional details</summary>
            <div className="secondOpinionGrid">
            <label>Market<input name="market" maxLength={32} placeholder="Auto-detected where visible" /></label>
            <label>Timeframe<select name="timeframe" defaultValue=""><option value="">Auto-detect</option><option value="1m">1 minute</option><option value="5m">5 minutes</option><option value="15m">15 minutes</option><option value="1h">1 hour</option><option value="4h">4 hours</option><option value="daily">Daily</option></select></label>
            <label>Current price<input name="currentPrice" type="number" step="any" inputMode="decimal" /></label>
            <label>Intended direction<select name="direction" required defaultValue="neutral"><option value="neutral">Still deciding</option><option value="long">Considering long</option><option value="short">Considering short</option></select></label>
            <label>Entry<input name="entry" type="number" step="any" inputMode="decimal" /></label>
            <label>Stop<input name="stop" type="number" step="any" inputMode="decimal" /></label>
            <label>Target<input name="target" type="number" step="any" inputMode="decimal" /></label>
            <label>Stake / maximum risk<input name="stake" maxLength={64} placeholder="e.g. £20 maximum" /></label>
            <label>How do you feel?<select name="emotion" defaultValue=""><option value="">Prefer not to say</option><option value="calm">Calm</option><option value="uncertain">Uncertain</option><option value="fearful">Fearful</option><option value="impatient">Impatient</option><option value="recovering-loss">Trying to recover a loss</option><option value="fomo">Fear of missing out</option></select></label>
            <label className="secondOpinionWide">Why are you considering it?<textarea name="thesis" rows={3} maxLength={500} placeholder="Describe what you see and what would prove you wrong." /></label>
            </div>
          </details>
          {opinion?.extracted ? (
            <div className="autoReadResult" data-confidence={opinion.extracted.confidence}>
              <div><span>PLAN CHECK</span><strong>{autoReadComplete ? `${opinion.extracted.confidence} confidence` : "AI safely disabled"}</strong></div>
              <p>{[
                opinion.extracted.market,
                opinion.extracted.timeframe,
                opinion.extracted.platform,
                ...opinion.extracted.indicators,
              ].filter(Boolean).join(" · ") || "No chart labels have been machine-read yet."}</p>
              {opinion.extracted.confirmationNeeded.length ? <ul>{opinion.extracted.confirmationNeeded.map((item) => <li key={item}>{item}</li>)}</ul> : <small>Visible details were extracted. Check them before relying on the plan.</small>}
            </div>
          ) : null}
          <button className="secondOpinionSubmit" type="submit" disabled={submitting || !imageDataUrl || !privacyConfirmed}>{submitting ? "Checking the plan…" : "Run protected plan check"}</button>
          <small>Educational decision support only. Bullseye can misread charts. You remain responsible for every decision.</small>
          {message ? <p className="secondOpinionError" role="alert">{message}</p> : null}
        </section>
      </form>

      {opinion ? (
        <section className="opinionReport" aria-live="polite">
          <header>
            <div><span>BULLSEYE SECOND OPINION</span><h2>Pause. Check both sides.</h2></div>
            <b data-readability={opinion.chartReadability}>{opinion.chartReadability} chart read</b>
          </header>
          <p className="opinionSummary">{opinion.summary}</p>
          <div className="opinionCases">
            <article><span>BULLISH INTERPRETATION</span><p>{opinion.bullCase}</p></article>
            <article><span>BEARISH INTERPRETATION</span><p>{opinion.bearCase}</p></article>
          </div>
          <div className="opinionDetails">
            <article><span>WHAT THE CHART APPEARS TO SHOW</span><ul>{opinion.observations.map((item) => <li key={item}>{item}</li>)}</ul></article>
            <article><span>PLAN INVALIDATION</span><p>{opinion.invalidation}</p><strong>{opinion.riskReward == null ? "Risk/reward unavailable" : `${opinion.riskReward.toFixed(2)} : 1 planned reward/risk`}</strong></article>
            <article><span>REASONS NOT TO TRADE</span><ul>{opinion.noTradeReasons.map((item) => <li key={item}>{item}</li>)}</ul></article>
            <article><span>DISCIPLINE CHECK</span><p>{opinion.disciplineCheck}</p></article>
            <article className="opinionUncertainty"><span>UNCERTAINTY</span><ul>{opinion.uncertainties.map((item) => <li key={item}>{item}</li>)}</ul></article>
          </div>
          <footer>
            <p>This is a challenge to your plan, not confirmation and not personalised financial advice.</p>
            {canSaveToJournal ? <button type="button" onClick={savePlan} disabled={journalState === "saving" || journalState === "saved"}>{journalState === "saving" ? "Saving…" : journalState === "saved" ? "Saved to journal" : "Save plan to journal"}</button> : <a href="/journal">Journal available with Pro</a>}
            {journalState === "error" ? <span role="alert">The plan could not be saved. The screenshot was not retained.</span> : null}
          </footer>
        </section>
      ) : null}
    </div>
  );
}
