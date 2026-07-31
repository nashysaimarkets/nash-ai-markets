"use client";

import { useSyncExternalStore } from "react";
import { StatusIcon } from "../StatusIcon.tsx";

const COACH_STORAGE_KEY = "nash-ai-coach-open-v1";
const COACH_CHANGE_EVENT = "nash-ai-coach-change";

/**
 * Read through an external store rather than an effect, so the persisted state
 * is present on the first client paint instead of flashing closed then open.
 */
const coachStore = {
  subscribe(onChange: () => void) {
    window.addEventListener(COACH_CHANGE_EVENT, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(COACH_CHANGE_EVENT, onChange);
      window.removeEventListener("storage", onChange);
    };
  },
  getSnapshot(): boolean {
    try {
      return window.localStorage.getItem(COACH_STORAGE_KEY) === "1";
    } catch {
      return false;
    }
  },
  // The server cannot know a member's stored preference; render collapsed.
  getServerSnapshot(): boolean {
    return false;
  },
  set(next: boolean) {
    try {
      window.localStorage.setItem(COACH_STORAGE_KEY, next ? "1" : "0");
    } catch {
      /* preference persistence is best-effort */
    }
    window.dispatchEvent(new Event(COACH_CHANGE_EVENT));
  },
};

type AiCoachPanelProps = {
  notes: string[];
  sessionLabel: string;
};

/** Persistent collapsible coach — calm, educational, never sensational. */
export function AiCoachPanel({ notes, sessionLabel }: AiCoachPanelProps) {
  const open = useSyncExternalStore(
    coachStore.subscribe,
    coachStore.getSnapshot,
    coachStore.getServerSnapshot,
  );

  function toggle() {
    coachStore.set(!open);
  }

  const lines = notes.filter(Boolean).slice(0, 5);

  return (
    <aside className={`dashAiCoach${open ? " is-open" : ""}`} aria-label="AI coach">
      <button type="button" className="dashAiCoachToggle" onClick={toggle} aria-expanded={open}>
        <StatusIcon name="brief" />
        <span>AI Coach</span>
        <small>{sessionLabel}</small>
      </button>
      {open ? (
        <div className="dashAiCoachBody">
          <p className="dashAiCoachLead">Calm process notes from today’s verified context — not trade calls.</p>
          <ul>
            {lines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <p className="dashAiCoachFoot">Educational commentary only. Protect capital first.</p>
        </div>
      ) : null}
    </aside>
  );
}
