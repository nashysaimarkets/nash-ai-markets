/**
 * Structured per-step tracing for server-rendered member routes.
 *
 * Every awaited stage is logged with an outcome and duration so a failure is
 * attributable to a specific step in function logs instead of surfacing only as
 * a blank route error boundary.
 */

export type RouteTrace = <T>(step: string, run: () => Promise<T> | T) => Promise<T>;

/**
 * Next.js signals redirect() and notFound() by throwing. Those are control
 * flow, not failures, and must propagate untouched and unlogged.
 */
function isNextControlFlow(error: unknown): boolean {
  const digest = (error as { digest?: unknown } | null)?.digest;
  return typeof digest === "string" && digest.startsWith("NEXT_");
}

export function newCorrelationId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function describeError(error: unknown): Record<string, unknown> {
  return {
    error: error instanceof Error ? error.name : "Error",
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  };
}

export function createRouteTrace(route: string, correlationId: string): RouteTrace {
  return async function step<T>(name: string, run: () => Promise<T> | T): Promise<T> {
    const started = Date.now();
    try {
      const value = await run();
      console.info(
        `[${route}:step] ${JSON.stringify({
          correlationId,
          step: name,
          status: "ok",
          durationMs: Date.now() - started,
        })}`,
      );
      return value;
    } catch (error) {
      if (isNextControlFlow(error)) throw error;
      console.error(
        `[${route}:step] ${JSON.stringify({
          correlationId,
          step: name,
          status: "failed",
          durationMs: Date.now() - started,
          ...describeError(error),
        })}`,
      );
      throw error;
    }
  };
}
