/**
 * NTP broker research: server-side IG DEMO, READ-ONLY transport.
 *
 * Deliberately cannot send orders and never permits a configurable/live host.
 * NOT an authenticated multi-user integration or permission to redistribute IG data.
 * Wire to server-only secret storage and explicit broker approval before UI access.
 */
export const IG_DEMO_API_ORIGIN = "https://demo-api.ig.com" as const;

export type IgDemoSession = Readonly<{
  apiKey: string;
  cst: string;
  securityToken: string;
}>;

export type IgDemoReadOnlyClient = Readonly<{
  getAccounts(signal?: AbortSignal): Promise<unknown>;
  getPositions(signal?: AbortSignal): Promise<unknown>;
}>;

function requiredHeader(value: string, label: string): string {
  if (typeof value !== "string" || !value.trim() || value.length > 4096 || /[\r\n]/.test(value)) {
    throw new Error(`IG_DEMO_MISSING_OR_INVALID_${label}`);
  }
  return value.trim();
}

/**
 * Accept session tokens obtained through an independently authorised IG DEMO
 * login flow. NEVER pass an end-user browser request, client-created token,
 * or LIVE-session token to this client. No network call is made on construction.
 */
export function createIgDemoReadOnlyClient(
  session: IgDemoSession,
  transport: typeof fetch = fetch,
): IgDemoReadOnlyClient {
  if (typeof window !== "undefined") {
    throw new Error("IG_DEMO_SERVER_ONLY");
  }
  if (!session || typeof session !== "object") {
    throw new Error("IG_DEMO_SESSION_REQUIRED");
  }
  const apiKey = requiredHeader(session.apiKey, "API_KEY");
  const cst = requiredHeader(session.cst, "CST");
  const securityToken = requiredHeader(session.securityToken, "SECURITY_TOKEN");

  async function get(path: "/gateway/deal/accounts" | "/gateway/deal/positions", signal?: AbortSignal): Promise<unknown> {
    let response: Response;
    try {
      response = await transport(`${IG_DEMO_API_ORIGIN}${path}`, {
        method: "GET",
        headers: {
          Accept: "application/json",
          "X-IG-API-KEY": apiKey,
          CST: cst,
          "X-SECURITY-TOKEN": securityToken,
          Version: path.endsWith("/positions") ? "2" : "1",
        },
        cache: "no-store",
        redirect: "error",
        credentials: "omit",
        signal,
      });
    } catch {
      // Never forward arbitrary remote/network errors containing secrets or URLs.
      throw new Error("IG_DEMO_TRANSPORT_UNAVAILABLE");
    }
    if (!response.ok) {
      throw new Error(`IG_DEMO_HTTP_${response.status}`);
    }
    try {
      // Shape stays unknown pending an actual, authorised demo-account contract test.
      return await response.json() as unknown;
    } catch {
      throw new Error("IG_DEMO_INVALID_RESPONSE");
    }
  }

  return Object.freeze({
    getAccounts: (signal?: AbortSignal) => get("/gateway/deal/accounts", signal),
    getPositions: (signal?: AbortSignal) => get("/gateway/deal/positions", signal),
  });
}
