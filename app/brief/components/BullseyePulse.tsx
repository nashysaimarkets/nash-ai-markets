import type { CSSProperties } from "react";
import type { AiMarketInsightModel } from "../../lib/ai-market-insight.ts";
import type { MorningMarketBriefModel } from "../lib/compose-market-brief.ts";

type BullseyePulseProps = {
  model: MorningMarketBriefModel;
  insight: AiMarketInsightModel;
  permissionBlocked: boolean;
};

const EXPECTED_ASSETS = [
  { id: "ES", label: "ES Futures" },
  { id: "VIX", label: "Volatility" },
  { id: "DXY", label: "US Dollar" },
  { id: "US10Y", label: "US 10Y" },
] as const;

export function BullseyePulse({ model, insight, permissionBlocked }: BullseyePulseProps) {
  const assets = EXPECTED_ASSETS.map((expected) => ({
    ...expected,
    reading: model.crossAssets.find((asset) => asset.id === expected.id) ?? null,
  }));
  const catalyst = model.economicTimeline.find((item) => item.available) ?? null;
  const confidenceReady = insight.confidence.available && insight.confidence.score != null;
  const signals = [
    { label: "Feed", ready: model.verified, value: model.verified ? "Verified delayed" : "Awaiting" },
    { label: "Context", ready: model.crossAssets.length > 0, value: `${model.crossAssets.length} / 4 covered` },
    { label: "Confidence", ready: confidenceReady, value: confidenceReady ? insight.confidence.label : "Not established" },
    { label: "Levels", ready: model.levels.rungs.length > 0, value: model.levels.rungs.length ? `${model.levels.rungs.length} verified` : "Awaiting" },
    { label: "Catalyst", ready: Boolean(catalyst), value: catalyst ? catalyst.name : "None verified" },
  ];
  const readyCount = signals.filter((signal) => signal.ready).length;
  const weatherReady = model.crossAssets.length >= 3;
  const weatherTone = permissionBlocked ? "Caution" : insight.bullBear.dominant;

  return (
    <section className="mbPulse" aria-labelledby="bullseye-pulse-title">
      <div className="mbPulseTopline">
        <div>
          <span className="mbEyebrow">Bullseye pulse</span>
          <h2 id="bullseye-pulse-title">The decision, visually assembled</h2>
        </div>
        <strong className={permissionBlocked ? "is-hold" : "is-ready"}>
          {permissionBlocked ? "WAIT FOR CONFIRMATION" : "EVIDENCE ACTIVE"}
        </strong>
      </div>

      <div className="mbPulseStage">
        <div className="mbPulseRadar" aria-label={`${readyCount} of 5 decision layers currently established`}>
          {signals.map((signal, index) => (
            <span
              className={signal.ready ? "is-active" : "is-dormant"}
              key={signal.label}
              style={{ "--pulse-ring": index } as CSSProperties}
            />
          ))}
          <div>
            <b>{readyCount}</b>
            <small>OF 5 LAYERS</small>
          </div>
        </div>

        <div className="mbPulseEvidence" aria-label="Decision evidence status">
          {signals.map((signal, index) => (
            <div className={signal.ready ? "is-active" : "is-dormant"} key={signal.label}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <p><b>{signal.label}</b><small>{signal.value}</small></p>
              <i aria-hidden="true" />
            </div>
          ))}
        </div>
      </div>

      <div className={`mbWeatherOrb ${weatherReady ? "is-ready" : "is-dormant"}`}>
        <div className="mbWeatherVisual" aria-hidden="true"><i /><i /><i /></div>
        <div><span className="mbEyebrow">Market weather</span><h3>{weatherReady ? weatherTone : "Formation incomplete"}</h3><p>{weatherReady ? "Verified cross-market inputs are forming today’s market atmosphere." : "The orb activates when at least three verified cross-market inputs are available."}</p></div>
      </div>

      <div className="mbSessionStory" aria-label="Session storyline">
        <article><b>01</b><span>Overnight</span><strong>{model.summary.overnight}</strong></article>
        <article><b>02</b><span>Now</span><strong>{model.posture.headline}</strong></article>
        <article><b>03</b><span>Next catalyst</span><strong>{catalyst ? `${catalyst.time} · ${catalyst.name}` : "None verified"}</strong></article>
        <article><b>04</b><span>Invalidation</span><strong>{model.biggestRisk.label}</strong></article>
      </div>

      <div className="mbHeartbeat" aria-label="Verified cross-market heartbeat">
        {assets.map(({ id, label, reading }) => (
          <div className={reading ? `is-${reading.direction}` : "is-empty"} key={id}>
            <span>{label}</span>
            <strong>{reading?.value ?? "—"}</strong>
            <small>{reading?.change ?? "Awaiting verified print"}</small>
            <i className="mbPulseTrace" aria-hidden="true" />
          </div>
        ))}
      </div>

      <details className="mbFocusDeck">
        <summary>
          <span><b>Focus mode</b> Strip the brief back to today’s four decisions</span>
          <i aria-hidden="true">+</i>
        </summary>
        <div>
          <article><span>Posture</span><strong>{model.posture.headline}</strong></article>
          <article><span>Primary risk</span><strong>{model.biggestRisk.label}</strong></article>
          <article><span>Next catalyst</span><strong>{catalyst ? `${catalyst.time} · ${catalyst.name}` : "No verified catalyst listed"}</strong></article>
          <article><span>Next action</span><strong>{model.playbook.steps[0] ?? "Wait for clearer evidence"}</strong></article>
        </div>
      </details>
    </section>
  );
}
