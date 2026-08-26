"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "../../utils/supabase/client";
import {
  AUTH_NEXT_COOKIE,
  buildEmailRedirectTo,
  defaultPostAuthPath,
  isAllowedAuthOrigin,
  isAuthProviderCompatibleWithOrigin,
  safeAuthNextPath,
} from "../lib/auth/safe-auth-redirect";
import { LOGIN_STING_PENDING_KEY } from "../components/BullseyeLoginSting";

function resolveLoginRedirectTo(origin: string, search: string): { emailRedirectTo: string; next: string } {
  if (!isAllowedAuthOrigin(origin)) {
    throw new Error("Untrusted login origin");
  }
  const requestedNext = new URLSearchParams(search).get("next");
  const next = safeAuthNextPath(requestedNext, defaultPostAuthPath(origin));
  return { emailRedirectTo: buildEmailRedirectTo(origin, next), next };
}

function persistAuthNextCookie(next: string) {
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${AUTH_NEXT_COOKIE}=${encodeURIComponent(next)}; Path=/; Max-Age=900; SameSite=Lax${secure}`;
}

function messageForSignInError(reason: string | null): string {
  switch (reason) {
    case "expired":
      return "That sign-in link has expired. Request a new secure link below.";
    case "verifier":
      return "Open the sign-in link in the same browser where you requested it, then try again.";
    case "missing":
      return "That sign-in link was incomplete. Request a new secure link below.";
    case "exchange":
    case "verify":
    case "session":
    case "unavailable":
    case "signin":
    default:
      return "Sign-in could not be completed. Request a new secure link below and open it in this browser.";
  }
}

function messageForOtpRequestError(error: { code?: string; message?: string; status?: number }): string {
  const code = error.code?.toLowerCase() ?? "";
  const message = error.message?.toLowerCase() ?? "";
  if (error.status === 429 || code === "over_email_send_rate_limit" || message.includes("rate limit")) {
    return "The secure-email limit has been reached. Do not retry yet; wait for the email provider window to reset, then request one new link in the browser where you will open it.";
  }
  if (error.status === 0 || message.includes("failed to fetch")) {
    return "We could not reach the sign-in service. The Auth host may be misconfigured; wait for the retry timer, then try again.";
  }
  return "We could not request a sign-in link. Delivery may be temporarily delayed; wait for the retry timer, then try again.";
}

type StagingLoginFormProps = {
  supabaseUrl: string;
  supabasePublishableKey: string;
};

export default function StagingLoginForm({
  supabaseUrl,
  supabasePublishableKey,
}: StagingLoginFormProps) {
  const searchParams = useSearchParams();
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

  // Derived from the URL during render rather than in an effect, so the reason
  // is shown on the first paint instead of flashing an empty form first.
  const signInReason =
    searchParams.get("error") === "signin" ? searchParams.get("reason") ?? "signin" : null;
  const [shownSignInReason, setShownSignInReason] = useState<string | null>(null);
  if (signInReason !== null && signInReason !== shownSignInReason) {
    setShownSignInReason(signInReason);
    setMessageTone("error");
    setMessage(messageForSignInError(signInReason));
  }

  // Publish the planned emailRedirectTo on the form for deployment inspection (no submit).
  useEffect(() => {
    const form = formRef.current;
    if (!form) return;
    try {
      if (!isAuthProviderCompatibleWithOrigin(window.location.origin, supabaseUrl)) {
        throw new Error("Private authentication provider mismatch");
      }
      const { emailRedirectTo, next } = resolveLoginRedirectTo(
        window.location.origin,
        window.location.search,
      );
      form.setAttribute("data-email-redirect-to", emailRedirectTo);
      form.setAttribute("data-auth-next", next);
      form.setAttribute("data-auth-redirect-ready", "true");
      form.setAttribute(
        "data-auth-uses-www",
        /nashaimarkets\.com/i.test(emailRedirectTo) ? "true" : "false",
      );
      form.setAttribute(
        "data-auth-path-only",
        emailRedirectTo.includes("?") ? "false" : "true",
      );
      form.setAttribute(
        "data-auth-next-terminal",
        next === "/terminal" ? "true" : "false",
      );
    } catch {
      form.setAttribute("data-auth-redirect-ready", "false");
      form.removeAttribute("data-email-redirect-to");
    }
  }, [supabaseUrl]);

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
      if (!isAuthProviderCompatibleWithOrigin(origin, supabaseUrl)) {
        setMessageTone("error");
        setMessage("Private test authentication is unavailable. No sign-in email was sent.");
        formRef.current?.setAttribute("data-auth-provider-ready", "false");
        return;
      }
      formRef.current?.setAttribute("data-auth-provider-ready", "true");
      const { emailRedirectTo, next } = resolveLoginRedirectTo(origin, window.location.search);
      persistAuthNextCookie(next);
      formRef.current?.setAttribute("data-email-redirect-to", emailRedirectTo);
      formRef.current?.setAttribute("data-auth-next", next);
      const supabase = createClient({ url: supabaseUrl, key: supabasePublishableKey });
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          shouldCreateUser: true,
          emailRedirectTo,
        },
      });
      // Persist only non-sensitive Auth status metadata for support diagnostics.
      const form = formRef.current;
      if (form) {
        const statusCode = error && typeof error.status === "number" ? error.status : null;
        const networkFailure = statusCode === 0 || error?.message?.toLowerCase().includes("failed to fetch");
        form.setAttribute("data-otp-status", error ? "error" : "ok");
        form.setAttribute("data-otp-error-status", statusCode != null ? String(statusCode) : "");
        form.setAttribute(
          "data-otp-error-code",
          networkFailure
            ? "network_unreachable"
            : error?.code
              ? String(error.code).slice(0, 64)
              : "",
        );
      }
      setMessageTone(error ? "error" : "success");
      if (!error) {
        try {
          window.localStorage.setItem(LOGIN_STING_PENDING_KEY, String(Date.now()));
        } catch {
          // The optional login sting never blocks authentication.
        }
      }
      setMessage(
        error
          ? messageForOtpRequestError(error)
          : "Request accepted. Delivery may take a few minutes. Check your inbox and junk folder, then open the link in this same browser.",
      );
    } catch {
      formRef.current?.setAttribute("data-otp-status", "unavailable");
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
      <small>For your security, sign-in links expire and can only be used once. Open the link in the same browser that requested it.</small>
    </form>
  );
}
