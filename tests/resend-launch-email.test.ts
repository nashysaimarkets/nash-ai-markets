import assert from "node:assert/strict";
import test from "node:test";
import { buildWaitlistConfirmationEmail } from "../app/lib/launch-email.ts";
import { dispatchLaunchEmail } from "../app/lib/server/resend-launch-email.ts";

const baseEnvironment = {
  LAUNCH_EMAIL_PROVIDER: "resend",
  LAUNCH_EMAIL_FROM: "NASH AI Markets <hello@nashaimarkets.com>",
  RESEND_API_KEY: "re_test_key",
};

test("Resend transport stays disabled until provider, sender and credential are configured", async () => {
  const email = buildWaitlistConfirmationEmail();
  assert.deepEqual(await dispatchLaunchEmail({ to: "member@example.com", email, idempotencyKey: "waitlist:member:1" }, { environment: {} }), { status: "disabled", reason: "provider" });
  assert.deepEqual(await dispatchLaunchEmail({ to: "member@example.com", email, idempotencyKey: "waitlist:member:1" }, { environment: { LAUNCH_EMAIL_PROVIDER: "resend" } }), { status: "disabled", reason: "sender" });
  assert.deepEqual(await dispatchLaunchEmail({ to: "member@example.com", email, idempotencyKey: "waitlist:member:1" }, { environment: { LAUNCH_EMAIL_PROVIDER: "resend", LAUNCH_EMAIL_FROM: "hello@nashaimarkets.com" } }), { status: "disabled", reason: "credential" });
});

test("Resend transport validates recipient and idempotency before network access", async () => {
  const email = buildWaitlistConfirmationEmail();
  let calls = 0;
  const fetchImpl = async () => { calls += 1; return new Response(null, { status: 200 }); };
  assert.deepEqual(await dispatchLaunchEmail({ to: "not-an-email", email, idempotencyKey: "waitlist:member:1" }, { environment: baseEnvironment, fetchImpl }), { status: "rejected", reason: "recipient" });
  assert.deepEqual(await dispatchLaunchEmail({ to: "member@example.com", email, idempotencyKey: "bad key" }, { environment: baseEnvironment, fetchImpl }), { status: "rejected", reason: "idempotency" });
  assert.equal(calls, 0);
});

test("Resend transport sends plain-text branded email with idempotency", async () => {
  const email = buildWaitlistConfirmationEmail();
  let request: RequestInit | undefined;
  const fetchImpl = async (_input: string | URL | Request, init?: RequestInit) => {
    request = init;
    return new Response(JSON.stringify({ id: "email_123" }), { status: 200, headers: { "Content-Type": "application/json" } });
  };
  const result = await dispatchLaunchEmail({ to: "Member@Example.com", email, idempotencyKey: "waitlist:member:123" }, { environment: baseEnvironment, fetchImpl });
  assert.deepEqual(result, { status: "sent", provider: "resend", messageId: "email_123" });
  assert.equal(new Headers(request?.headers).get("Authorization"), "Bearer re_test_key");
  assert.equal(new Headers(request?.headers).get("Idempotency-Key"), "waitlist:member:123");
  const body = JSON.parse(String(request?.body));
  assert.deepEqual(body.to, ["member@example.com"]);
  assert.equal(body.subject, email.subject);
  assert.equal(body.text, email.text);
});

test("Resend transport fails closed on provider errors", async () => {
  const email = buildWaitlistConfirmationEmail();
  const result = await dispatchLaunchEmail(
    { to: "member@example.com", email, idempotencyKey: "waitlist:member:500" },
    { environment: baseEnvironment, fetchImpl: async () => new Response("rate limited", { status: 429 }) },
  );
  assert.deepEqual(result, { status: "failed", reason: "provider_unavailable" });
});
