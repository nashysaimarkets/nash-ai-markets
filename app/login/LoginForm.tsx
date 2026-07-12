"use client";

import { FormEvent, useState } from "react";
import { createClient } from "../../utils/supabase/client";

export default function LoginForm({ supabaseUrl, supabaseKey }: { supabaseUrl: string; supabaseKey: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault(); setLoading(true); setMessage("");
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setMessage("We couldn't sign you in. Check your membership email and password, or contact support.");
    else window.location.assign("/terminal");
    setLoading(false);
  }

  return <form className="loginForm" onSubmit={submit}>
    <label htmlFor="email">MEMBERSHIP EMAIL</label>
    <input id="email" type="email" value={email} onChange={(e)=>setEmail(e.target.value)} placeholder="you@example.com" required />
    <label htmlFor="password">PASSWORD</label>
    <input id="password" type="password" value={password} onChange={(e)=>setPassword(e.target.value)} placeholder="Your member password" minLength={8} required />
    <button className="primary" type="submit" disabled={loading}>{loading ? "Signing in…" : "Sign in to the Terminal"}<span>↗</span></button>
    {message && <p className="loginMessage" role="status">{message}</p>}
  </form>;
}
