import type { SessionReplayModel } from "../../lib/oracle/session-replay.ts";
import { StatusIcon } from "../StatusIcon.tsx";
import { StatusBadge } from "../../dashboard/components/visual/StatusBadge.tsx";

export function SessionReplayPanel({ model }: { model: SessionReplayModel }) {
  return (
    <section className={`oracleReplay${!model.available ? " is-limited" : ""}`} aria-labelledby="session-replay-title">
      <header>
        <span className="companionEyebrow vxIconLabel">
          <StatusIcon name="sunset" />
          MARKET REPLAY
        </span>
        <h2 id="session-replay-title">{model.title}</h2>
        <p>Compare verified session evidence with your process — without inventing yesterday’s forecast.</p>
      </header>

      <div className="oracleReplayCompare">
        <article>
          <span>Prior documented posture</span>
          <strong>{model.yesterdayBias ?? "Not archived yet"}</strong>
          <StatusBadge
            label={model.bullCasePlayed ?? "Confirmation not scored"}
            tone={model.available ? "info" : "muted"}
          />
        </article>
        <div className="oracleReplayArrow" aria-hidden="true">
          →
        </div>
        <article>
          <span>Verified outcome</span>
          <strong>{model.actualOutcome ?? "Awaiting verified candles"}</strong>
          <StatusBadge
            label={model.bearCasePlayed ?? "Outcome pending"}
            tone={model.available ? "caution" : "muted"}
          />
        </article>
      </div>

      <aside className="oracleReplayLesson">
        <span>Lesson learned</span>
        <strong>{model.lessonLearned ?? "Complete your journal review."}</strong>
      </aside>

      <div className="oracleReplayScorecard">
        <article>
          <span>Major surprise</span>
          <strong>{model.majorSurprise ?? "Not scored"}</strong>
        </article>
        <article>
          <span>Forecast accuracy</span>
          <strong>{model.forecastAccuracy ?? "Unavailable"}</strong>
        </article>
        <article>
          <span>30-day accuracy</span>
          <strong>Unavailable</strong>
          <small>{model.rollingAccuracyNote}</small>
        </article>
      </div>

      {model.available ? (
        <ul className="oracleReplayLines">
          {model.summaryLines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      ) : (
        <p className="oracleChangeMessage">Insufficient verified history for a factual replay foundation.</p>
      )}
      <ul className="oracleReplayLimits">
        {model.limitations.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <p className="companionDisclosure">{model.disclosure}</p>
    </section>
  );
}
