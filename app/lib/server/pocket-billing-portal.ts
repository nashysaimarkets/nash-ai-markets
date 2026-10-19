type PocketBillingIdentity = {
  id?: string;
  email?: string;
  email_confirmed_at?: string;
  is_anonymous?: boolean;
};

export type PocketBillingDependencies = {
  authenticate: () => Promise<PocketBillingIdentity | null>;
  customerForIdentity: (userId: string, email: string) => Promise<unknown>;
  createPortal: (customerId: string, returnUrl: string) => Promise<string | null>;
};

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const privateHeaders = { "Cache-Control": "private, no-store", Vary: "Cookie, Origin" };

function denial(status: number, code: string) {
  return Response.json({ error: "Web billing could not be opened.", code }, { status, headers: privateHeaders });
}

/** The customer comes only from the verified UUID's durable server binding.
 * Expired subscribers may manage billing; an email or submitted ID grants nothing. */
export async function openPocketBillingPortal(request: Request, deps: PocketBillingDependencies): Promise<Response> {
  if (request.method !== "POST") return new Response(null, { status: 405, headers: { ...privateHeaders, Allow: "POST" } });
  let origin: string;
  try {
    const url = new URL(request.url);
    if (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))) return denial(403, "INVALID_ORIGIN");
    origin = url.origin;
    if (request.headers.get("origin") !== origin) return denial(403, "INVALID_ORIGIN");
  } catch { return denial(403, "INVALID_ORIGIN"); }
  if (request.signal.aborted) return denial(409, "REQUEST_CANCELLED");
  try {
    const user = await deps.authenticate();
    if (!user?.id || !uuid.test(user.id) || !user.email?.trim() || !user.email_confirmed_at || user.is_anonymous) return denial(401, "POCKET_LOGIN_REQUIRED");
    const customer = await deps.customerForIdentity(user.id, user.email.trim().toLowerCase());
    if (typeof customer !== "string" || !/^cus_[A-Za-z0-9]+$/.test(customer)) return denial(503, "POCKET_BILLING_UNAVAILABLE");
    if (request.signal.aborted) return denial(409, "REQUEST_CANCELLED");
    const destination = await deps.createPortal(customer, `${origin}/pocket`);
    if (!destination) return denial(503, "POCKET_BILLING_UNAVAILABLE");
    const portal = new URL(destination);
    if (portal.protocol !== "https:" || portal.hostname !== "billing.stripe.com" || portal.port || portal.username || portal.password) return denial(503, "POCKET_BILLING_UNAVAILABLE");
    return new Response(null, { status: 303, headers: { ...privateHeaders, Location: portal.href } });
  } catch { return denial(503, "POCKET_BILLING_UNAVAILABLE"); }
}
