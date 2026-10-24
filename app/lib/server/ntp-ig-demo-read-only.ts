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

/** Bound even injected/non-cooperative transports; late responses are discarded. */
export function awaitIgDemoAbortable<T>(
  pending: Promise<T>,
  signal: AbortSignal,
  discardLate?: (value: T) => void,
): Promise<T> {
  return new Promise((resolve, reject) => {
    let cancelled = false;
    const abort = () => {
      cancelled = true;
      reject(new Error("IG_DEMO_REQUEST_ABORTED"));
    };
    if (signal.aborted) abort();
    else signal.addEventListener("abort", abort, { once: true });
    pending.then((value) => {
      signal.removeEventListener("abort", abort);
      if (cancelled) { discardLate?.(value); return; }
      resolve(value);
    }, (error: unknown) => {
      signal.removeEventListener("abort", abort);
      reject(error);
    });
  });
}

/** Shared bounded JSON reader; untrusted bodies remain unknown until projected. */
export async function readIgDemoJson(response: Response, signal: AbortSignal, maximum = MAX_RESPONSE_BYTES): Promise<unknown> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("IG_DEMO_INVALID_RESPONSE");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await awaitIgDemoAbortable(reader.read(), signal);
      if (signal.aborted) throw new Error("IG_DEMO_REQUEST_ABORTED");
      if (done) break;
      size += value.byteLength;
      if (size > maximum) throw new Error("IG_DEMO_RESPONSE_TOO_LARGE");
      chunks.push(value);
    }
  } finally {
    // A hostile injected stream must not stall cancellation cleanup.
    void reader.cancel().catch(() => {});
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) as unknown;
  } catch {
    throw new Error("IG_DEMO_INVALID_RESPONSE");
  }
}

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
function createIgDemoReader(
  session: IgDemoSession,
  transport: typeof fetch = fetch,
) {
  if (typeof window !== "undefined") {
    throw new Error("IG_DEMO_SERVER_ONLY");
  }
  if (!session || typeof session !== "object") {
    throw new Error("IG_DEMO_SESSION_REQUIRED");
  }
  const apiKey = requiredHeader(session.apiKey, "API_KEY");
  const cst = requiredHeader(session.cst, "CST");
  const securityToken = requiredHeader(session.securityToken, "SECURITY_TOKEN");

  async function get(path: string, version: "1" | "2" | "3", signal?: AbortSignal): Promise<unknown> {
    // Fail before transport, even if a test transport ignores cancellation.
    if (signal?.aborted) throw new Error("IG_DEMO_CANCELLED");
    const boundedSignal = AbortSignal.any([
      AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      ...(signal ? [signal] : []),
    ]);
    try {
      const response = await awaitIgDemoAbortable(transport(`${IG_DEMO_API_ORIGIN}${path}`, {
        method: "GET",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "X-IG-API-KEY": apiKey,
          CST: cst,
          "X-SECURITY-TOKEN": securityToken,
          Version: version,
        },
        cache: "no-store",
        redirect: "error",
        credentials: "omit",
        signal: boundedSignal,
      }), boundedSignal, (late) => { void late.body?.cancel().catch(() => {}); });
      if (boundedSignal.aborted) {
        void response.body?.cancel().catch(() => {});
        throw new Error("IG_DEMO_REQUEST_ABORTED");
      }
      if (!response.ok) {
        void response.body?.cancel().catch(() => {});
        throw new Error(`IG_DEMO_HTTP_${response.status}`);
      }
      // Bound even chunked bodies; Content-Length alone is not trustworthy.
      return await readIgDemoJson(response, boundedSignal);
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

  return get;
}

export function createIgDemoReadOnlyClient(
  session: IgDemoSession,
  transport: typeof fetch = fetch,
): IgDemoReadOnlyClient {
  const get = createIgDemoReader(session, transport);
  return Object.freeze({
    getAccounts: (signal?: AbortSignal) => get("/gateway/deal/accounts", "1", signal),
    getPositions: (signal?: AbortSignal) => get("/gateway/deal/positions", "2", signal),
  });
}

function checkedEpic(epic: string): string {
  if (typeof epic !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,95}$/.test(epic)) {
    throw new Error("IG_DEMO_INVALID_EPIC");
  }
  return epic;
}

/** Internal service metadata; rights are supplied only by an approved server policy. */
export function createIgDemoEvidenceClient(
  session: IgDemoSession,
  rights: Readonly<{ marketDetails?: boolean; historicalPrices?: boolean }> = {},
  transport: typeof fetch = fetch,
) {
  const get = createIgDemoReader(session, transport);
  const marketAllowed = rights.marketDetails === true;
  const historyAllowed = rights.historicalPrices === true;
  return Object.freeze({
    getSession: (signal?: AbortSignal) => get("/gateway/deal/session", "1", signal),
    getMarket(epic: string, signal?: AbortSignal): Promise<unknown> {
      if (!marketAllowed) throw new Error("IG_DEMO_MARKET_DATA_NOT_LICENSED");
      return get(`/gateway/deal/markets/${checkedEpic(epic)}`, "3", signal);
    },
    getHistoricalPrices(epic: string, query: Readonly<{
      resolution: "MINUTE_5" | "MINUTE_15" | "MINUTE_30" | "HOUR" | "HOUR_4" | "DAY";
      from: string; to: string; max: number;
    }>, signal?: AbortSignal): Promise<unknown> {
      if (!historyAllowed) throw new Error("IG_DEMO_MARKET_DATA_NOT_LICENSED");
      checkedEpic(epic);
      const resolutions = ["MINUTE_5", "MINUTE_15", "MINUTE_30", "HOUR", "HOUR_4", "DAY"];
      const date = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/;
      const validDate = (value: string) => typeof value === "string" && date.test(value) && Number.isFinite(Date.parse(value + "Z")) && new Date(value + "Z").toISOString().slice(0, 19) === value;
      if (!query || !resolutions.includes(query.resolution) || !Number.isSafeInteger(query.max) || query.max < 1 || query.max > 100 ||
          !validDate(query.from) || !validDate(query.to) || query.from >= query.to) {
        throw new Error("IG_DEMO_INVALID_HISTORY_QUERY");
      }
      // IG ignores `max` when a date range is provided; pageSize is the real bound.
      const params = new URLSearchParams({ resolution: query.resolution, from: query.from, to: query.to, max: String(query.max), pageSize: String(query.max), pageNumber: "1" });
      // Fixed single page, no provider-controlled pagination or automatic retries.
      return get(`/gateway/deal/prices/${epic}?${params}`, "3", signal);
    },
  });
}

