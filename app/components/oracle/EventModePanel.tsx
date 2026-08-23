import Link from "next/link";
import type { EventModeModel } from "../../lib/oracle/event-mode.ts";
import { ConceptHint } from "./ConceptHint.tsx";

export function EventModePanel({ model }: { model: EventModeModel }) {
  if (!model.available || !model.event) return null;

  return (
    <section
      className={`oracleEventMode is-${model.mode} is-${model.permission.tone}`}
      aria-labelledby="event-mode-title"
    >
      <header>
        <div>
          <span className="companionEyebrow">CATALYST EVENT MODE</span>
          <h2 id="event-mode-title">{model.event.name}</h2>
          <p>{model.event.familyLabel} · {model.event.whenLabel}</p>
        </div>
        <div className="oracleEventModeBadges" aria-label="Event Mode status">
          <strong>{model.modeLabel}</strong>
          <span>{model.event.dataStatusLabel}</span>
        </div>
      </header>

      <div className="oracleEventModeLead">
        <div className="oracleEventClock" aria-label={`Event starts in ${model.event.countdownLabel}`}>
          <span>STARTS IN</span>
          <strong>{model.event.countdownLabel}</strong>
          <small>{model.event.impactLabel}</small>
        </div>
        <div className={`oracleEventPermission is-${model.permission.tone}`}>
          <span>DECISION PERMISSION <ConceptHint conceptId="event-risk" /></span>
          <strong>{model.permission.label}</strong>
          <p>{model.permission.guardrail}</p>
        </div>
      </div>

      {model.event.includes.length > 0 ? (
        <p className="oracleEventIncludes">
          <b>Includes:</b> {model.event.includes.join(" · ")}
        </p>
      ) : null}

      <ol className="oracleEventProtocol" aria-label="Event Mode release protocol">
        {model.phases.map((phase, index) => (
          <li className={`is-${phase.state}`} key={phase.id}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <div>
              <small>{phase.statusLabel}</small>
              <strong>{phase.label}</strong>
              <p>{phase.instruction}</p>
            </div>
          </li>
        ))}
      </ol>

      {model.followingEvents.length > 0 ? (
        <details className="oracleFollowingEvents">
          <summary>Following verified event windows</summary>
          <ul>
            {model.followingEvents.map((event) => (
              <li key={`${event.whenLabel}-${event.name}`}>
                <time>{event.whenLabel}</time>
                <strong>{event.name}</strong>
                <span>{event.impactLabel}</span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      <footer className="oracleEventModeFooter">
        <p>{model.methodology}</p>
        <Link href="/terminal#catalysts">Open catalyst view →</Link>
      </footer>
    </section>
  );
}
