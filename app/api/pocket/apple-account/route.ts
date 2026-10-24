import { createClient } from "../../../../utils/supabase/server";
import { hasPocketAppleSubscription } from "../../../lib/server/pocket-apple-access";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Account UUID comes from verified server identity, never a submitted user ID.
 * Read-only: this endpoint cannot buy, transfer ownership or grant first-free use. */
export async function GET(request: Request) {
  const headers = { "Cache-Control": "private, no-store" };
  try {
    const client = await createClient();
    const { data: { user }, error } = await client.auth.getUser();
    if (error || !user?.id || !user.email || !user.email_confirmed_at || user.is_anonymous) return Response.json({ error: "Sign in with your verified Pocket account before using Apple access.", code: "POCKET_LOGIN_REQUIRED" }, { status: 401, headers });
    const proof = request.headers.get("x-pocket-apple-transaction");
    if (proof && proof.length > 16000) return Response.json({ error: "Apple transaction proof is too large." }, { status: 400, headers });
    // Validate server setup even before purchase, so missing configuration
    // cannot launch a paid StoreKit transaction that we cannot verify.
    const entitled = await hasPocketAppleSubscription(user.id, proof ?? "");
    return Response.json({ appAccountToken: user.id, entitled }, { headers });
  } catch {
    return Response.json({ error: "Apple access could not be verified. Retry Restore Purchases shortly.", code: "POCKET_ACCESS_UNAVAILABLE" }, { status: 503, headers });
  }
}
