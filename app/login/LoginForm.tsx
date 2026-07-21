"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { createClient } from "../../utils/supabase/client";
import {
  buildEmailRedirectTo,
  defaultPostAuthPath,
  isAllowedAuthOrigin,
  safeAuthNextPath,
} from "../lib/auth/safe-auth-redirect";

function resolveLoginRedirectTo(origin: string, search: string): string {
  if (!isAllowedAuthOrigin(origin)) {
    throw new Error("Untrusted login origin");
  }
  const requestedNext = new URLSearchParams(search).get("next");
  // Defaults to /terminal; never fall back to /dashboard unless explicitly requested.
  const next = safeAuthNextPath(requestedNext, defaultPostAuthPath(origin));
  return buildEmailRedirectTo(origin, next);
}

export default function LoginForm() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"success" | "error" | null>(null);
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown(cooldown - 1), 1_000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  // Publish the planned emailRedirectTo on the form for deployment inspection (no submit).
  useEffect(() => {
    const form = formRef.current;
    if (!form) return;
    try {
      const emailRedirectTo = resolveLoginRedirectTo(window.location.origin, window.location.search);
      form.setAttribute("data-email-redirect-to", emailRedirectTo);
      form.setAttribute("data-auth-redirect-ready", "true");
      form.setAttribute(
        "data-auth-uses-www",
        /nashaimarkets\.com/i.test(emailRedirectTo) ? "true" : "false",
      );
      form.setAttribute(
        "data-auth-next-terminal",
        emailRedirectTo.includes("next=%2Fterminal") ? "true" : "false",
      );
    } catch {
      form.setAttribute("data-auth-redirect-ready", "false");
      form.removeAttribute("data-email-redirect-to");
    }
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (loading || cooldown > 0) return;
    setLoading(true);
    setMessage("");
    setMessageTone(null);
    try {
      const origin = window.location.origin;
      if (!isAllowedAuthOrigin(origin)) {
        setMessageTone("error");
        setMessage("This host is not authorized for member sign-in.");
        return;
      }
      const emailRedirectTo = resolveLoginRedirectTo(origin, window.location.search);
      formRef.current?.setAttribute("data-email-redirect-to", emailRedirectTo);
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          shouldCreateUser: true,
          emailRedirectTo,
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
    <form ref={formRef} className="accessForm" onSubmit={submit} data-auth-redirect-ready="false">
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
