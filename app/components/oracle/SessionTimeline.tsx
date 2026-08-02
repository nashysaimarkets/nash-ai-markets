import type { SessionTimelineModel } from "../../lib/oracle/session-timeline.ts";
import { StatusBadge } from "../../dashboard/components/visual/StatusBadge.tsx";

export function SessionTimeline({ model }: { model: SessionTimelineModel }) {
  return (
    <section className="oracleTimeline" aria-labelledby="session-timeline-title">
      <header>
        <div>
          <span className="companionEyebrow">SESSION TIMELINE</span>
          <h2 id="session-timeline-title">{model.currentLabel}</h2>
        </div>
        <div className="dashHeroKicker">
          <StatusBadge label={model.nowEt} tone="info" />
          {model.nextLabel ? <StatusBadge label={`Next · ${model.nextLabel}`} tone="caution" /> : null}
          {model.countdownLabel ? <StatusBadge label={model.countdownLabel} tone="warning" /> : null}
        </div>
      </header>
      <ol className="oracleTimelineTrack">
        {model.stages.map((stage) => (
          <li key={stage.id} className={stage.active ? "is-active" : undefined} aria-current={stage.active ? "step" : undefined}>
            <strong>{stage.label}</strong>
          </li>
        ))}
      </ol>
      <p className="oracleTimelineFocus">
        <span>Focus</span>
        {model.focus}
      </p>
      <small className="companionDisclosure">{model.disclosure}</small>
    </section>
  );
}
