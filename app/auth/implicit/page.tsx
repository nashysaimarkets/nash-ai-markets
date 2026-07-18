"use client";

import { useEffect, useState } from "react";
import { BrandLogo } from "../../components/BrandLogo";
import { createClient } from "../../../utils/supabase/client";

function safeNext(value: string | null) {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/dashboard";
}

export default function CompleteEmailSignIn() {
  const [message, setMessage] = useState("Completing your secure sign-in…");

  useEffect(() => {
    let active = true;

    async function complete() {
      const next = safeNext(new URLSearchParams(window.location.search).get("next"));
      const fragment = new URLSearchParams(window.location.hash.slice(1));
      const accessToken = fragment.get("access_token");
      const refreshToken = fragment.get("refresh_token");

      if (!accessToken || !refreshToken) {
        window.location.replace("/login?error=signin");
        return;
      }

      const supabase = createClient();
      const { error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });

      if (!active) return;
      if (error) {
        setMessage("That sign-in link is invalid or has expired.");
        window.location.replace("/login?error=signin");
        return;
      }

      window.history.replaceState(null, "", window.location.pathname);
      window.location.replace(next);
    }

    void complete();
    return () => { active = false; };
  }, []);

  return <main className="outcome loginPage"><div className="outcomeCard loginCard"><BrandLogo /><p className="kicker">SECURE ACCESS</p><h1>Signing you in.</h1><p role="status">{message}</p></div></main>;
}
