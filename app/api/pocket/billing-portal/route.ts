import Stripe from "stripe";
import { createClient } from "../../../../utils/supabase/server.ts";
import { createAdminClient } from "../../../../utils/supabase/admin.ts";
import { openPocketBillingPortal } from "../../../lib/server/pocket-billing-portal.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return openPocketBillingPortal(request, {
    authenticate: async () => {
      const { data: { user }, error } = await (await createClient()).auth.getUser();
      if (error) throw new Error("Identity unavailable");
      return user;
    },
    customerForIdentity: async (userId, email) => {
      const { data, error } = await createAdminClient().rpc("get_pocket_web_customer", { p_user_id: userId, p_email: email });
      if (error) throw new Error("Binding unavailable");
      return data;
    },
    createPortal: async (customer, returnUrl) => {
      const key = process.env.STRIPE_SECRET_KEY;
      if (!key) throw new Error("Billing unavailable");
      const session = await new Stripe(key, { maxNetworkRetries: 0, timeout: 10000 }).billingPortal.sessions.create({ customer, return_url: returnUrl });
      return session.url;
    },
  });
}
