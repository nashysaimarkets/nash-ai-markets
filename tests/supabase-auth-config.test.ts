import assert from "node:assert/strict";
import test from "node:test";
import { createAuthCompatibleFetch } from "../utils/supabase/auth-compatible-fetch.ts";
import {
  classifySupabaseKey,
  extractLegacyJwtProjectRef,
  projectRefFromSupabaseHostname,
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
    NEXT_PUBLIC_SUPABASE_URL: "https://exampleproject.supabase.co",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_primary",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.fallback",
  });
  assert.equal(preferred.key, "sb_publishable_primary");
  assert.equal(preferred.keySource, "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  assert.equal(preferred.keyKind, "publishable");
  assert.equal(preferred.hostname, "exampleproject.supabase.co");

  const fallback = resolveSupabasePublicConfig({
    NEXT_PUBLIC_SUPABASE_URL: "https://exampleproject.supabase.co",
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
    NEXT_PUBLIC_SUPABASE_URL: " https://exampleproject.supabase.co\n",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "'sb_publishable_demo'",
  });
  assert.equal(quoted.url, "https://exampleproject.supabase.co");
  assert.equal(quoted.key, "sb_publishable_demo");
  assert.equal(quoted.sanitizedWhitespace, true);
  assert.equal(quoted.sanitizedQuotes, true);
  assert.equal(classifySupabaseKey(""), "missing");
  assert.equal(classifySupabaseKey("not-a-key"), "unknown");
});

test("auth-compatible fetch keeps matching Authorization on Auth routes", async () => {
  const key = "sb_publishable_testkey";
  let seen: Headers | undefined;
  const base: typeof fetch = async (_input, init) => {
    seen = new Headers(init?.headers);
    return new Response("{}", { status: 200 });
  };
  const wrapped = createAuthCompatibleFetch(key, base);
  await wrapped("https://exampleproject.supabase.co/auth/v1/token?grant_type=pkce", {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
  });
  assert.ok(seen);
  assert.equal(seen.get("apikey"), key);
  assert.equal(seen.get("Authorization"), `Bearer ${key}`);
});

test("auth-compatible fetch strips publishable Authorization on Edge Function routes", async () => {
  const key = "sb_publishable_testkey";
  let seen: Headers | undefined;
  const base: typeof fetch = async (_input, init) => {
    seen = new Headers(init?.headers);
    return new Response("{}", { status: 200 });
  };
  await createAuthCompatibleFetch(key, base)("https://exampleproject.supabase.co/functions/v1/demo", {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
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

test("legacy JWT project ref extraction never returns key material", () => {
  // Header.payload.sig — payload {"ref":"abcderefproject1","role":"service_role"}
  const payload = Buffer.from(JSON.stringify({ ref: "abcderefproject1", role: "service_role" })).toString("base64url");
  const token = `eyJhbGciOiJIUzI1NiJ9.${payload}.sig`;
  assert.equal(extractLegacyJwtProjectRef(token), "abcderefproject1");
  assert.equal(projectRefFromSupabaseHostname("abcderefproject1.supabase.co"), "abcderefproject1");
  assert.equal(extractLegacyJwtProjectRef("sb_publishable_x"), null);
  const diag = supabaseConfigDiagnostics({
    NEXT_PUBLIC_SUPABASE_URL: "https://wronghost.supabase.co",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_x",
    SUPABASE_SERVICE_ROLE_KEY: token,
  });
  assert.equal(diag.urlProjectRef, "wronghost");
  assert.equal(diag.serviceRoleJwtRef, "abcderefproject1");
  assert.equal(diag.projectRefsMatch, false);
  assert.equal(JSON.stringify(diag).includes(token), false);
});

test("default public config reads use direct process.env member access for bundlers", async () => {
  const source = await import("node:fs/promises").then((fs) =>
    fs.readFile(new URL("../utils/supabase/config.ts", import.meta.url), "utf8"),
  );
  assert.match(source, /NEXT_PUBLIC_SUPABASE_URL: process\.env\.NEXT_PUBLIC_SUPABASE_URL/);
  assert.match(source, /NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process\.env\.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY/);
  assert.match(source, /NEXT_PUBLIC_SUPABASE_ANON_KEY: process\.env\.NEXT_PUBLIC_SUPABASE_ANON_KEY/);
  assert.doesNotMatch(source, /env:\s*Record<[^>]+>\s*=\s*process\.env/);
});
