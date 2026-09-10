/** Bound the entire operation, including APIs that do not honour AbortSignal. */
export async function withDeadline<T>(
  run: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
  message: string,
  parent?: AbortSignal,
): Promise<T> {
  const controller = new AbortController();
  const deadlineAt = Date.now() + Math.max(1, timeoutMs);
  const timeout = () => controller.abort(new Error(message));
  const cancel = () => controller.abort(parent?.reason ?? new DOMException("Cancelled", "AbortError"));
  const resume = () => { if (Date.now() >= deadlineAt) timeout(); };
  let rejectAbort!: (error: unknown) => void;
  const interrupted = new Promise<never>((_, reject) => { rejectAbort = reject; });
  const onAbort = () => rejectAbort(controller.signal.reason);
  controller.signal.addEventListener("abort", onAbort, { once: true });
  parent?.addEventListener("abort", cancel, { once: true });
  if (parent?.aborted) cancel();
  const timer = setTimeout(timeout, Math.max(1, timeoutMs));
  // Mobile timers can be suspended. Reconcile wall-clock time on returning.
  if (typeof window !== "undefined") window.addEventListener("pageshow", resume);
  if (typeof document !== "undefined") document.addEventListener("visibilitychange", resume);
  try {
    return await Promise.race([Promise.resolve().then(() => {
      controller.signal.throwIfAborted();
      return run(controller.signal);
    }), interrupted]);
  } finally {
    clearTimeout(timer);
    parent?.removeEventListener("abort", cancel);
    controller.signal.removeEventListener("abort", onAbort);
    if (typeof window !== "undefined") window.removeEventListener("pageshow", resume);
    if (typeof document !== "undefined") document.removeEventListener("visibilitychange", resume);
  }
}
