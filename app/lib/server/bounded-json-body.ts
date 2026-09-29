export class RequestBodyTooLargeError extends Error {
  constructor() {
    super("request_body_too_large");
    this.name = "RequestBodyTooLargeError";
  }
}

/**
 * Read and parse a JSON request without ever buffering more than maxBytes from
 * a chunked or length-less body. Content-Length is only an early rejection;
 * the streamed byte count remains authoritative.
 */
export async function readBoundedJsonBody(
  request: Request,
  maxBytes: number,
): Promise<unknown> {
  if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0) {
    throw new TypeError("maxBytes must be a positive safe integer");
  }

  const declaredLength = request.headers.get("content-length");
  if (declaredLength !== null) {
    const parsedLength = Number(declaredLength);
    if (!Number.isSafeInteger(parsedLength) || parsedLength < 0) {
      throw new SyntaxError("invalid_content_length");
    }
    if (parsedLength > maxBytes) throw new RequestBodyTooLargeError();
  }

  if (!request.body) throw new SyntaxError("empty_json_body");

  const reader = request.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  const textChunks: string[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel("request_body_too_large").catch(() => undefined);
        throw new RequestBodyTooLargeError();
      }
      textChunks.push(decoder.decode(value, { stream: true }));
    }
    textChunks.push(decoder.decode());
  } finally {
    reader.releaseLock();
  }

  return JSON.parse(textChunks.join("")) as unknown;
}

