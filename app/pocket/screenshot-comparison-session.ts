/** One private screenshot and one in-flight comparison; no persistent image storage. */
export type ComparisonState<T> = Readonly<{
  image: string; fileName: string; busy: boolean; reading: boolean; error: string; result: T | null;
}>;
type Screenshot = Pick<File, "name" | "type" | "size">;
export const emptyComparisonState = <T>(): ComparisonState<T> => ({ image: "", fileName: "", busy: false, reading: false, error: "", result: null });

/** Settle cancellation even when a browser bridge ignores AbortSignal. */
function waitForComparison<T>(pending: Promise<T>, signal: AbortSignal, discard?: (value: T) => void): Promise<T> {
  return new Promise((resolve, reject) => {
    let ended = false;
    const aborted = () => {
      if (ended) return;
      ended = true;
      signal.removeEventListener("abort", aborted);
      reject(new Error("Screenshot comparison cancelled"));
    };
    if (signal.aborted) aborted();
    else signal.addEventListener("abort", aborted, { once: true });
    pending.then(value => {
      signal.removeEventListener("abort", aborted);
      if (ended) { try { discard?.(value); } catch { /* No late result is accepted. */ } return; }
      ended = true; resolve(value);
    }, error => {
      signal.removeEventListener("abort", aborted);
      if (ended) return;
      ended = true; reject(error);
    });
  });
}
function discardComparisonResponse(response: Response) {
  try { void response.body?.cancel().catch(() => {}); } catch { /* Best-effort transport cleanup. */ }
}

export function readComparisonScreenshot(file: Screenshot, signal: AbortSignal): Promise<string> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) { reject(new Error("Screenshot cancelled")); return; }
    let reader: FileReader | undefined;
    let ended = false;
    const finish = (value: string | null) => {
      if (ended) return;
      ended = true;
      signal.removeEventListener("abort", aborted);
      if (reader) {
        reader.onload = null; reader.onerror = null; reader.onabort = null;
        try { if (reader.readyState === 1) reader.abort(); } catch { /* Cleanup is non-blocking. */ }
      }
      if (value === null) reject(new Error("Screenshot unavailable or cancelled"));
      else resolve(value);
    };
    const aborted = () => finish(null);
    signal.addEventListener("abort", aborted, { once: true });
    try {
      reader = new FileReader();
      reader.onload = () => finish(typeof reader?.result === "string" ? reader.result : null);
      reader.onerror = reader.onabort = () => finish(null);
      reader.readAsDataURL(file as File);
    } catch { finish(null); }
  });
}

export function createScreenshotComparison<T>(options: {
  endpoint: string;
  failureMessage: string;
  fetch: (input: string, init: RequestInit) => Promise<Response>;
  publish: (state: ComparisonState<T>) => void;
  validate: (value: unknown, context: Record<string, unknown>) => value is T;
  read?: (file: Screenshot, signal: AbortSignal) => Promise<string>;
}) {
  let state = emptyComparisonState<T>();
  let revision = 0;
  let disposed = false;
  let controller: AbortController | null = null;
  const update = (patch: Partial<ComparisonState<T>>) => {
    state = Object.freeze({ ...state, ...patch });
    if (!disposed) options.publish(state);
  };
  const supersede = () => { revision++; controller?.abort(); controller = null; return revision; };
  const current = (ticket: number) => !disposed && ticket === revision;
  return {
    async attach(file: Screenshot) {
      if (disposed) return;
      const ticket = supersede();
      update(emptyComparisonState<T>());
      if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || !Number.isFinite(file.size) || file.size <= 0 || file.size > 8 * 1024 * 1024) {
        update({ error: "Add a JPEG, PNG or WebP screenshot under 8 MB." }); return;
      }
      const operation = new AbortController(); controller = operation;
      update({ reading: true });
      let timedOut = false;
      const timer = setTimeout(() => { timedOut = true; operation.abort(); }, 30_000);
      try {
        const image = await waitForComparison((options.read ?? readComparisonScreenshot)(file, operation.signal), operation.signal);
        if (current(ticket) && !operation.signal.aborted) update({ image, fileName: file.name, reading: false });
      } catch {
        if (current(ticket)) update({ reading: false, error: timedOut ? "Opening the screenshot timed out. Choose a fresh screenshot." : "The screenshot could not be opened." });
      } finally { clearTimeout(timer); operation.abort(); if (current(ticket)) controller = null; }
    },
    async check(context: Record<string, unknown>) {
      if (disposed || !state.image || state.busy || state.reading) return;
      const ticket = supersede();
      const operation = new AbortController(); controller = operation;
      update({ busy: true, result: null, error: "" });
      let timedOut = false;
      let response: Response | undefined;
      // One deadline covers both transport and body parsing; it is never restarted.
      const timer = setTimeout(() => { timedOut = true; operation.abort(); }, 65_000);
      try {
        // Serialize before the first await; changing parent data cannot alter this request.
        const body = JSON.stringify({ ...context, image: state.image });
        if (!current(ticket) || operation.signal.aborted) return;
        response = await waitForComparison(options.fetch(options.endpoint, { method: "POST", headers: { "content-type": "application/json" }, body, signal: operation.signal }), operation.signal, discardComparisonResponse);
        if (!current(ticket) || operation.signal.aborted) return;
        const payload: unknown = await waitForComparison(response.json(), operation.signal);
        if (!current(ticket) || operation.signal.aborted) return;
        const data = payload && typeof payload === "object" ? payload as Record<string, unknown> : {};
        if (!response.ok || !options.validate(data.result, JSON.parse(body))) throw new Error(typeof data.error === "string" ? data.error : options.failureMessage);
        update({ result: data.result });
      } catch (caught) {
        if (current(ticket)) update({ error: timedOut ? "The comparison timed out. No result was accepted; check the cause before retrying." : caught instanceof Error ? caught.message : options.failureMessage });
      } finally {
        clearTimeout(timer); operation.abort();
        if (response) discardComparisonResponse(response);
        if (current(ticket)) { controller = null; update({ busy: false }); }
      }
    },
    cancel() {
      if (disposed) return;
      supersede();
      update({ busy: false, reading: false, result: null, error: "Check cancelled. You can retry or replace the screenshot." });
    },
    dispose() { disposed = true; supersede(); },
  };
}
