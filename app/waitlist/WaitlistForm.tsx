"use client";

import { useState, type FormEvent } from "react";

export function WaitlistForm({ foundingPro = false, pocketFounding = false }: { foundingPro?: boolean; pocketFounding?: boolean }) {
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"error" | "success" | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setMessage("");
    setMessageTone(null);
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 12_000);
    try {
      const response = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ email, company, source: pocketFounding ? "pocket-founding" : foundingPro ? "homepage" : "launch-page" }),
        signal: controller.signal,
      });
      if (!response.ok) {
        setMessageTone("error");
        setMessage(response.status === 400
          ? "Enter a valid email address."
          : "The waiting list is temporarily unavailable. Nothing was charged; please try again later.");
        return;
      }
      setEmail("");
      setMessageTone("success");
      setMessage(pocketFounding
        ? "You’re on the Pocket Bullseye founding list. No payment has been taken; we’ll contact you when secure checkout opens."
        : foundingPro
        ? "Thank you. Your Founding Pro interest has been recorded. This is not a purchase and does not guarantee a place."
        : "Thank you. Your request has been recorded. Email confirmation is not sent until launch email delivery is configured.");
    } catch {
      setMessageTone("error");
      setMessage("The waiting list did not respond. No payment or membership change was made; please try again later.");
    } finally {
      window.clearTimeout(timeout);
      setSubmitting(false);
    }
  }

  return <form className="waitlistForm" onSubmit={submit} aria-busy={submitting}>
    <label htmlFor="waitlist-email">Email address</label>
    <div><input id="waitlist-email" name="email" type="email" inputMode="email" enterKeyHint="send" autoComplete="email" autoCapitalize="none" spellCheck={false} value={email} onChange={(event) => setEmail(event.target.value)} maxLength={254} required placeholder="you@example.com" aria-describedby="waitlist-guidance waitlist-status" /><button type="submit" disabled={submitting} aria-busy={submitting}>{submitting ? "Submitting…" : pocketFounding ? "Join the first 650" : foundingPro ? "Register Founding Pro interest" : "Join the waiting list"}</button></div>
    <label className="waitlistHoneypot" aria-hidden="true">Company<input tabIndex={-1} autoComplete="off" value={company} onChange={(event) => setCompany(event.target.value)} /></label>
    <small id="waitlist-guidance">{pocketFounding ? "Interest only. No card details or automatic billing. The £4.99 price lock begins only after a verified successful subscription." : foundingPro ? "Interest only. No payment, guaranteed place, or automatic subscription. You can opt out of launch communication at any time." : "Launch updates only. No guaranteed invitation, artificial deadline, or automatic subscription. You can opt out at any time."}</small>
    <span id="waitlist-status" data-tone={messageTone ?? undefined} role={messageTone === "error" ? "alert" : "status"} aria-live={messageTone === "error" ? "assertive" : "polite"} aria-atomic="true">{message}</span>
  </form>;
}
