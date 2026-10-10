import { timingSafeEqual } from "node:crypto";

/** Opt-in safety barrier: never let a public preview URL start a billed benchmark. */
export function mayRunLiveTorture(
  request: Request,
  config: { enabled?: string; token?: string },
): boolean {
  if (config.enabled !== "true" || !config.token || config.token.length < 32) return false;
  const supplied = request.headers.get("x-pocket-torture-token");
  if (!supplied) return false;
  const actual = Buffer.from(supplied, "utf8");
  const expected = Buffer.from(config.token, "utf8");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
