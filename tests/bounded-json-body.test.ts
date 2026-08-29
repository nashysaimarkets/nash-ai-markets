import assert from "node:assert/strict";
import test from "node:test";
import {
  readBoundedJsonBody,
  RequestBodyTooLargeError,
} from "../app/lib/server/bounded-json-body.ts";

test("bounded JSON reader accepts a chunked body within the byte limit", async () => {
  const encoder = new TextEncoder();
  const chunks = [encoder.encode('{"chart":"'), encoder.encode("✓"), encoder.encode('"}')];
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      const next = chunks.shift();
      if (next) controller.enqueue(next);
      else controller.close();
    },
  });
  const request = new Request("https://example.test/api/pocket/analyse", {
    method: "POST",
    body,
    duplex: "half",
  } as RequestInit & { duplex: "half" });

  assert.deepEqual(await readBoundedJsonBody(request, 20), { chart: "✓" });
});

test("bounded JSON reader rejects a length-less streamed body as soon as bytes exceed the cap", async () => {
  const encoder = new TextEncoder();
  let cancelled = false;
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode('{"image":"12345'));
      controller.enqueue(encoder.encode('67890"}'));
    },
    cancel() {
      cancelled = true;
    },
  });
  const request = new Request("https://example.test/api/pocket/analyse", {
    method: "POST",
    body,
    duplex: "half",
  } as RequestInit & { duplex: "half" });

  await assert.rejects(
    readBoundedJsonBody(request, 12),
    (error: unknown) => error instanceof RequestBodyTooLargeError,
  );
  assert.equal(cancelled, true);
});

test("bounded JSON reader rejects an oversized declared length before consuming the stream", async () => {
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      controller.enqueue(new TextEncoder().encode("{}"));
      controller.close();
    },
  });
  const request = new Request("https://example.test/api/pocket/analyse", {
    method: "POST",
    headers: { "content-length": "100" },
    body,
    duplex: "half",
  } as RequestInit & { duplex: "half" });

  await assert.rejects(
    readBoundedJsonBody(request, 99),
    (error: unknown) => error instanceof RequestBodyTooLargeError,
  );
  assert.equal(request.bodyUsed, false);
});
