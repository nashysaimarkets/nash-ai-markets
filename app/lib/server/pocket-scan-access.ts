import { pocketTestProviderProject } from "../../api/pocket/torture/provider-spend.ts";
import { rememberPocketFirstFreeIdentity } from "./pocket-first-free.ts";

type Identity = { id?: string; email?: string; email_confirmed_at?: string; is_anonymous?: boolean };
type AccessDependencies = {
  authenticate: () => Promise<Identity | null>;
  hasSubscription: (userId: string) => Promise<boolean>;
  hasGoogleSubscription?: (userId: string) => Promise<boolean>;
  hasAppleSubscription?: (userId: string) => Promise<boolean>;
  hasFirstFreeAccess?: (user: Identity) => Promise<boolean>;
};

/** A verified identity and current Pocket subscription are both required.
 * Founding awards, terminal tiers and client/local-storage assertions grant no access. */
export async function checkPocketScanAccess(deps: AccessDependencies): Promise<Response | null> {
  try {
    const user = await deps.authenticate();
    if (!user?.id || !user.email || !user.email_confirmed_at || user.is_anonymous) return Response.json({ error: "Sign in with your verified Pocket account to scan.", code: "POCKET_LOGIN_REQUIRED" }, { status: 401 });
    let webUnavailable = false;
    try { if (await deps.hasSubscription(user.id)) return null; }
    catch { webUnavailable = true; }
    if (user.id && deps.hasAppleSubscription && await deps.hasAppleSubscription(user.id)) return null;
    if (user.id && deps.hasGoogleSubscription && await deps.hasGoogleSubscription(user.id)) return null;
    // Independent signed Apple proof can succeed during a web-ledger outage.
    // A web outage must never become first-free permission or a false expiry.
    if (webUnavailable) throw new Error("Pocket web subscription lookup unavailable");
    if (user.id && deps.hasFirstFreeAccess && await deps.hasFirstFreeAccess(user)) return null;
    return Response.json({ error: "An active Pocket subscription is required to scan.", code: "POCKET_SUBSCRIPTION_REQUIRED" }, { status: 403 });
  } catch {
    return Response.json({ error: "Pocket access could not be verified. Please retry shortly.", code: "POCKET_ACCESS_UNAVAILABLE" }, { status: 503 });
  }
}

export async function requirePocketScanAccess(request?: Request): Promise<Response | null> {
  // Only an internal benchmark scope can reach this branch; creating it first
  // enforces the spending hold, approved project and durable reservations.
  if (pocketTestProviderProject()) return null;
  return checkPocketScanAccess(pocketAccessDependencies(request, true));
}

/** Read-only subscription status never admits benchmark or first-free access. */
export async function requirePocketSubscriptionAccess(request: Request): Promise<Response | null> {
  return checkPocketScanAccess(pocketAccessDependencies(request, false));
}

function pocketAccessDependencies(request: Request | undefined, allowFirstFree: boolean): AccessDependencies {
  return {
    authenticate: async () => {
      const { createClient } = await import("../../../utils/supabase/server.ts");
      const client = await createClient();
      const { data: { user }, error } = await client.auth.getUser();
      if (error) return null;
      return user;
    },
    hasSubscription: async (userId) => {
      const { createAdminClient } = await import("../../../utils/supabase/admin.ts");
      const { data, error } = await createAdminClient().rpc("has_pocket_web_subscription", { p_user_id: userId });
      if (error || typeof data !== "boolean") throw new Error("Pocket subscription lookup unavailable");
      return data;
    },
    hasGoogleSubscription: async (userId) => {
      if (!request?.headers.get("x-pocket-google-token")) return false;
      const {hasPocketGoogleSubscription} = await import("./pocket-google-access");
      return hasPocketGoogleSubscription(request,userId);
    },
    hasAppleSubscription: async (userId) => {
      const proof = request?.headers?.get("x-pocket-apple-transaction");
      if (!proof || proof.length > 16000) return false;
      const { hasPocketAppleSubscription } = await import("./pocket-apple-access.ts");
      return hasPocketAppleSubscription(userId, proof);
    },
    hasFirstFreeAccess: async (user) => {
      if (!allowFirstFree || !request || process.env.POCKET_FIRST_FREE_ENABLED !== "true") return false;
      const phase = new URL(request.url).pathname.split("/").at(-1);
      if (phase !== "preflight" && phase !== "analyse") return false;
      rememberPocketFirstFreeIdentity(request, { id: user.id!, email: user.email! });
      // The transactional wrapper, not this routing decision, grants admission.
      return true;
    },
  };
}
