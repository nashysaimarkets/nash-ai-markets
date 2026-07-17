"use client";

import { FormEvent, useState } from "react";
import { createClient } from "../../utils/supabase/client";

export default function LoginForm() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault(); setLoading(true); setMessage("");
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          shouldCreateUser: true,
          emailRedirectTo: `${window.location.origin}/auth/callback?next=/dashboard`,
        },
      });
      setMessage(error ? "We could not send a sign-in link. Check the address and try again." : "Check your email for your secure sign-in link.");
    } catch {
      setMessage("The sign-in service is temporarily unavailable. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return <form className="loginForm" onSubmit={submit}>
    <label htmlFor="email">MEMBERSHIP EMAIL</label>
    <input id="email" name="email" type="email" autoComplete="email" inputMode="email" value={email} onChange={(e)=>setEmail(e.target.value)} placeholder="you@example.com" required />
    <button className="primary" type="submit" disabled={loading}>{loading ? "Sending…" : "Email me a secure login link"}<span>↗</span></button>
    {message && <p className="loginMessage" role="status">{message}</p>}
  </form>;
}
