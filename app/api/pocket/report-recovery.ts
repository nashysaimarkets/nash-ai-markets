import { classifyOpenAIFailure } from "../../lib/server/openai";
import { PocketReportCompletionError } from "./report-completion";

export class PocketReportTimeoutError extends Error {
  constructor() { super("Pocket report timed out after its bounded recovery."); this.name = "PocketReportTimeoutError"; }
}

export function reportServiceTier(fast: boolean, recovery: boolean): "priority" | "default" {
  return fast && !recovery ? "priority" : "default";
}

type Attempt = { signal: AbortSignal; timeoutMs: number; recovery: boolean; noteOutputProgress: () => void };
type Options = {
  signal: AbortSignal;
  deadlineAt: number;
  attemptTimeoutMs: number;
  recoveryTimeoutMs: number;
  progressIdleTimeoutMs?: number;
  progressExtensionMs?: number;
  onRecovery?: (reason: string) => void;
  hedgeAfterMs?: number;
};

function recoveryReason(error: unknown): string | null {
  if (error instanceof PocketReportCompletionError) {
    return error.reason === "max_output_tokens" ? "output_limit" : null;
  }
  const reason = classifyOpenAIFailure(error);
  if (reason === "timeout") return reason;
  const failure = error as { message?: string; status?: number; name?: string } | null;
  if (/timed out/i.test(failure?.message ?? "")) return "timeout";
  if (failure?.name === "APIConnectionError" || (typeof failure?.status === "number" && failure.status >= 500)) return "provider_unavailable";
  return null;
}

/** One bounded recovery, retaining the complete image pack and strict schema.
 * Each attempt has its own cancellation signal; a stalled report must not
 * cancel the whole pipeline until recovery has also failed. Never retry quota,
 * authentication, content filtering, or user cancellation.
 */
export async function runPocketReport<T>(run: (attempt: Attempt) => Promise<T>, options: Options): Promise<T> {
  if (options.hedgeAfterMs && options.recoveryTimeoutMs) return runOverlappingReport(run, options);
  for (let attempt = 0; attempt < 2; attempt += 1) {
    options.signal.throwIfAborted();
    const remainingMs = options.deadlineAt - Date.now();
    if (remainingMs <= 0) throw new Error("Pocket report deadline timed out.");
    const firstWindowMs = Math.min(remainingMs, attempt === 0 ? options.attemptTimeoutMs : options.recoveryTimeoutMs);
    const startsAt = Date.now();
    const firstDeadline = startsAt + firstWindowMs;
    // Only real output may extend a progressing first attempt. Keep the total deadline fixed.
    const extensionMs = attempt === 0 ? Math.max(0, options.progressExtensionMs ?? 0) : 0;
    const hardDeadline = Math.min(options.deadlineAt, firstDeadline + extensionMs);
    const timeoutMs = Math.max(1, hardDeadline - startsAt);
    const controller = new AbortController();
    const signal = AbortSignal.any([options.signal, controller.signal]);
    let timer: ReturnType<typeof setTimeout> | undefined;
    const arm = (deadline: number) => {
      clearTimeout(timer);
      timer = setTimeout(() => controller.abort(new Error("Pocket report attempt timed out.")), Math.max(0, deadline - Date.now()));
    };
    arm(firstDeadline);
    const noteOutputProgress = () => {
      if (signal.aborted || !extensionMs || !options.progressIdleTimeoutMs) return;
      // Once output begins, detect inactivity even before the initial reasoning deadline.
      arm(Math.min(hardDeadline, Date.now() + options.progressIdleTimeoutMs));
    };
    try {
      const result = await run({ signal, timeoutMs, recovery: attempt > 0, noteOutputProgress });
      signal.throwIfAborted();
      return result;
    } catch (error) {
      options.signal.throwIfAborted();
      const reason = controller.signal.aborted ? "timeout" : recoveryReason(error);
      if (attempt > 0 || !options.recoveryTimeoutMs || !reason || options.deadlineAt - Date.now() < 1_000) {
        if (reason === "timeout") throw new PocketReportTimeoutError();
        throw error;
      }
      options.onRecovery?.(reason);
    } finally {
      clearTimeout(timer);
      controller.abort();
    }
  }
  throw new Error("Pocket report recovery exhausted.");
}

/** Slow-but-active output must not postpone recovery indefinitely. Keep the
 * original running until one complete, validated report wins, and never start
 * more than the same two attempts allowed by sequential recovery. */
function runOverlappingReport<T>(run: (attempt: Attempt) => Promise<T>, options: Options): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const controllers = [new AbortController(), new AbortController()];
    let settled = false, recoveryStarted = false, firstFailed = false, recoveryFailed = false;
    let lastError: unknown;
    const timer: { current?: ReturnType<typeof setTimeout> } = {};
    const finish = (error: unknown, value?: T) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer.current);
      options.signal.removeEventListener("abort", cancelled);
      controllers.forEach(controller => controller.abort());
      if (error) reject(error); else resolve(value as T);
    };
    const cancelled = () => finish(options.signal.reason ?? new DOMException("Cancelled", "AbortError"));
    const launch = (recovery: boolean) => {
      const controller = controllers[recovery ? 1 : 0];
      const attemptOptions = {
        ...options, hedgeAfterMs: undefined, recoveryTimeoutMs: 0,
        attemptTimeoutMs: recovery ? options.recoveryTimeoutMs : options.attemptTimeoutMs,
        progressExtensionMs: recovery ? 0 : options.progressExtensionMs,
        signal: AbortSignal.any([options.signal, controller.signal]),
      };
      void runPocketReport(attempt => run({ ...attempt, recovery }), attemptOptions).then(
        value => finish(null, value),
        error => {
          if (settled) return;
          lastError = error;
          if (recovery) recoveryFailed = true; else firstFailed = true;
          // Quota, authentication, filtering and user cancellation never cause another request.
          if (!recoveryReason(error)) { finish(error); return; }
          if (!recoveryStarted) startRecovery(recoveryReason(error)!);
          else if (firstFailed && recoveryFailed) finish(lastError);
        },
      );
    };
    const startRecovery = (reason: string) => {
      if (settled || recoveryStarted) return;
      clearTimeout(timer.current);
      if (options.deadlineAt - Date.now() < 1000) { if (firstFailed) finish(lastError); return; }
      recoveryStarted = true;
      options.onRecovery?.(reason);
      launch(true);
    };
    if (options.signal.aborted) { cancelled(); return; }
    options.signal.addEventListener("abort", cancelled, { once: true });
    timer.current = setTimeout(() => startRecovery("slow_report"), options.hedgeAfterMs);
    launch(false);
  });
}
