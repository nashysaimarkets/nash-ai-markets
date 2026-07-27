"use client";

import { useState } from "react";

type DecisionChoice = {
  label: string;
  direction: "long" | "short" | "neutral";
  reason: string;
};

const choices: DecisionChoice[] = [
  { label: "Prepare bullish", direction: "long", reason: "Prepared the bullish path from Today." },
  { label: "Prepare bearish", direction: "short", reason: "Prepared the bearish path from Today." },
  { label: "Stand aside", direction: "neutral", reason: "Chose to stand aside from Today." },
];

export function DecisionCapture({ posture }: { posture: string }) {
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);

  async function capture(choice: DecisionChoice) {
    if (saving || saved) return;
    setSaving(choice.direction);
    setMessage("");
    setError(false);
    try {
      const response = await fetch("/api/journal", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          tradedAt: new Date().toISOString(),
          instrumentClass: "futures",
          underlying: "ES",
          direction: choice.direction,
          reason: choice.reason,
          notes: `Today posture at capture: ${posture}`,
        }),
      });
      const payload = await response.json().catch(() => ({})) as { message?: string };
      if (!response.ok) {
        setError(true);
        setMessage(payload.message ?? "The decision could not be saved.");
        return;
      }
      setSaved(choice.direction);
      setMessage(`${choice.label} saved privately.`);
    } catch {
      setError(true);
      setMessage("The decision could not be saved.");
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="decisionCapture">
      <span>One-click decision capture</span>
      <strong>What are you preparing?</strong>
      <div>
        {choices.map((choice) => (
          <button
            key={choice.direction}
            type="button"
            disabled={Boolean(saving || saved)}
            data-choice={choice.direction}
            data-selected={saved === choice.direction}
            onClick={() => capture(choice)}
          >
            {saving === choice.direction ? "Saving…" : choice.label}
          </button>
        ))}
      </div>
      <small role={error ? "alert" : "status"} aria-live="polite" data-error={error}>{message}</small>
      <em>Records the decision only—never a fill, position or result.</em>
    </div>
  );
}
