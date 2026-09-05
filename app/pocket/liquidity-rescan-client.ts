const LIQUIDITY_RESCAN_TIMEOUT_MS = 58_000;
const TRANSIENT_HTTP_STATUSES = new Set([408, 502, 503, 504]);
const TRANSPORT_MESSAGE = "Liquidity Guard could not return the chart check over this connection. Your existing analysis is unchanged; tap Reanalyse Chart to try again.";

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

function requestId() {
  return globalThis.crypto?.randomUUID?.() ?? `liquidity-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export async function postLiquidityRescan<T extends Record<string, unknown>>(
  body: string,
  fetcher: FetchLike = globalThis.fetch.bind(globalThis),
): Promise<{ response: Response; payload: T }> {
  const correlationId = requestId();
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const controller = new AbortController();
    let timedOut = false;
    const timer = globalThis.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, LIQUIDITY_RESCAN_TIMEOUT_MS);
    try {
      const response = await fetcher("/api/pocket/liquidity", {
        method: "POST",
        headers: { "content-type": "application/json", "x-pocket-request-id": correlationId },
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
        throw new Error(TRANSPORT_MESSAGE);
      }
      if (TRANSIENT_HTTP_STATUSES.has(response.status) && attempt === 0) continue;
      return { response, payload };
    } catch (error) {
      if (timedOut) throw new Error("Liquidity Guard took too long to verify this chart. Your existing analysis is unchanged; tap Reanalyse Chart to try again.");
      if (error instanceof Error && error.message === TRANSPORT_MESSAGE) throw error;
      if (attempt === 0) continue;
      throw new Error(TRANSPORT_MESSAGE);
    } finally {
      globalThis.clearTimeout(timer);
    }
  }
  throw new Error(TRANSPORT_MESSAGE);
}
