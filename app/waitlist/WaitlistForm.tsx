"use client";

import { useState, type FormEvent } from "react";

export function WaitlistForm({ foundingPro = false }: { foundingPro?: boolean }) {
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setMessage("");
    try {
      const response = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, company, source: foundingPro ? "homepage" : "launch-page" }),
      });
      if (!response.ok) {
        setMessage(response.status === 400
          ? "Enter a valid email address."
          : "The waiting list is temporarily unavailable. Please try again.");
        return;
      }
      setEmail("");
      setMessage(foundingPro
        ? "Thank you. Your Founding Pro interest has been recorded. This is not a purchase and does not guarantee a place."
        : "Thank you. Your request has been recorded. Email confirmation is not sent until launch email delivery is configured.");
    } catch {
      setMessage("The waiting list is temporarily unavailable. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return <form className="waitlistForm" onSubmit={submit}>
    <label htmlFor="waitlist-email">Email address</label>
    <div><input id="waitlist-email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} maxLength={254} required placeholder="you@example.com" /><button type="submit" disabled={submitting}>{submitting ? "Submitting…" : foundingPro ? "Register Founding Pro interest" : "Join the waiting list"}</button></div>
    <label className="waitlistHoneypot" aria-hidden="true">Company<input tabIndex={-1} autoComplete="off" value={company} onChange={(event) => setCompany(event.target.value)} /></label>
    <small>{foundingPro ? "Interest only. No payment, guaranteed place, or automatic subscription." : "Launch updates only. No guaranteed invitation, artificial deadline, or automatic subscription."}</small>
    <span role="status" aria-live="polite">{message}</span>
  </form>;
}
