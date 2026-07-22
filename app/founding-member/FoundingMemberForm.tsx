"use client";

import { useState, type FormEvent } from "react";

export function FoundingMemberForm() {
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setMessage("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/founding-member", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          primaryGoal: form.get("primaryGoal"),
          experienceLevel: form.get("experienceLevel"),
          preferredSession: form.get("preferredSession"),
          riskAcknowledged: form.get("riskAcknowledged") === "on",
        }),
      });
      if (!response.ok) {
        setMessage(response.status === 400
          ? "Complete every onboarding field and acknowledge the risk notice."
          : response.status === 403
            ? "An active Pro or Elite membership is required."
            : "Onboarding is temporarily unavailable. Please try again.");
        return;
      }
      setMessage("Onboarding submitted for review. Your current membership remains unchanged.");
    } catch {
      setMessage("Onboarding is temporarily unavailable. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return <form className="foundingForm" onSubmit={submit}>
    <fieldset><legend>Primary workflow goal</legend><label><input type="radio" name="primaryGoal" value="market-structure" required /> Market structure</label><label><input type="radio" name="primaryGoal" value="risk-discipline" /> Risk discipline</label><label><input type="radio" name="primaryGoal" value="cross-asset-context" /> Cross-asset context</label></fieldset>
    <fieldset><legend>Experience level</legend><label><input type="radio" name="experienceLevel" value="developing" required /> Developing</label><label><input type="radio" name="experienceLevel" value="experienced" /> Experienced</label><label><input type="radio" name="experienceLevel" value="professional" /> Professional</label></fieldset>
    <label className="foundingSelect">Preferred session<select name="preferredSession" defaultValue="" required><option value="" disabled>Select a session</option><option value="london">London</option><option value="new-york">New York</option><option value="both">Both</option></select></label>
    <label className="foundingRisk"><input type="checkbox" name="riskAcknowledged" required /> I understand that NASH AI Markets provides educational decision support, not personalised financial advice, and that losses remain possible.</label>
    <button type="submit" disabled={submitting}>{submitting ? "Submitting…" : "Submit onboarding"}</button>
    <span role="status" aria-live="polite">{message}</span>
  </form>;
}
