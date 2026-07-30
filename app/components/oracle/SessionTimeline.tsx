import type { SessionTimelineModel } from "../../lib/oracle/session-timeline.ts";

export function SessionTimeline({ model }: { model: SessionTimelineModel }) {
  return (
    <section className="oracleTimeline" aria-labelledby="session-timeline-title">
      <header>
        <span className="companionEyebrow">SESSION TIMELINE</span>
        <h2 id="session-timeline-title">{model.currentLabel}</h2>
        <p>
          {model.nowEt}
          {model.nextLabel ? ` · Next: ${model.nextLabel}` : ""}
          {model.countdownLabel ? ` · ${model.countdownLabel}` : ""}
        </p>
      </header>
      <ol className="oracleTimelineTrack">
        {model.stages.map((stage) => (
          <li key={stage.id} className={stage.active ? "is-active" : undefined} aria-current={stage.active ? "step" : undefined}>
            <strong>{stage.label}</strong>
          </li>
        ))}
      </ol>
      <p className="oracleTimelineFocus"><span>Focus</span>{model.focus}</p>
      <small className="companionDisclosure">{model.disclosure}</small>
    </section>
  );
}
