import AuthCallbackClient from "./AuthCallbackClient";
import { resolveSupabasePublicConfig } from "../../../utils/supabase/config";

// Hosting supplies these public credentials at runtime, after the client build.
export const dynamic = "force-dynamic";

export default function AuthCallbackPage() {
  const config = resolveSupabasePublicConfig();
  return <AuthCallbackClient supabaseUrl={config.url} supabasePublishableKey={config.key} />;
}
