import assert from "node:assert/strict";
import test from "node:test";
import { createAuthCompatibleFetch } from "../utils/supabase/auth-compatible-fetch.ts";
import {
  classifySupabaseKey,
  resolveSupabasePublicConfig,
  sanitizeEnvCredential,
  supabaseConfigDiagnostics,
} from "../utils/supabase/config.ts";

test("sanitizeEnvCredential trims whitespace and wrapping quotes", () => {
  assert.deepEqual(sanitizeEnvCredential('  "sb_publishable_abc"  '), {
    value: "sb_publishable_abc",
    sanitizedWhitespace: true,
    sanitizedQuotes: true,
  });
  assert.deepEqual(sanitizeEnvCredential(" eyJlegacy "), {
    value: "eyJlegacy",
    sanitizedWhitespace: true,
    sanitizedQuotes: false,
  });
});

test("resolveSupabasePublicConfig prefers publishable over anon fallback", () => {
  const preferred = resolveSupabasePublicConfig({
    NEXT_PUBLIC_SUPABASE_URL: "https://opmgzchnmcgnsfwpmyc.supabase.co",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_primary",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.fallback",
  });
  assert.equal(preferred.key, "sb_publishable_primary");
  assert.equal(preferred.keySource, "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  assert.equal(preferred.keyKind, "publishable");
  assert.equal(preferred.hostname, "opmgzchnmcgnsfwpmyc.supabase.co");

  const fallback = resolveSupabasePublicConfig({
    NEXT_PUBLIC_SUPABASE_URL: "https://opmgzchnmcgnsfwpmyc.supabase.co",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.fallback",
  });
  assert.equal(fallback.keySource, "NEXT_PUBLIC_SUPABASE_ANON_KEY");
  assert.equal(fallback.keyKind, "legacy");
});

test("missing or invalid Supabase configuration is reported without key material", () => {
  const missing = supabaseConfigDiagnostics({});
  assert.equal(missing.urlConfigured, false);
  assert.equal(missing.keyConfigured, false);
  assert.equal(missing.keyKind, "missing");
  assert.equal(missing.hostname, null);
  assert.equal(JSON.stringify(missing).includes("sb_"), false);

  const quoted = resolveSupabasePublicConfig({
    NEXT_PUBLIC_SUPABASE_URL: " https://opmgzchnmcgnsfwpmyc.supabase.co\n",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "'sb_publishable_demo'",
  });
  assert.equal(quoted.url, "https://opmgzchnmcgnsfwpmyc.supabase.co");
  assert.equal(quoted.key, "sb_publishable_demo");
  assert.equal(quoted.sanitizedWhitespace, true);
  assert.equal(quoted.sanitizedQuotes, true);
  assert.equal(classifySupabaseKey(""), "missing");
  assert.equal(classifySupabaseKey("not-a-key"), "unknown");
});

test("auth-compatible fetch keeps apikey and strips publishable Authorization Bearer", async () => {
  const key = "sb_publishable_testkey";
  let seen: Headers | undefined;
  const base: typeof fetch = async (_input, init) => {
    seen = new Headers(init?.headers);
    return new Response("{}", { status: 200 });
  };
  const wrapped = createAuthCompatibleFetch(key, base);
  await wrapped("https://opmgzchnmcgnsfwpmyc.supabase.co/auth/v1/otp", {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
  });
  assert.ok(seen);
  assert.equal(seen.get("apikey"), key);
  assert.equal(seen.has("Authorization"), false);
});

test("auth-compatible fetch preserves real user JWT Authorization", async () => {
  const key = "sb_publishable_testkey";
  const userJwt = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.user";
  let seen: Headers | undefined;
  const base: typeof fetch = async (_input, init) => {
    seen = new Headers(init?.headers);
    return new Response("{}", { status: 200 });
  };
  await createAuthCompatibleFetch(key, base)("https://example.test", {
    headers: {
      apikey: key,
      Authorization: `Bearer ${userJwt}`,
    },
  });
  assert.ok(seen);
  assert.equal(seen.get("Authorization"), `Bearer ${userJwt}`);
});

test("legacy anon JWT keeps Authorization Bearer fallback behavior", async () => {
  const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.anon";
  let seen: Headers | undefined;
  const base: typeof fetch = async (_input, init) => {
    seen = new Headers(init?.headers);
    return new Response("{}", { status: 200 });
  };
  await createAuthCompatibleFetch(key, base)("https://example.test", {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
    },
  });
  assert.ok(seen);
  assert.equal(seen.get("Authorization"), `Bearer ${key}`);
});
