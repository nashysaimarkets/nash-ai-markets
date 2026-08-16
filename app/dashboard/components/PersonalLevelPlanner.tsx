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
  const [messageTone, setMessageTone] = useState<"error" | "status">("status");
  const [invalidLevels, setInvalidLevels] = useState<LevelName[]>([]);
  const [confirmReset, setConfirmReset] = useState(false);

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
    const invalid = LEVELS.filter((level) => values[level].trim() && !normalized[level]);
    if (invalid.length) {
      setInvalidLevels(invalid);
      setMessageTone("error");
      setMessage(`Use positive numbers only for ${invalid.join(", ")}. Invalid entries were not saved.`);
      return;
    }
    setValues(normalized);
    setInvalidLevels([]);
    setConfirmReset(false);
    setMessageTone("status");
    try {
      window.localStorage.setItem(STORE_KEY, JSON.stringify(normalized));
      setMessage("Personal levels saved on this device.");
    } catch {
      setMessage("Device storage is unavailable. Your levels remain on this screen only.");
    }
  };

  const reset = () => {
    setValues(EMPTY);
    setInvalidLevels([]);
    setConfirmReset(false);
    setMessageTone("status");
    try {
      window.localStorage.removeItem(STORE_KEY);
      setMessage("Personal levels cleared from this device.");
    } catch {
      setMessage("The fields are clear, but device storage could not be updated.");
    }
  };

  const requestReset = () => {
    if (!LEVELS.some((level) => values[level].trim())) {
      setMessageTone("status");
      setMessage("There are no personal levels to clear.");
      return;
    }
    setConfirmReset(true);
    setMessageTone("status");
    setMessage("Confirm clear to remove every personal level stored on this device.");
  };

  const keepLevels = () => {
    setConfirmReset(false);
    setMessageTone("status");
    setMessage("Personal levels kept.");
  };

  return (
    <details className="personalLevelPlanner">
      <summary>
        <span>MY LEVELS</span>
        <strong>R3 → Pivot → S3</strong>
        <small>Optional · private on this device</small>
      </summary>
      <div className="personalLevelPlannerBody">
        <p id="personal-level-guidance">Copy reference levels from your own broker or chart. These entries are not verified NASH data and never enter the decision engine.</p>
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
                onChange={(event) => {
                  setValues((current) => ({ ...current, [level]: event.target.value.slice(0, 14) }));
                  setInvalidLevels((current) => current.filter((item) => item !== level));
                  setConfirmReset(false);
                }}
                placeholder="—"
                aria-label={`${level} personal reference level`}
                aria-invalid={invalidLevels.includes(level) || undefined}
                aria-describedby="personal-level-guidance personal-level-status"
              />
            </label>
          ))}
        </div>
        <footer>
          <button type="button" onClick={save}>
            Save on this device
          </button>
          {confirmReset ? (
            <div className="personalLevelConfirm" role="group" aria-label="Confirm clearing personal levels">
              <button type="button" className="is-danger" onClick={reset}>Confirm clear</button>
              <button type="button" onClick={keepLevels}>Keep levels</button>
            </div>
          ) : (
            <button type="button" onClick={requestReset}>Clear all</button>
          )}
        </footer>
        <p
          className="personalLevelStatus"
          id="personal-level-status"
          role={messageTone === "error" ? "alert" : "status"}
          aria-live="polite"
        >
          {message}
        </p>
      </div>
    </details>
  );
}
