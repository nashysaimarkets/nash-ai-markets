import { POCKET_PRODUCT } from "../../lib/product-brand";
import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import LoginForm from "../../login/StagingLoginForm";
import { createClient } from "../../../utils/supabase/server";
import { resolveSupabasePublicConfig } from "../../../utils/supabase/config";

export const metadata: Metadata = { title: `${POCKET_PRODUCT.shortName} sign in`, robots: { index: false, follow: false } };

export default async function PocketLogin() {
  const config = resolveSupabasePublicConfig();
  try {
    const client = await createClient();
    const { data: { user } } = await client.auth.getUser();
    if (user?.id && user.email_confirmed_at && !user.is_anonymous) redirect("/pocket");
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
  }
  return <main className="accessPage"><section className="accessCard">
    <h1>Sign in to {POCKET_PRODUCT.shortName}</h1>
    <p>Use your existing {POCKET_PRODUCT.previousName} account. Your subscription is checked securely after sign-in.</p>
    <Suspense fallback={<p role="status">Preparing secure sign-in…</p>}>
      <LoginForm supabaseUrl={config.url} supabasePublishableKey={config.key} defaultNext="/pocket" existingAccountOnly />
    </Suspense>
    <a href="/pocket">Return to {POCKET_PRODUCT.shortName}</a>
  </section></main>;
}
