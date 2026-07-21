"use client";

import { FormEvent, useEffect, useState } from "react";
import { createClient } from "../../utils/supabase/client";
import {
  buildEmailRedirectTo,
  defaultPostAuthPath,
  safeAuthNextPath,
} from "../lib/auth/safe-auth-redirect";

export default function LoginForm() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"success" | "error" | null>(null);
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown(cooldown - 1), 1_000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (loading || cooldown > 0) return;
    setLoading(true);
    setMessage("");
    setMessageTone(null);
    try {
      const supabase = createClient();
      const origin = window.location.origin;
      const requestedNext = new URLSearchParams(window.location.search).get("next");
      const next = safeAuthNextPath(requestedNext, defaultPostAuthPath(origin));
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          shouldCreateUser: true,
          emailRedirectTo: buildEmailRedirectTo(origin, next),
        },
      });
      setMessageTone(error ? "error" : "success");
      setMessage(error ? "We could not request a sign-in link. Delivery may be temporarily delayed; wait for the retry timer, then try again." : "Request accepted. Delivery may take a few minutes. Check your inbox and junk folder, then retry safely when the timer ends if nothing arrives.");
    } catch {
      setMessageTone("error");
      setMessage("The sign-in service is temporarily unavailable. Wait for the retry timer, then try again.");
    } finally {
      setCooldown(60);
      setLoading(false);
    }
  }

  return (
    <form className="accessForm" onSubmit={submit}>
      <label htmlFor="email">Membership email</label>
      <div className="accessInputWrap">
        <span aria-hidden="true">@</span>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          aria-describedby="email-guidance"
          maxLength={254}
          required
        />
      </div>
      <p id="email-guidance">Use the same address you used for your NASH AI membership.</p>
      <button type="submit" disabled={loading || cooldown > 0} aria-busy={loading}>
        <span>{loading ? "Requesting secure link…" : cooldown > 0 ? `Retry available in ${cooldown}s` : "Email me a secure sign-in link"}</span>
        <i aria-hidden="true">↗</i>
      </button>
      {message && (
        <p className="accessMessage" data-tone={messageTone} role={messageTone === "error" ? "alert" : "status"}>
          <i aria-hidden="true">{messageTone === "success" ? "✓" : "!"}</i>
          {message}
        </p>
      )}
      <small>For your security, sign-in links expire and can only be used once.</small>
    </form>
  );
}
