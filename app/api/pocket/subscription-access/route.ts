import { requirePocketSubscriptionAccess } from "../../../lib/server/pocket-scan-access.ts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** No submitted UUID/customer/email and no writes or provider requests. */
export async function GET(request: Request) {
  const denial = await requirePocketSubscriptionAccess(request);
  const headers = { "Cache-Control": "private, no-store", Vary: "Cookie, x-pocket-apple-transaction" };
  if (denial) {
    const body = await denial.json();
    return Response.json({ ...body, entitled: false }, { status: denial.status, headers });
  }
  return Response.json({ entitled: true }, { headers });
}
