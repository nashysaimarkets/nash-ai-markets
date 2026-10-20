/** One private screenshot and one in-flight comparison; no persistent image storage. */
export type ComparisonState<T> = Readonly<{
  image: string; fileName: string; busy: boolean; reading: boolean; error: string; result: T | null;
}>;
type Screenshot = Pick<File, "name" | "type" | "size">;
export const emptyComparisonState = <T>(): ComparisonState<T> => ({ image: "", fileName: "", busy: false, reading: false, error: "", result: null });

export function readComparisonScreenshot(file: Screenshot, signal: AbortSignal): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    const aborted = () => { reader.abort(); reject(new Error("Screenshot cancelled")); };
    const clear = () => signal.removeEventListener("abort", aborted);
    reader.onload = () => { clear(); if (typeof reader.result === "string") resolve(reader.result); else reject(new Error("Screenshot unavailable")); };
    reader.onerror = () => { clear(); reject(new Error("Screenshot unavailable")); };
    reader.onabort = () => { clear(); reject(new Error("Screenshot cancelled")); };
    if (signal.aborted) { reject(new Error("Screenshot cancelled")); return; }
    signal.addEventListener("abort", aborted, { once: true });
    try { reader.readAsDataURL(file as File); } catch { clear(); reject(new Error("Screenshot unavailable")); }
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
      try {
        const image = await (options.read ?? readComparisonScreenshot)(file, operation.signal);
        if (current(ticket)) update({ image, fileName: file.name, reading: false });
      } catch {
        if (current(ticket)) update({ reading: false, error: "The screenshot could not be opened." });
      } finally { if (current(ticket)) controller = null; }
    },
    async check(context: Record<string, unknown>) {
      if (disposed || !state.image || state.busy || state.reading) return;
      const ticket = supersede();
      const operation = new AbortController(); controller = operation;
      update({ busy: true, result: null, error: "" });
      try {
        // Serialize before the first await; changing parent data cannot alter this request.
        const body = JSON.stringify({ ...context, image: state.image });
        const response = await options.fetch(options.endpoint, { method: "POST", headers: { "content-type": "application/json" }, body, signal: operation.signal });
        if (!current(ticket)) return;
        const payload: unknown = await response.json();
        if (!current(ticket)) return;
        const data = payload && typeof payload === "object" ? payload as Record<string, unknown> : {};
        if (!response.ok || !options.validate(data.result, JSON.parse(body))) throw new Error(typeof data.error === "string" ? data.error : options.failureMessage);
        update({ result: data.result });
      } catch (caught) {
        if (current(ticket)) update({ error: caught instanceof Error ? caught.message : options.failureMessage });
      } finally {
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
