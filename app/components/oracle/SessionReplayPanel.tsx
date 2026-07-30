import type { SessionReplayModel } from "../../lib/oracle/session-replay.ts";

export function SessionReplayPanel({ model }: { model: SessionReplayModel }) {
  return (
    <section className={`oracleReplay${!model.available ? " is-limited" : ""}`} aria-labelledby="session-replay-title">
      <header>
        <span className="companionEyebrow">SESSION REPLAY</span>
        <h2 id="session-replay-title">{model.title}</h2>
      </header>
      {model.available ? (
        <ul className="oracleReplayLines">
          {model.summaryLines.map((line) => <li key={line}>{line}</li>)}
        </ul>
      ) : (
        <p className="oracleChangeMessage">Insufficient verified history for a factual replay foundation.</p>
      )}
      <ul className="oracleReplayLimits">
        {model.limitations.map((line) => <li key={line}>{line}</li>)}
      </ul>
      <p className="companionDisclosure">{model.disclosure}</p>
    </section>
  );
}
