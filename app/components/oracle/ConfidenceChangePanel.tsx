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

function useConfidenceChange(current: Omit<StoredConfidenceSnapshot, "version" | "storedAt">) {
  const previous = useSyncExternalStore(subscribeOracleStorage, readSessionBaseline, () => null);
  const model = useMemo(() => buildConfidenceChange({ previous, current }), [previous, current]);
  useEffect(() => writeStoredConfidenceSnapshot(model.current), [model]);
  return model;
}

/** Compact repeat-visit summary for the main command surface. */
export function CompactConfidenceChange({ current }: { current: Omit<StoredConfidenceSnapshot, "version" | "storedAt"> }) {
  const model = useConfidenceChange(current);
  const factors = [...model.added.map((item) => `Added: ${item}`), ...model.removed.map((item) => `Cleared: ${item}`)];
  return (
    <section className={`dashChangeStrip is-${model.direction}`} aria-labelledby="dash-change-title">
      <div><span>WHAT CHANGED?</span><strong id="dash-change-title">{model.comparable ? model.direction === "unchanged" ? "No material confidence change" : `Confidence moved ${model.direction}` : "Comparison starts with this verified snapshot"}</strong></div>
      <dl>
        <div><dt>Posture</dt><dd>{model.current.posture}</dd></div>
        <div><dt>Lean</dt><dd>{model.current.lean}</dd></div>
        <div><dt>Factors</dt><dd>{factors.length ? factors.slice(0, 2).join(" · ") : model.comparable ? "No factor changes" : "Baseline stored locally"}</dd></div>
      </dl>
    </section>
  );
}

export function ConfidenceChangePanel({
  current,
}: {
  current: Omit<StoredConfidenceSnapshot, "version" | "storedAt">;
}) {
  const model: ConfidenceChangeModel = useConfidenceChange(current);

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
