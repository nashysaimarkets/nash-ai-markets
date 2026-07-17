import assert from "node:assert/strict";
import test from "node:test";
import { insertWaitlistSubmission } from "../app/lib/server/waitlist.ts";
import { createAdminClient } from "../utils/supabase/admin.ts";

const submission = { email: "member@example.invalid", source: "launch-page" as const };

type Failure = {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
};

function clientWith(error: Failure | null) {
  return {
    from(table: "launch_waitlist") {
      assert.equal(table, "launch_waitlist");
      return {
        async insert(value: typeof submission) {
          assert.deepEqual(value, submission);
          return { error };
        },
      };
    },
  };
}

test("missing server credentials fail safely and log presence only", async () => {
  const logs: unknown[][] = [];
  const result = await insertWaitlistSubmission(submission, {
    environment: {},
    logError: (...values) => logs.push(values),
  });
  assert.equal(result, "unavailable");
  assert.deepEqual(logs[0]?.[1], {
    environment: {
      supabaseUrlExists: false,
      supabaseServerKeyExists: false,
    },
    error: {
      code: null,
      message: "Supabase server credentials are not configured",
      details: null,
      hint: null,
    },
  });
  assert.doesNotMatch(JSON.stringify(logs), /member@example\.invalid/);
});

test("missing table returns unavailable with sanitized Supabase diagnostics", async () => {
  const logs: unknown[][] = [];
  const result = await insertWaitlistSubmission(submission, {
    clientFactory: () => clientWith({
      code: "42P01",
      message: 'relation "public.launch_waitlist" does not exist',
      details: "Schema cache lookup failed",
      hint: "Reload the schema cache",
    }),
    environment: {
      NEXT_PUBLIC_SUPABASE_URL: "https://project.example.invalid",
      SUPABASE_SERVICE_ROLE_KEY: "not-logged",
    },
    logError: (...values) => logs.push(values),
  });
  assert.equal(result, "unavailable");
  assert.deepEqual(logs[0]?.[1], {
    environment: {
      supabaseUrlExists: true,
      supabaseServerKeyExists: true,
    },
    error: {
      code: "42P01",
      message: 'relation "public.launch_waitlist" does not exist',
      details: "Schema cache lookup failed",
      hint: "Reload the schema cache",
    },
  });
  assert.doesNotMatch(JSON.stringify(logs), /not-logged|member@example\.invalid/);
});

test("invalid credentials return unavailable without leaking the key or email", async () => {
  const logs: unknown[][] = [];
  const secret = "sb_secret_example-that-must-not-appear";
  const result = await insertWaitlistSubmission(submission, {
    clientFactory: () => clientWith({
      code: "PGRST301",
      message: `Invalid API key ${secret} for ${submission.email}`,
      hint: "Confirm the server key",
    }),
    environment: {
      NEXT_PUBLIC_SUPABASE_URL: "https://project.example.invalid",
      SUPABASE_SERVICE_ROLE_KEY: secret,
    },
    logError: (...values) => logs.push(values),
  });
  assert.equal(result, "unavailable");
  assert.doesNotMatch(JSON.stringify(logs), new RegExp(secret));
  assert.doesNotMatch(JSON.stringify(logs), /member@example\.invalid/);
  assert.match(JSON.stringify(logs), /\[redacted-secret\]/);
  assert.match(JSON.stringify(logs), /\[redacted-email\]/);
});

test("successful insert returns inserted without an error log", async () => {
  let logged = false;
  const result = await insertWaitlistSubmission(submission, {
    clientFactory: () => clientWith(null),
    logError: () => { logged = true; },
  });
  assert.equal(result, "inserted");
  assert.equal(logged, false);
});

test("duplicate email remains enumeration-safe and returns success semantics", async () => {
  let logged = false;
  const result = await insertWaitlistSubmission(submission, {
    clientFactory: () => clientWith({
      code: "23505",
      message: `duplicate key for ${submission.email}`,
    }),
    logError: () => { logged = true; },
  });
  assert.equal(result, "duplicate");
  assert.equal(logged, false);
});

test("admin client accepts a newer sb_secret server key as an opaque credential", async () => {
  const secret = "sb_secret_test-format-only";
  const capturedHeaders: Headers[] = [];
  const client = createAdminClient({
    NEXT_PUBLIC_SUPABASE_URL: "https://project.example.invalid",
    SUPABASE_SERVICE_ROLE_KEY: secret,
  });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_input, init) => {
    capturedHeaders.push(new Headers(init?.headers));
    return new Response(JSON.stringify([]), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
  try {
    await client.from("launch_waitlist").select("id").limit(1);
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.equal(capturedHeaders[0]?.get("apikey"), secret);
  assert.equal(capturedHeaders[0]?.get("authorization"), `Bearer ${secret}`);
});
