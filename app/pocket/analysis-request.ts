export const POCKET_ANALYSIS_CLIENT_TIMEOUT_MS = 95_000;

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
  options: { fetchImpl?: FetchLike; timeoutMs?: number } = {},
): Promise<Response> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? POCKET_ANALYSIS_CLIENT_TIMEOUT_MS;
  const controller = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const request = fetchImpl("/api/pocket/analyse", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
    signal: controller.signal,
  }).catch((error: unknown) => {
    if (controller.signal.aborted) throw new Error(POCKET_ANALYSIS_TIMEOUT_MESSAGE);
    throw error;
  });

  const deadline = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      controller.abort();
      reject(new Error(POCKET_ANALYSIS_TIMEOUT_MESSAGE));
    }, timeoutMs);
  });

  try {
    return await Promise.race([request, deadline]);
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
  }
}
