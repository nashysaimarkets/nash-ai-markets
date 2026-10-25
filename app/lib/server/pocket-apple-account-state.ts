type User = {id?: string; email?: string; email_confirmed_at?: string; is_anonymous?: boolean};
type Dependencies = {
  authenticate: () => Promise<User | null>;
  webSubscription: (id: string) => Promise<boolean>;
  appleSubscription: (id: string, proof: string) => Promise<boolean>;
};
/** Same UUID-bound subscription semantics as scanner admission. Read-only; no linking. */
export async function pocketAppleAccountResponse(proof: string, deps: Dependencies): Promise<Response> {
  const headers = {"Cache-Control": "private, no-store"};
  const fail = (status: number, code: string) => Response.json({code}, {status, headers});
  try {
    const user = await deps.authenticate();
    if (!user?.id || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(user.id)
      || !user.email || !user.email_confirmed_at || user.is_anonymous) return fail(401, "POCKET_LOGIN_REQUIRED");
    if (proof.length > 16000 || /[\r\n\0]/.test(proof)) return fail(400, "POCKET_APPLE_PROOF_INVALID");
    let webUnavailable = false;
    try {
      if (await deps.webSubscription(user.id)) return Response.json({appAccountToken:user.id, entitled:true, accessSource:"web"}, {headers});
    } catch { webUnavailable = true; }
    // Even an empty proof validates Apple configuration before offering a purchase.
    const entitled = await deps.appleSubscription(user.id, proof);
    if (!entitled && webUnavailable) return fail(503, "POCKET_ACCESS_UNAVAILABLE");
    return Response.json({appAccountToken:user.id, entitled, accessSource:entitled ? "apple" : "none"}, {headers});
  } catch (error) {
    const code = (error as {code?: unknown})?.code;
    return fail(503, code === "POCKET_APPLE_CONFIGURATION" || code === "POCKET_APPLE_VERIFICATION_UNAVAILABLE" || code === "POCKET_APPLE_OWNERSHIP_UNAVAILABLE" ? code : "POCKET_ACCESS_UNAVAILABLE");
  }
}
