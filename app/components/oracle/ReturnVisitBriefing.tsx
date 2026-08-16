"use client";

import { useEffect, useState } from "react";
import {
  buildReturnVisitBriefing,
  clearStoredReturnVisitSnapshot,
  readStoredReturnVisitSnapshot,
  writeStoredReturnVisitSnapshot,
  type ReturnVisitInput,
  type StoredReturnVisitSnapshot,
} from "../../lib/oracle/return-visit-briefing.ts";

let sessionBaseline: StoredReturnVisitSnapshot | null | undefined;
const RETURN_VISIT_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/London",
  weekday: "short",
  hour: "2-digit",
  minute: "2-digit",
});

function readSessionBaseline(): StoredReturnVisitSnapshot | null {
  if (sessionBaseline === undefined) sessionBaseline = readStoredReturnVisitSnapshot();
  return sessionBaseline;
}

function formatStoredAt(value: string | undefined): string {
  if (!value) return "No earlier baseline";
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return "Earlier visit";
  return RETURN_VISIT_FORMATTER.format(new Date(timestamp));
}

export function ReturnVisitBriefing({ current }: { current: ReturnVisitInput }) {
  const {
    capturedAt,
    catalystKey,
    catalystLabel,
    freshness,
    lean,
    marketStatus,
    permission,
    risk,
    sessionLabel,
    sessionPhase,
    verified,
  } = current;
  const [previous, setPrevious] = useState<StoredReturnVisitSnapshot | null | undefined>(undefined);
  const model = previous === undefined ? null : buildReturnVisitBriefing({ previous, current });

  useEffect(() => {
    let cancelled = false;
    const baseline = readSessionBaseline();
    const next = buildReturnVisitBriefing({
      previous: baseline,
      current: {
        capturedAt,
        catalystKey,
        catalystLabel,
        freshness,
        lean,
        marketStatus,
        permission,
        risk,
        sessionLabel,
        sessionPhase,
        verified,
      },
    });

    // Defer device-local hydration until after the effect body so React does not
    // perform a synchronous cascading render during initial client attachment.
    queueMicrotask(() => {
      if (!cancelled) setPrevious(baseline);
    });

    if (verified && marketStatus !== "UNAVAILABLE" && marketStatus !== "PREVIEW") {
      writeStoredReturnVisitSnapshot(next.current);
    }

    return () => {
      cancelled = true;
    };
  }, [
    capturedAt,
    catalystKey,
    catalystLabel,
    freshness,
    lean,
    marketStatus,
    permission,
    risk,
    sessionLabel,
    sessionPhase,
    verified,
  ]);

  const resetBaseline = () => {
    clearStoredReturnVisitSnapshot();
    const next = buildReturnVisitBriefing({ previous: null, current });
    if (current.verified && current.marketStatus !== "UNAVAILABLE" && current.marketStatus !== "PREVIEW") {
      writeStoredReturnVisitSnapshot(next.current);
      sessionBaseline = next.current;
      setPrevious(next.current);
    } else {
      sessionBaseline = null;
      setPrevious(null);
    }
  };

  if (!model) {
    return (
      <section className="dashChangeStrip dashReturnBriefing is-baseline" aria-labelledby="return-briefing-title">
        <div>
          <span>WHAT CHANGED?</span>
          <strong id="return-briefing-title">Checking your device-local verified baseline…</strong>
        </div>
        <p>Only non-sensitive display state is compared.</p>
      </section>
    );
  }

  const headlineChanges = model.changes.slice(0, 2).map((change) => change.label).join(" · ");
  return (
    <section
      className={`dashChangeStrip dashReturnBriefing is-${model.status}`}
      aria-labelledby="return-briefing-title"
    >
      <div>
        <span>WHAT CHANGED SINCE MY LAST VISIT?</span>
        <strong id="return-briefing-title" aria-live="polite">{model.title}</strong>
        <p>{model.message}</p>
      </div>
      <dl>
        <div>
          <dt>Previous verified visit</dt>
          <dd>{formatStoredAt(model.previous?.storedAt)}</dd>
        </div>
        <div>
          <dt>Current session</dt>
          <dd>{model.current.sessionLabel}</dd>
        </div>
        <div>
          <dt>Material changes</dt>
          <dd>{headlineChanges || (model.comparable ? "None detected" : "Baseline only")}</dd>
        </div>
      </dl>
      {model.changes.length ? (
        <details>
          <summary>Review all changes</summary>
          <ul>
            {model.changes.map((change) => (
              <li key={change.id}>
                <strong>{change.label}</strong>
                <span>{change.previous} → {change.current}</span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
      <footer>
        <span>Stored only in this browser. It never changes verified evidence or the decision engine.</span>
        <button type="button" onClick={resetBaseline}>Reset baseline</button>
      </footer>
    </section>
  );
}
