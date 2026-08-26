import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import LoginForm from "./StagingLoginForm";
import { BrandLogo } from "../components/BrandLogo";
import { createClient } from "../../utils/supabase/server";
import { resolveSupabasePublicConfig } from "../../utils/supabase/config";

export const metadata: Metadata = {
  title: "Secure Member Access",
  description: "Secure passwordless member access to NASH AI Mission Control.",
  robots: { index: false, follow: false },
};

export default async function Login() {
  const publicAuthConfig = resolveSupabasePublicConfig();
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    if (data.user) redirect("/dashboard");
  } catch (error) {
    // Next.js redirects are implemented as thrown control-flow errors.
    if (error && typeof error === "object" && "digest" in error) throw error;
    // If Auth configuration is unavailable, keep the recoverable sign-in page.
  }

  return (
    <main className="accessPage">
      <header className="accessNav">
        <BrandLogo />
        <Link href="/">Back to overview</Link>
      </header>

      <section className="accessLayout">
        <div className="accessIntro">
          <p className="mcEyebrow"><span /> Secure member access</p>
          <h1>Your market preparation<br /><em>starts here.</em></h1>
          <p>
            Open Free access or continue to your Pro or Elite workspace with a
            secure, passwordless email link.
          </p>
          <ul>
            <li><i /> No password to remember or store</li>
            <li><i /> Membership access verified after sign-in</li>
            <li><i /> Market data remains fail-closed when unavailable</li>
          </ul>
        </div>

        <article className="accessCard">
          <header>
            <span className="mcReticle" aria-hidden="true" />
            <div><small>MISSION CONTROL</small><strong>Request secure access</strong></div>
            <span>01 / 02</span>
          </header>
          <div className="accessCardBody">
            <p className="accessStep">SIGN-IN LINK</p>
            <h2>Continue by email</h2>
            <p>Enter the email connected to your membership. We’ll send one link that returns you to your workspace.</p>
            <Suspense fallback={<p className="accessMessage" role="status">Preparing secure sign-in…</p>}>
              <LoginForm
                supabaseUrl={publicAuthConfig.url}
                supabasePublishableKey={publicAuthConfig.key}
              />
            </Suspense>
          </div>
          <footer>
            <span>Protected by Supabase authentication</span>
            <Link href="/help">Need help?</Link>
          </footer>
        </article>
      </section>

      <footer className="accessFooter">
        <p>Educational market commentary only. Trading futures and options involves substantial risk.</p>
        <div><Link href="/#membership">Compare plans</Link><Link href="/privacy">Privacy</Link><a href="mailto:hello@nashaimarkets.com">Contact support</a></div>
      </footer>
    </main>
  );
}
