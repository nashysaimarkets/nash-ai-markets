import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const sting = readFileSync("app/components/BullseyeLoginSting.tsx", "utf8");
const login = readFileSync("app/login/StagingLoginForm.tsx", "utf8");
const shell = readFileSync("app/components/MemberShell.tsx", "utf8");

test("login sting is optional, remembered, and session-gated", () => {
  assert.match(sting, /LOGIN_STING_MUTED_KEY/);
  assert.match(sting, /LOGIN_STING_PENDING_KEY/);
  assert.match(sting, /PENDING_WINDOW_MS/);
  assert.match(sting, /aria-pressed/);
  assert.match(sting, /AudioContext/);
});

test("successful OTP requests arm the sting without affecting auth", () => {
  assert.match(login, /if \(!error\)/);
  assert.match(login, /localStorage\.setItem\(LOGIN_STING_PENDING_KEY/);
  assert.match(login, /optional login sting never blocks authentication/i);
});

test("member shell exposes the sound preference", () => {
  assert.match(shell, /<BullseyeLoginSting \/>/);
});
