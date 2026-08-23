"use client";

import { useSyncExternalStore } from "react";
import {
  buildProcessScore,
  clearProcessScore,
  readProcessScore,
} from "../../lib/oracle/process-score.ts";
import { subscribeOracleStorage } from "../../lib/oracle/oracle-storage-bus.ts";
import { createCachedSnapshot, createConstantSnapshot } from "../../lib/oracle/cached-snapshot.ts";

const processSnapshot = createCachedSnapshot(() => readProcessScore());
const processServerSnapshot = createConstantSnapshot(() => readProcessScore(null));

export function ProcessScorePanel() {
  const state = useSyncExternalStore(
    subscribeOracleStorage,
    processSnapshot,
    processServerSnapshot,
  );
  const model = buildProcessScore(state);

  return (
    <section className="oracleProcess" aria-labelledby="process-score-title">
      <header>
        <span className="companionEyebrow">PROCESS CONSISTENCY</span>
        <h2 id="process-score-title">Preparation streak</h2>
      </header>
      <dl className="oracleThirtyGrid">
        <div>
          <dt>Prepared today</dt>
          <dd>{model.preparedToday ? "Yes" : "Not yet"}</dd>
        </div>
        <div>
          <dt>Consecutive prepared sessions</dt>
          <dd>{model.consecutivePreparedSessions}</dd>
        </div>
        <div className="is-wide">
          <dt>Tracked completion</dt>
          <dd>{model.completionRateLabel}</dd>
        </div>
      </dl>
      <p>{model.emphasis}</p>
      <button
        type="button"
        className="oracleResetBtn"
        onClick={() => {
          if (!window.confirm("Clear local process consistency data?")) return;
          clearProcessScore();
        }}
      >
        Clear local process data
      </button>
      <p className="companionDisclosure">{model.disclosure}</p>
    </section>
  );
}
