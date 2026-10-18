/**
 * NTP broker research: server-side IG DEMO, READ-ONLY transport.
 *
 * Deliberately cannot send orders and never permits a configurable/live host.
 * NOT an authenticated multi-user integration or permission to redistribute IG data.
 * Wire to server-only secret storage and explicit broker approval before UI access.
 */
const REQUEST_TIMEOUT_MS = 10_000;
const MAX_RESPONSE_BYTES = 1_048_576;

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
  if (typeof value !== "string" || !value.trim() || value.length > 4096 || /[^\x21-\x7e]/.test(value)) {
    throw new Error(`IG_DEMO_MISSING_OR_INVALID_${label}`);
  }
  return value;
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
    // Fail before transport, even if a test transport ignores cancellation.
    if (signal?.aborted) throw new Error("IG_DEMO_CANCELLED");
    const boundedSignal = AbortSignal.any([
      AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      ...(signal ? [signal] : []),
    ]);
    try {
      const response = await transport(`${IG_DEMO_API_ORIGIN}${path}`, {
        method: "GET",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "X-IG-API-KEY": apiKey,
          CST: cst,
          "X-SECURITY-TOKEN": securityToken,
          Version: path.endsWith("/positions") ? "2" : "1",
        },
        cache: "no-store",
        redirect: "error",
        credentials: "omit",
        signal: boundedSignal,
      });
      if (boundedSignal.aborted) {
        try { await response.body?.cancel(); } catch { /* Sanitised below. */ }
        throw new Error("IG_DEMO_REQUEST_ABORTED");
      }
      if (!response.ok) {
        await response.body?.cancel();
        throw new Error(`IG_DEMO_HTTP_${response.status}`);
      }
      // Bound even chunked bodies; Content-Length alone is not trustworthy.
      const reader = response.body?.getReader();
      if (!reader) throw new Error("IG_DEMO_INVALID_RESPONSE");
      const chunks: Uint8Array[] = [];
      let size = 0;
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (boundedSignal.aborted) throw new Error("IG_DEMO_REQUEST_ABORTED");
          if (done) break;
          size += value.byteLength;
          if (size > MAX_RESPONSE_BYTES) throw new Error("IG_DEMO_RESPONSE_TOO_LARGE");
          chunks.push(value);
        }
      } finally {
        try { await reader.cancel(); } catch { /* Do not expose remote errors. */ }
        reader.releaseLock();
      }
      const bytes = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
      try {
        // Still unknown: this transport is not a validated customer-facing DTO.
        return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) as unknown;
      } catch {
        throw new Error("IG_DEMO_INVALID_RESPONSE");
      }
    } catch (error) {
      if (signal?.aborted) throw new Error("IG_DEMO_CANCELLED");
      if (boundedSignal.aborted) throw new Error("IG_DEMO_TIMEOUT");
      // Never forward arbitrary remote/network errors containing secrets or URLs.
      if (error instanceof Error && /^(IG_DEMO_HTTP_[45][0-9]{2}|IG_DEMO_RESPONSE_TOO_LARGE|IG_DEMO_INVALID_RESPONSE)$/.test(error.message)) {
        throw new Error(error.message);
      }
      throw new Error("IG_DEMO_TRANSPORT_UNAVAILABLE");
    }
  }

  return Object.freeze({
    getAccounts: (signal?: AbortSignal) => get("/gateway/deal/accounts", signal),
    getPositions: (signal?: AbortSignal) => get("/gateway/deal/positions", signal),
  });
}
