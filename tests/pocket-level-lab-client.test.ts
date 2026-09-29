import assert from "node:assert/strict";
import test from "node:test";
import { postLevelLabScan } from "../app/pocket/level-lab-client.ts";

test("Level Lab retries one dropped WKWebView response with the same request id", async () => {
  const calls: RequestInit[] = [];
  const result = await postLevelLabScan<{ levels: { currentPrice: string } }>("{}", async (_input, init) => {
    calls.push(init ?? {});
    if (calls.length === 1) throw new TypeError("Load failed");
    return new Response(JSON.stringify({ levels: { currentPrice: "100" } }), { status: 200, headers: { "content-type": "application/json" } });
  });
  assert.equal(result.payload.levels.currentPrice, "100");
  assert.equal(calls.length, 2);
  assert.equal((calls[0].headers as Record<string, string>)["x-pocket-request-id"], (calls[1].headers as Record<string, string>)["x-pocket-request-id"]);
  assert.equal(calls[0].cache, "no-store");
});

test("Level Lab exposes a stable recovery message instead of raw fetch errors", async () => {
  let attempts = 0;
  await assert.rejects(
    postLevelLabScan("{}", async () => {
      attempts += 1;
      throw new TypeError("Load failed");
    }),
    /selected photo and existing map are unchanged/i,
  );
  assert.equal(attempts, 2);
});

test("Level Lab does not retry a parsed validation response", async () => {
  let attempts = 0;
  const result = await postLevelLabScan<{ error: string }>("{}", async () => {
    attempts += 1;
    return new Response(JSON.stringify({ error: "Use a clearer scale." }), { status: 422 });
  });
  assert.equal(attempts, 1);
  assert.equal(result.response.status, 422);
  assert.equal(result.payload.error, "Use a clearer scale.");
});

test("Level Lab preserves the capacity message without retrying exhausted provider quota", async () => {
  let attempts = 0;
  const message = "AI level scanning is unavailable because service capacity has been reached.";
  const result = await postLevelLabScan<{ error: string }>("{}", async () => {
    attempts += 1;
    return new Response(JSON.stringify({ error: message }), { status: 402 });
  });
  assert.equal(attempts, 1);
  assert.equal(result.response.status, 402);
  assert.equal(result.payload.error, message);
});
