"use client";

import { useEffect, useState } from "react";
import { createClient } from "../../../utils/supabase/client";
import {
  AUTH_NEXT_COOKIE,
  defaultPostAuthPath,
  safeAuthNextPath,
} from "../../lib/auth/safe-auth-redirect";

const EMAIL_OTP_TYPES = new Set([
  "email",
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email_change",
]);

function readAuthNextCookie(): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${AUTH_NEXT_COOKIE}=([^;]*)`));
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

function clearAuthNextCookie() {
  document.cookie = `${AUTH_NEXT_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
}

function fail(reason: string) {
  window.location.replace(`/login?error=signin&reason=${encodeURIComponent(reason)}`);
}

/**
 * Complete passwordless sign-in in the browser so the PKCE code verifier cookie
 * set during signInWithOtp is available for exchangeCodeForSession.
 */
export default function AuthCallbackPage() {
  const [message, setMessage] = useState("Completing your secure sign-in…");

  useEffect(() => {
    let active = true;

    async function complete() {
      const origin = window.location.origin;
      const params = new URLSearchParams(window.location.search);
      const hash = new URLSearchParams(window.location.hash.slice(1));
      const next = safeAuthNextPath(
        params.get("next") ?? readAuthNextCookie(),
        defaultPostAuthPath(origin),
      );
      clearAuthNextCookie();

      const code = params.get("code");
      const tokenHash = params.get("token_hash");
      const type = params.get("type");
      const accessToken = hash.get("access_token");
      const refreshToken = hash.get("refresh_token");

      try {
        const supabase = createClient();

        if (code) {
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);
          if (!active) return;
          if (error || !data.session) {
            const reason = error?.code === "otp_expired"
              ? "expired"
              : error?.message?.toLowerCase().includes("verifier")
                ? "verifier"
                : "exchange";
            fail(reason);
            return;
          }
          window.history.replaceState(null, "", window.location.pathname);
          window.location.replace(next);
          return;
        }

        if (tokenHash && type && EMAIL_OTP_TYPES.has(type)) {
          const { data, error } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: type as "magiclink" | "email" | "signup" | "invite" | "recovery" | "email_change",
          });
          if (!active) return;
          if (error || !data.session) {
            fail(error?.code === "otp_expired" ? "expired" : "verify");
            return;
          }
          window.history.replaceState(null, "", window.location.pathname);
          window.location.replace(next);
          return;
        }

        if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (!active) return;
          if (error) {
            fail("session");
            return;
          }
          window.history.replaceState(null, "", window.location.pathname);
          window.location.replace(next);
          return;
        }

        fail("missing");
      } catch {
        if (active) fail("unavailable");
      }
    }

    void complete();
    return () => { active = false; };
  }, []);

  return (
    <main className="outcome loginPage">
      <div className="outcomeCard loginCard">
        <p className="kicker">SECURE ACCESS</p>
        <h1>Signing you in.</h1>
        <p role="status">{message}</p>
      </div>
    </main>
  );
}
