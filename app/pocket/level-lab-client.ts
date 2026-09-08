const LEVEL_LAB_TIMEOUT_MS = 58_000;
const TRANSIENT_HTTP_STATUSES = new Set([408, 502, 503, 504]);
const LEVEL_LAB_TRANSPORT_MESSAGE = "Level Lab could not return the scan over this connection. Your selected photo and existing map are unchanged; tap Rescan Levels Only to try again.";

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

function requestId() {
  return globalThis.crypto?.randomUUID?.() ?? `level-lab-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export async function postLevelLabScan<T extends Record<string, unknown>>(
  body: string,
  fetcher: FetchLike = globalThis.fetch.bind(globalThis),
  options: { deadlineAt?: number } = {},
): Promise<{ response: Response; payload: T }> {
  const correlationId = requestId();
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const remainingMs = options.deadlineAt === undefined ? LEVEL_LAB_TIMEOUT_MS : options.deadlineAt - Date.now();
    if (remainingMs <= 0) throw new Error("The automatic chart-check window has ended. Your verified analysis is retained.");
    const controller = new AbortController();
    let timedOut = false;
    const timer = globalThis.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, Math.min(LEVEL_LAB_TIMEOUT_MS, remainingMs));
    try {
      const response = await fetcher("/api/pocket/levels", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-pocket-request-id": correlationId,
        },
        body,
        cache: "no-store",
        credentials: "same-origin",
        signal: controller.signal,
      });
      const responseText = await response.text();
      let payload: T;
      try {
        payload = JSON.parse(responseText) as T;
      } catch {
        if (attempt === 0) continue;
        throw new Error(LEVEL_LAB_TRANSPORT_MESSAGE);
      }
      if (TRANSIENT_HTTP_STATUSES.has(response.status) && attempt === 0) continue;
      return { response, payload };
    } catch (error) {
      if (timedOut) {
        throw new Error("Level Lab took too long to return the scan. Your selected photo and existing map are unchanged; tap Rescan Levels Only to try again.");
      }
      if (error instanceof Error && error.message === LEVEL_LAB_TRANSPORT_MESSAGE) throw error;
      if (attempt === 0) continue;
      throw new Error(LEVEL_LAB_TRANSPORT_MESSAGE);
    } finally {
      globalThis.clearTimeout(timer);
    }
  }
  throw new Error(LEVEL_LAB_TRANSPORT_MESSAGE);
}
