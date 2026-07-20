"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const storageKey = "bullseye-elite-onboarding-v1";
const steps = [
  { label: "Review today’s decision context", copy: "Start with freshness, confidence and the principal risk.", href: "#todays-edge-title" },
  { label: "Read the conditional plan", copy: "Compare confirmation, invalidation and no-trade conditions.", href: "#todays-plan-title" },
  { label: "Open the full terminal", copy: "Inspect the evidence and provider labels behind the summary.", href: "/terminal" },
] as const;

export function EliteOnboardingChecklist() {
  const [completed, setCompleted] = useState<boolean[]>([false, false, false]);
  const [ready, setReady] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const stored = window.localStorage.getItem(storageKey);
        if (stored) {
          const parsed = JSON.parse(stored) as { completed?: boolean[]; dismissed?: boolean };
          if (Array.isArray(parsed.completed) && parsed.completed.length === steps.length) setCompleted(parsed.completed);
          setDismissed(Boolean(parsed.dismissed));
        }
      } catch {
        // Local preferences are optional; the checklist remains usable without storage.
      }
      setReady(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  function persist(nextCompleted: boolean[], nextDismissed = dismissed) {
    setCompleted(nextCompleted);
    setDismissed(nextDismissed);
    try {
      window.localStorage.setItem(storageKey, JSON.stringify({ completed: nextCompleted, dismissed: nextDismissed }));
    } catch {
      // A blocked storage API must not interrupt the dashboard.
    }
  }

  if (!ready || dismissed) return null;
  const count = completed.filter(Boolean).length;

  return (
    <section className="eliteOnboarding" aria-labelledby="elite-onboarding-title">
      <header>
        <div><span>ELITE QUICK START</span><h2 id="elite-onboarding-title">Build your first Bullseye routine</h2><p>{count} of {steps.length} steps complete · saved on this device only</p></div>
        <button type="button" onClick={() => persist(completed, true)} aria-label="Dismiss Elite quick-start checklist">Dismiss</button>
      </header>
      <ol>
        {steps.map((step, index) => (
          <li key={step.label} data-complete={completed[index]}>
            <button
              type="button"
              aria-label={`${completed[index] ? "Mark incomplete" : "Mark complete"}: ${step.label}`}
              aria-pressed={completed[index]}
              onClick={() => persist(completed.map((value, itemIndex) => itemIndex === index ? !value : value))}
            >
              <span aria-hidden="true">{completed[index] ? "✓" : `0${index + 1}`}</span>
            </button>
            <div><strong>{step.label}</strong><p>{step.copy}</p></div>
            <Link href={step.href} onClick={() => persist(completed.map((value, itemIndex) => itemIndex === index ? true : value))}>Open <span aria-hidden="true">→</span></Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
