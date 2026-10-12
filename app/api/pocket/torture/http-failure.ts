/** A transport/application rejection is an unmeasured case, never a model miss.
 * Do not attribute historical 429s without their original response evidence. */
export function tortureHttpFailure(response: Response) {
  const local = response.status === 429 && response.headers.get("x-pocket-rate-limit-source") === "application";
  return {
    failureClass: local ? "APPLICATION_RATE_LIMIT" : response.status === 429 ? "UNATTRIBUTED_RATE_LIMIT" : "HTTP_ERROR",
    retryAfter: response.headers.get("retry-after"),
    applicationRateLimit: local ? {
      limit: response.headers.get("x-ratelimit-limit"),
      remaining: response.headers.get("x-ratelimit-remaining"),
      reset: response.headers.get("x-ratelimit-reset"),
    } : null,
  };
}
