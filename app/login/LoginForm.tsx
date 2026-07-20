"use client";

import { FormEvent, useState } from "react";
import { createClient } from "../../utils/supabase/client";

export default function LoginForm() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"success" | "error" | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    setMessageTone(null);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          shouldCreateUser: true,
          emailRedirectTo: `${window.location.origin}/auth/callback?next=/dashboard`,
        },
      });
      setMessageTone(error ? "error" : "success");
      setMessage(error ? "We could not request a sign-in link. Check the address and try again." : "Request accepted. Check your inbox and junk folder; delivery may take a few minutes.");
    } catch {
      setMessageTone("error");
      setMessage("The sign-in service is temporarily unavailable. Please try again.");
    } finally {
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
      <button type="submit" disabled={loading} aria-busy={loading}>
        <span>{loading ? "Sending secure link…" : "Email me a secure sign-in link"}</span>
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
