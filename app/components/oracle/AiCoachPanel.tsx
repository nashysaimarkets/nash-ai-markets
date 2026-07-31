"use client";

import { useEffect, useState } from "react";
import { StatusIcon } from "../StatusIcon.tsx";

const COACH_STORAGE_KEY = "nash-ai-coach-open-v1";

type AiCoachPanelProps = {
  notes: string[];
  sessionLabel: string;
};

/** Persistent collapsible coach — calm, educational, never sensational. */
export function AiCoachPanel({ notes, sessionLabel }: AiCoachPanelProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      setOpen(window.localStorage.getItem(COACH_STORAGE_KEY) === "1");
    } catch {
      setOpen(false);
    }
  }, []);

  function toggle() {
    setOpen((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(COACH_STORAGE_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
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
