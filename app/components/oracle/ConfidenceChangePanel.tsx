"use client";

import { useEffect, useMemo, useSyncExternalStore } from "react";
import type { ConfidenceChangeModel, StoredConfidenceSnapshot } from "../../lib/oracle/confidence-change.ts";
import {
  buildConfidenceChange,
  clearStoredConfidenceSnapshot,
  readStoredConfidenceSnapshot,
  writeStoredConfidenceSnapshot,
} from "../../lib/oracle/confidence-change.ts";
import { subscribeOracleStorage } from "../../lib/oracle/oracle-storage-bus.ts";

/** Captured once per tab so writing the latest snapshot does not erase the comparison baseline. */
let sessionBaseline: StoredConfidenceSnapshot | null | undefined;

function readSessionBaseline(): StoredConfidenceSnapshot | null {
  if (sessionBaseline === undefined) {
    sessionBaseline = readStoredConfidenceSnapshot();
  }
  return sessionBaseline;
}

export function ConfidenceChangePanel({
  current,
}: {
  current: Omit<StoredConfidenceSnapshot, "version" | "storedAt">;
}) {
  const previous = useSyncExternalStore(subscribeOracleStorage, readSessionBaseline, () => null);

  const model: ConfidenceChangeModel = useMemo(
    () => buildConfidenceChange({ previous, current }),
    [previous, current],
  );

  useEffect(() => {
    writeStoredConfidenceSnapshot(model.current);
  }, [model]);

  return (
    <section className="oracleChange" aria-labelledby="confidence-change-title">
      <header>
        <span className="companionEyebrow">WHY CONFIDENCE CHANGED</span>
        <h2 id="confidence-change-title">Local comparison</h2>
      </header>
      {!model.comparable ? (
        <p className="oracleChangeMessage">{model.message}</p>
      ) : (
        <dl className="oracleChangeGrid">
          <div>
            <dt>Previous</dt>
            <dd>
              {model.previous?.band ?? "—"} · {model.previous?.posture}
            </dd>
          </div>
          <div>
            <dt>Current</dt>
            <dd>
              {model.current.band} · {model.current.posture}
            </dd>
          </div>
          <div>
            <dt>Direction</dt>
            <dd>{model.direction}</dd>
          </div>
          <div>
            <dt>Added factors</dt>
            <dd>{model.added.length ? model.added.join(", ") : "None"}</dd>
          </div>
          <div>
            <dt>Removed factors</dt>
            <dd>{model.removed.length ? model.removed.join(", ") : "None"}</dd>
          </div>
        </dl>
      )}
      <button
        type="button"
        className="oracleResetBtn"
        onClick={() => {
          clearStoredConfidenceSnapshot();
          sessionBaseline = null;
        }}
      >
        Reset local comparison
      </button>
      <p className="companionDisclosure">Stores only non-sensitive display state in this browser.</p>
    </section>
  );
}
