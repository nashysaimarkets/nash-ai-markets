import assert from "node:assert/strict";
import test from "node:test";
import { getLaunchEmailReadiness } from "../app/lib/launch-email.ts";

test("launch email readiness fails closed until Resend provider, sender and credential are all configured", () => {
  assert.deepEqual(getLaunchEmailReadiness({}), {
    providerConfigured: false,
    senderConfigured: false,
    credentialConfigured: false,
    ready: false,
  });

  assert.deepEqual(getLaunchEmailReadiness({
    LAUNCH_EMAIL_PROVIDER: "resend",
    LAUNCH_EMAIL_FROM: "NASH AI Markets <hello@nashaimarkets.com>",
  }), {
    providerConfigured: true,
    senderConfigured: true,
    credentialConfigured: false,
    ready: false,
  });

  assert.deepEqual(getLaunchEmailReadiness({
    LAUNCH_EMAIL_PROVIDER: "resend",
    LAUNCH_EMAIL_FROM: "NASH AI Markets <hello@nashaimarkets.com>",
    RESEND_API_KEY: "re_example",
  }), {
    providerConfigured: true,
    senderConfigured: true,
    credentialConfigured: true,
    ready: true,
  });
});

test("unsupported providers never report launch email ready", () => {
  assert.equal(getLaunchEmailReadiness({
    LAUNCH_EMAIL_PROVIDER: "smtp",
    LAUNCH_EMAIL_FROM: "hello@nashaimarkets.com",
    RESEND_API_KEY: "re_example",
  }).ready, false);
});
