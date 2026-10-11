import { pocketTestProviderProject } from "../../api/pocket/torture/provider-spend.ts";

type Identity = { id?: string; email?: string; email_confirmed_at?: string };
type AccessDependencies = {
  authenticate: () => Promise<Identity | null>;
  hasSubscription: (email: string) => Promise<boolean>;
  hasAppleSubscription?: (userId: string) => Promise<boolean>;
};

/** A verified identity and current Pocket subscription are both required.
 * Founding awards, terminal tiers and client/local-storage assertions grant no access. */
export async function checkPocketScanAccess(deps: AccessDependencies): Promise<Response | null> {
  try {
    const user = await deps.authenticate();
    if (!user?.email || !user.email_confirmed_at) return Response.json({ error: "Sign in with your verified Pocket account to scan.", code: "POCKET_LOGIN_REQUIRED" }, { status: 401 });
    if (await deps.hasSubscription(user.email.trim().toLowerCase())) return null;
    if (user.id && deps.hasAppleSubscription && await deps.hasAppleSubscription(user.id)) return null;
    return Response.json({ error: "An active Pocket subscription is required to scan.", code: "POCKET_SUBSCRIPTION_REQUIRED" }, { status: 403 });
  } catch {
    return Response.json({ error: "Pocket access could not be verified. Please retry shortly.", code: "POCKET_ACCESS_UNAVAILABLE" }, { status: 503 });
  }
}

export async function requirePocketScanAccess(request?: Request): Promise<Response | null> {
  // Only an internal benchmark scope can reach this branch; creating it first
  // enforces the spending hold, approved project and durable reservations.
  if (pocketTestProviderProject()) return null;
  return checkPocketScanAccess({
    authenticate: async () => {
      const { createClient } = await import("../../../utils/supabase/server.ts");
      const client = await createClient();
      const { data: { user }, error } = await client.auth.getUser();
      if (error) return null;
      return user;
    },
    hasSubscription: async (email) => {
      const { createAdminClient } = await import("../../../utils/supabase/admin.ts");
      const { data, error } = await createAdminClient().rpc("has_pocket_web_subscription", { p_email: email });
      if (error || typeof data !== "boolean") throw new Error("Pocket subscription lookup unavailable");
      return data;
    },
    hasAppleSubscription: async (userId) => {
      const proof = request?.headers?.get("x-pocket-apple-transaction");
      if (!proof || proof.length > 16000) return false;
      const { hasPocketAppleSubscription } = await import("./pocket-apple-access.ts");
      return hasPocketAppleSubscription(userId, proof);
    },
  });
}
