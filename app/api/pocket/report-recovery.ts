import { classifyOpenAIFailure } from "../../lib/server/openai";
import { PocketReportCompletionError } from "./report-completion";

export class PocketReportTimeoutError extends Error {
  constructor() { super("Pocket report timed out after its bounded recovery."); this.name = "PocketReportTimeoutError"; }
}

export function reportServiceTier(fast: boolean, recovery: boolean): "priority" | "default" {
  return fast && !recovery ? "priority" : "default";
}

type Attempt = { signal: AbortSignal; timeoutMs: number; recovery: boolean };
type Options = {
  signal: AbortSignal;
  deadlineAt: number;
  attemptTimeoutMs: number;
  recoveryTimeoutMs: number;
  onRecovery?: (reason: string) => void;
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
  for (let attempt = 0; attempt < 2; attempt += 1) {
    options.signal.throwIfAborted();
    const remainingMs = options.deadlineAt - Date.now();
    if (remainingMs <= 0) throw new Error("Pocket report deadline timed out.");
    const timeoutMs = Math.min(remainingMs, attempt === 0 ? options.attemptTimeoutMs : options.recoveryTimeoutMs);
    const controller = new AbortController();
    const signal = AbortSignal.any([options.signal, controller.signal]);
    const timer = setTimeout(() => controller.abort(new Error("Pocket report attempt timed out.")), timeoutMs);
    try {
      const result = await run({ signal, timeoutMs, recovery: attempt > 0 });
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
