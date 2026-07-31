import type { SessionReplayModel } from "../../lib/oracle/session-replay.ts";
import { StatusIcon } from "../StatusIcon.tsx";

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

      <div className="oracleReplayScorecard">
        <article>
          <span>Yesterday’s bias</span>
          <strong>{model.yesterdayBias ?? "Not archived yet"}</strong>
        </article>
        <article>
          <span>Actual market outcome</span>
          <strong>{model.actualOutcome ?? "Awaiting verified candles"}</strong>
        </article>
        <article>
          <span>Bull case played out?</span>
          <strong>{model.bullCasePlayed ?? "Not established"}</strong>
        </article>
        <article>
          <span>Bear case played out?</span>
          <strong>{model.bearCasePlayed ?? "Not established"}</strong>
        </article>
        <article>
          <span>Major surprise</span>
          <strong>{model.majorSurprise ?? "Not scored"}</strong>
        </article>
        <article>
          <span>Lesson learned</span>
          <strong>{model.lessonLearned ?? "Complete your journal review."}</strong>
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
