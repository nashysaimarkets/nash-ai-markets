"use client";

import { useEffect, useState } from "react";
import {
  createChallengeShareText,
  createEmptySessionChallenge,
  parseSessionChallenge,
  recordChallengeSession,
  SESSION_CHALLENGE_SIZE,
  SESSION_CHALLENGE_STORAGE_KEY,
  type SessionChallengeProgress,
} from "../lib/session-challenge.ts";

type SessionChallengeProps = {
  score: number;
  touched: boolean;
  onRecorded: () => void;
};

function localDateKey(now: Date): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function displayDate(value: string): string {
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

export function SessionChallenge({ score, touched, onRecorded }: SessionChallengeProps) {
  const [progress, setProgress] = useState<SessionChallengeProgress>(() => createEmptySessionChallenge());
  const [hydrated, setHydrated] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [status, setStatus] = useState("Challenge progress is stored only in this browser.");
  const completed = progress.sessions.length;
  const isComplete = completed === SESSION_CHALLENGE_SIZE;

  useEffect(() => {
    let cancelled = false;
    let restored = createEmptySessionChallenge();
    let restoredStatus = "Challenge ready. No session has been recorded yet.";

    try {
      restored = parseSessionChallenge(window.localStorage.getItem(SESSION_CHALLENGE_STORAGE_KEY));
      restoredStatus = restored.sessions.length > 0
        ? `Restored ${restored.sessions.length} of ${SESSION_CHALLENGE_SIZE} locally saved sessions.`
        : "Challenge ready. No session has been recorded yet.";
    } catch {
      restoredStatus = "Browser storage is unavailable. Progress will last only for this visit.";
    }

    // Device-local hydration is intentionally deferred so the effect does not
    // synchronously cascade a second render while React is attaching the client.
    queueMicrotask(() => {
      if (cancelled) return;
      setProgress(restored);
      setStatus(restoredStatus);
      setHydrated(true);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  function saveProgress(next: SessionChallengeProgress): boolean {
    try {
      window.localStorage.setItem(SESSION_CHALLENGE_STORAGE_KEY, JSON.stringify(next));
      return true;
    } catch {
      return false;
    }
  }

  function recordSession() {
    if (!touched || isComplete) return;
    const result = recordChallengeSession(progress, { date: localDateKey(new Date()), score });
    if (result.outcome === "duplicate") {
      setStatus("Today's session is already recorded. Return for the next session rather than inflating the streak.");
      return;
    }
    if (result.outcome === "complete") {
      setStatus("Five-session foundation already complete. Keep reviewing without chasing a higher badge.");
      return;
    }

    const persisted = saveProgress(result.progress);
    setProgress(result.progress);
    setConfirmReset(false);
    onRecorded();
    setStatus(persisted
      ? `Session ${result.progress.sessions.length} of ${SESSION_CHALLENGE_SIZE} saved on this device. Checklist reset for the next session.`
      : `Session ${result.progress.sessions.length} recorded for this visit. Browser storage did not allow permanent saving.`);
  }

  async function shareProgress() {
    const text = createChallengeShareText(completed);
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ title: "Bullseye First 5 Sessions", text });
        setStatus("Share sheet opened. No dates, scores, account data or preview link were included.");
        return;
      }
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(text);
        setStatus("Challenge progress copied. No dates, scores or private link were included.");
        return;
      }
      setStatus("Sharing is unavailable in this browser.");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        setStatus("Sharing cancelled. Your local progress was not changed.");
        return;
      }
      setStatus("Sharing was unavailable. Your local progress was not changed.");
    }
  }

  function resetChallenge() {
    try {
      window.localStorage.removeItem(SESSION_CHALLENGE_STORAGE_KEY);
    } catch {
      // The in-memory reset still succeeds when browser storage is unavailable.
    }
    setProgress(createEmptySessionChallenge());
    setConfirmReset(false);
    setStatus("Five-session challenge reset on this device.");
  }

  return (
    <section className="vlChallenge" aria-labelledby="vl-challenge-title">
      <div className="vlChallengeIntro">
        <span className="vlEyebrow">FIRST 5 SESSIONS · DEVICE-LOCAL</span>
        <h3 id="vl-challenge-title">Turn one good check into a repeatable habit.</h3>
        <p>Review the eight gates, record one entry per local calendar day and build a five-session process streak. A streak records preparation—not trading permission or performance.</p>
        <ul>
          <li>Stores only five dates and scores</li>
          <li>Never stores individual answers</li>
          <li>Never sends progress to Bullseye</li>
        </ul>
      </div>

      <div className="vlChallengeProgress">
        <header>
          <div>
            <span>SESSIONS REVIEWED</span>
            <strong>{hydrated ? completed : "–"}<small>/{SESSION_CHALLENGE_SIZE}</small></strong>
          </div>
          <b>{isComplete ? "Five-session foundation complete" : "Process habit in progress"}</b>
        </header>

        <ol aria-label={`${completed} of ${SESSION_CHALLENGE_SIZE} sessions recorded`}>
          {Array.from({ length: SESSION_CHALLENGE_SIZE }, (_, index) => {
            const session = progress.sessions[index];
            return (
              <li key={index} className={session ? "is-recorded" : undefined}>
                <span>{session ? "✓" : index + 1}</span>
                <div>
                  <b>Session {index + 1}</b>
                  <small>{session ? `${displayDate(session.date)} · ${session.score}/8 process gates` : "Not recorded"}</small>
                </div>
              </li>
            );
          })}
        </ol>

        <div className="vlChallengeActions">
          <button type="button" onClick={recordSession} disabled={!hydrated || !touched || isComplete}>Record this session</button>
          <button type="button" onClick={shareProgress} disabled={!hydrated || completed === 0}>Share X/5 progress</button>
          {!confirmReset ? (
            <button type="button" className="is-secondary" onClick={() => setConfirmReset(true)} disabled={!hydrated || completed === 0}>Reset challenge</button>
          ) : (
            <div className="vlChallengeConfirm" role="group" aria-label="Confirm challenge reset">
              <button type="button" className="is-danger" onClick={resetChallenge}>Confirm reset</button>
              <button type="button" className="is-secondary" onClick={() => setConfirmReset(false)}>Keep progress</button>
            </div>
          )}
        </div>
        <p className="vlScoreStatus" role="status" aria-live="polite">{status}</p>
      </div>
    </section>
  );
}
