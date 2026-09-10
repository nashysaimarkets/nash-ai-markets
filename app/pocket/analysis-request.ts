import { withDeadline } from "./async-deadline";

// Stay just beyond the server's 300-second function boundary so the browser
// receives the server's specific outcome instead of aborting a valid request.
export const POCKET_ANALYSIS_CLIENT_TIMEOUT_MS = 305_000;

export const POCKET_ANALYSIS_TIMEOUT_MESSAGE =
  "The chart analysis timed out. Your charts are still loaded—tap again to retry.";

export function formatPocketAnalysisCountdown(totalSeconds: number) {
  const safeSeconds = Math.max(0, Math.ceil(totalSeconds));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = String(safeSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

export function pocketAnalysisCountdownLabel(totalSeconds: number) {
  const stage = totalSeconds <= 20 ? "FINAL VERIFICATION" : "MEASURING STRUCTURE";
  return `${stage} · UP TO ${formatPocketAnalysisCountdown(totalSeconds)} REMAINING`;
}

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export async function postPocketAnalysis(
  body: string,
  options: { fetchImpl?: FetchLike; timeoutMs?: number; signal?: AbortSignal } = {},
): Promise<Response> {
  const fetchImpl = options.fetchImpl ?? fetch;
  return withDeadline(async (signal) => {
    const response = await fetchImpl("/api/pocket/analyse", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
      signal,
    });
    // fetch() resolves at headers. Keep the deadline until ALL bytes arrive.
    const text = await response.text();
    signal.throwIfAborted();
    return new Response(text, { status: response.status, statusText: response.statusText, headers: response.headers });
  }, options.timeoutMs ?? POCKET_ANALYSIS_CLIENT_TIMEOUT_MS, POCKET_ANALYSIS_TIMEOUT_MESSAGE, options.signal);
}
