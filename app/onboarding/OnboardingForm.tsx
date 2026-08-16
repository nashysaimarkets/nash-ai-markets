"use client";

import { useMemo, useState } from "react";
import type { OnboardingPreferences } from "../lib/onboarding.ts";

type OnboardingFormProps = {
  initialPreferences?: OnboardingPreferences | null;
  updating?: boolean;
};

export function OnboardingForm({ initialPreferences = null, updating = false }: OnboardingFormProps) {
  const redirectTo = updating ? "/profile?preferences=updated" : "/dashboard";
  const [experience, setExperience] = useState(initialPreferences?.experience ?? "");
  const [interests, setInterests] = useState<string[]>(initialPreferences?.interests ?? []);
  const [notifications, setNotifications] = useState(initialPreferences?.notifications ?? "");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const progress = useMemo(() => [experience, interests.length ? "yes" : "", notifications].filter(Boolean).length, [experience, interests, notifications]);
  const toggle = (interest: string) => setInterests((current) => current.includes(interest) ? current.filter((item) => item !== interest) : [...current, interest]);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true); setMessage("");
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 12_000);
    try {
      const response = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ experience, interests, notifications, redirectTo }),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error("unavailable");
      const result = await response.json() as { redirectTo?: string };
      window.location.replace(result.redirectTo ?? redirectTo);
    } catch {
      setMessage("Your preferences could not be saved. Nothing was lost—please check your connection and try again.");
    } finally {
      window.clearTimeout(timeout);
      setSubmitting(false);
    }
  }
  return <form className="onboardingForm" action="/api/onboarding" method="post" onSubmit={submit}>
    <input type="hidden" name="redirectTo" value={redirectTo} />
    <div className="onboardingProgress" aria-label={`${progress} of 3 steps complete`}><span style={{ width: `${(progress / 3) * 100}%` }} /><b>{progress}/3 complete</b></div>
    <fieldset><legend>1. Your market experience</legend>{[["new","New to structured market analysis"],["developing","Developing a consistent process"],["experienced","Experienced and refining execution"]].map(([value,label]) => <label key={value}><input type="radio" name="experience" value={value} checked={experience === value} onChange={() => setExperience(value)} />{label}</label>)}</fieldset>
    <fieldset><legend>2. Market interests</legend>{[["futures","Index futures"],["equities","Equities and ETFs"],["macro","Macro and rates"],["volatility","Volatility"]].map(([value,label]) => <label key={value}><input type="checkbox" name="interests" value={value} checked={interests.includes(value)} onChange={() => toggle(value)} />{label}</label>)}</fieldset>
    <fieldset><legend>3. Notification preferences</legend>{[["brief-and-essential","Morning Brief email preference when delivery launches, plus essential account notices"],["essential","Essential account notices only"],["none","No optional notifications"]].map(([value,label]) => <label key={value}><input type="radio" name="notifications" value={value} checked={notifications === value} onChange={() => setNotifications(value)} />{label}</label>)}</fieldset>
    {message ? <p role="alert">{message}</p> : null}
    <button type="submit" disabled={progress < 3 || submitting}>{submitting ? "Saving preferences…" : updating ? "Save workspace preferences" : "Complete setup"}</button>
    <small>Preferences improve product orientation only. Optional Morning Brief email delivery remains off until the sender is verified; recording a preference does not subscribe you to an active daily email. Preferences do not create personalised financial advice or trading recommendations.</small>
  </form>;
}
