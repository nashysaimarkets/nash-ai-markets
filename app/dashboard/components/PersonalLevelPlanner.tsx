"use client";

import { useEffect, useState } from "react";

const LEVELS = ["R3", "R2", "R1", "PIVOT", "S1", "S2", "S3"] as const;
type LevelName = (typeof LEVELS)[number];
type LevelValues = Record<LevelName, string>;

const STORE_KEY = "nash:personal-level-planner:v1";
const EMPTY = Object.fromEntries(LEVELS.map((level) => [level, ""])) as LevelValues;

function clean(value: string): string {
  const trimmed = value.trim().replaceAll(",", "");
  if (!trimmed) return "";
  const number = Number(trimmed);
  return Number.isFinite(number) && number > 0 ? number.toFixed(2) : "";
}

export function PersonalLevelPlanner() {
  const [values, setValues] = useState<LevelValues>(EMPTY);
  const [message, setMessage] = useState("");

  useEffect(() => {
    // Keep the server/client first render identical, then hydrate this optional
    // device-local convenience after paint without a cascading effect update.
    const timer = window.setTimeout(() => {
      try {
        const stored = JSON.parse(window.localStorage.getItem(STORE_KEY) ?? "null");
        if (!stored || typeof stored !== "object") return;
        const record = stored as Record<string, unknown>;
        setValues(
          Object.fromEntries(
            LEVELS.map((level) => [level, clean(String(record[level] ?? ""))]),
          ) as LevelValues,
        );
      } catch {
        // Device-local convenience only.
      }
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  const save = () => {
    const normalized = Object.fromEntries(LEVELS.map((level) => [level, clean(values[level])])) as LevelValues;
    const invalid = LEVELS.some((level) => values[level].trim() && !normalized[level]);
    if (invalid) {
      setMessage("Use positive numbers only. Invalid entries were not saved.");
      return;
    }
    setValues(normalized);
    try {
      window.localStorage.setItem(STORE_KEY, JSON.stringify(normalized));
    } catch {
      // Still usable without storage.
    }
    setMessage("Personal levels saved on this device.");
  };

  const reset = () => {
    setValues(EMPTY);
    try {
      window.localStorage.removeItem(STORE_KEY);
    } catch {
      // No-op.
    }
    setMessage("Personal levels cleared from this device.");
  };

  return (
    <details className="personalLevelPlanner">
      <summary>
        <span>MY LEVELS</span>
        <strong>R3 → Pivot → S3</strong>
        <small>Optional · private on this device</small>
      </summary>
      <div className="personalLevelPlannerBody">
        <p>Copy reference levels from your own broker or chart. These entries are not verified NASH data and never enter the decision engine.</p>
        <div className="personalLevelGrid">
          {LEVELS.map((level) => (
            <label
              key={level}
              className={level.startsWith("R") ? "is-resistance" : level.startsWith("S") ? "is-support" : "is-pivot"}
            >
              <span>{level}</span>
              <input
                inputMode="decimal"
                value={values[level]}
                onChange={(event) =>
                  setValues((current) => ({ ...current, [level]: event.target.value.slice(0, 14) }))
                }
                placeholder="—"
                aria-label={`${level} personal reference level`}
              />
            </label>
          ))}
        </div>
        <footer>
          <button type="button" onClick={save}>
            Save on this device
          </button>
          <button type="button" onClick={reset}>
            Clear all
          </button>
        </footer>
        <p className="personalLevelStatus" role="status" aria-live="polite">
          {message}
        </p>
      </div>
    </details>
  );
}