/** Compatible with supported WebViews without AbortSignal.throwIfAborted(). */
export function throwIfCancelled(signal?: AbortSignal): void {
  if (signal?.aborted) throw signal.reason ?? new DOMException("Cancelled", "AbortError");
}

/** Bound the entire operation, including APIs that do not honour AbortSignal. */
export async function withDeadline<T>(
  run: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
  message: string,
  parent?: AbortSignal | readonly AbortSignal[],
): Promise<T> {
  const controller = new AbortController();
  const deadlineAt = Date.now() + Math.max(1, timeoutMs);
  const parents: readonly AbortSignal[] = parent ? (Array.isArray(parent) ? parent : [parent as AbortSignal]) : [];
  let interruption: unknown;
  const abort = (reason: unknown) => {
    if (controller.signal.aborted) return;
    interruption = reason;
    controller.abort(reason);
  };
  const timeout = () => abort(new Error(message));
  const cancellations = parents.map((signal) => () => abort(signal.reason ?? new DOMException("Cancelled", "AbortError")));
  const resume = () => { if (Date.now() >= deadlineAt) timeout(); };
  let rejectAbort!: (error: unknown) => void;
  const interrupted = new Promise<never>((_, reject) => { rejectAbort = reject; });
  const onAbort = () => rejectAbort(interruption ?? controller.signal.reason ?? new DOMException("Cancelled", "AbortError"));
  controller.signal.addEventListener("abort", onAbort, { once: true });
  parents.forEach((signal, index) => {
    signal.addEventListener("abort", cancellations[index], { once: true });
    if (signal.aborted) cancellations[index]();
  });
  const timer = setTimeout(timeout, Math.max(1, timeoutMs));
  // Mobile timers can be suspended. Reconcile wall-clock time on returning.
  if (typeof window !== "undefined") window.addEventListener("pageshow", resume);
  if (typeof document !== "undefined") document.addEventListener("visibilitychange", resume);
  try {
    return await Promise.race([Promise.resolve().then(() => {
      throwIfCancelled(controller.signal);
      return run(controller.signal);
    }), interrupted]);
  } finally {
    clearTimeout(timer);
    parents.forEach((signal, index) => signal.removeEventListener("abort", cancellations[index]));
    controller.signal.removeEventListener("abort", onAbort);
    if (typeof window !== "undefined") window.removeEventListener("pageshow", resume);
    if (typeof document !== "undefined") document.removeEventListener("visibilitychange", resume);
  }
}
