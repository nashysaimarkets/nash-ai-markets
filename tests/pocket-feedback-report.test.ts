import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { POST } from "../app/api/pocket/feedback/route.ts";
import { resetPocketBudgetsForTesting } from "../app/lib/server/pocket-request-budget.ts";

const root = new URL("../", import.meta.url);

test("Pocket exposes an in-app offensive-content report without attaching chart data", async () => {
  const pocket = await readFile(new URL("app/pocket/PocketBullseye.tsx", root), "utf8");
  assert.match(pocket, /Offensive or unsafe AI content/);
  assert.match(pocket, /SEND REPORT IN APP/);
  assert.match(pocket, /fetch\("\/api\/pocket\/feedback"/);
  assert.doesNotMatch(pocket.slice(pocket.indexOf("function FeedbackButton"), pocket.indexOf("export default function PocketBullseye")), /image[,}]/);
});

test("feedback endpoint validates, rate-limits and sends only bounded text", async () => {
  resetPocketBudgetsForTesting();
  const previous = {
    provider: process.env.LAUNCH_EMAIL_PROVIDER,
    sender: process.env.LAUNCH_EMAIL_FROM,
    key: process.env.RESEND_API_KEY,
    recipient: process.env.POCKET_FEEDBACK_TO,
    fetch: globalThis.fetch,
  };
  process.env.LAUNCH_EMAIL_PROVIDER = "resend";
  process.env.LAUNCH_EMAIL_FROM = "Pocket Bullseye <support@nashaimarkets.com>";
  process.env.RESEND_API_KEY = "test-key";
  process.env.POCKET_FEEDBACK_TO = "hello@nashaimarkets.com";
  let outbound = "";
  globalThis.fetch = async (_input, init) => {
    outbound = String(init?.body ?? "");
    return new Response(JSON.stringify({ id: "report-1" }), { status: 200, headers: { "content-type": "application/json" } });
  };

  try {
    const request = new Request("https://pocket.nashaimarkets.com/api/pocket/feedback", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "https://pocket.nashaimarkets.com", "x-forwarded-for": "203.0.113.8" },
      body: JSON.stringify({ kind: "OFFENSIVE_OR_UNSAFE", note: "The generated wording appeared unsafe and should be reviewed." }),
    });
    const response = await POST(request);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ok: true });
    assert.match(outbound, /OFFENSIVE OR UNSAFE/);
    assert.match(outbound, /generated wording appeared unsafe/);
    assert.doesNotMatch(outbound, /data:image|account number|purchaseToken/);
  } finally {
    for (const [key, value] of Object.entries({ LAUNCH_EMAIL_PROVIDER: previous.provider, LAUNCH_EMAIL_FROM: previous.sender, RESEND_API_KEY: previous.key, POCKET_FEEDBACK_TO: previous.recipient })) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    globalThis.fetch = previous.fetch;
  }
});

test("feedback endpoint rejects cross-origin and malformed reports", async () => {
  resetPocketBudgetsForTesting();
  const crossOrigin = await POST(new Request("https://pocket.nashaimarkets.com/api/pocket/feedback", {
    method: "POST",
    headers: { origin: "https://example.com", "content-type": "application/json" },
    body: JSON.stringify({ kind: "TECHNICAL", note: "This should not be accepted." }),
  }));
  assert.equal(crossOrigin.status, 403);

  const invalid = await POST(new Request("https://pocket.nashaimarkets.com/api/pocket/feedback", {
    method: "POST",
    headers: { origin: "https://pocket.nashaimarkets.com", "content-type": "application/json" },
    body: JSON.stringify({ kind: "UNKNOWN", note: "too short" }),
  }));
  assert.equal(invalid.status, 400);
});
