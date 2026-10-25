import { createClient } from "../../../../utils/supabase/server";
import { hasPocketAppleSubscription } from "../../../lib/server/pocket-apple-access";
import { pocketAppleAccountResponse } from "../../../lib/server/pocket-apple-account-state";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Verified server UUID only. No purchases, customer writes or ownership transfer. */
export async function GET(request: Request) {
  return pocketAppleAccountResponse(request.headers.get("x-pocket-apple-transaction") ?? "", {
    authenticate: async () => {
      const client = await createClient();
      const {data: {user}, error} = await client.auth.getUser();
      return error ? null : user;
    },
    webSubscription: async id => {
      const {createAdminClient} = await import("../../../../utils/supabase/admin");
      const {data, error} = await createAdminClient().rpc("has_pocket_web_subscription", {p_user_id:id});
      if (error || typeof data !== "boolean") throw new Error("Subscription lookup unavailable");
      return data;
    },
    appleSubscription: hasPocketAppleSubscription,
  });
}
