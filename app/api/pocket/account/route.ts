import { createClient } from "../../../../utils/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Own server-verified UUID only. No query/body identity, customer or grant. */
export async function GET() {
  const headers = { "Cache-Control": "private, no-store", Vary: "Cookie" };
  try {
    const client = await createClient();
    const { data: { user }, error } = await client.auth.getUser();
    if (error || !user?.id || !user.email || !user.email_confirmed_at || user.is_anonymous) {
      return Response.json({ code: "POCKET_LOGIN_REQUIRED" }, { status: 401, headers });
    }
    return Response.json({ user_id: user.id, verified: true }, { headers });
  } catch {
    return Response.json({ code: "POCKET_IDENTITY_UNAVAILABLE" }, { status: 503, headers });
  }
}
