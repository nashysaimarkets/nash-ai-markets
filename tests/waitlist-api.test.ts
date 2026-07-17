import assert from "node:assert/strict";
import test from "node:test";
import { insertWaitlistSubmission, logWaitlistFailure } from "../app/lib/server/waitlist.ts";
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
  const logs: string[] = [];
  const result = await insertWaitlistSubmission(submission, {
    environment: {},
    logError: (message) => logs.push(message),
  });
  assert.equal(result, "unavailable");
  assert.deepEqual(JSON.parse(logs[0]!.slice("[waitlist] ".length)), {
    failureStage: "supabase-request",
    errorCode: null,
    message: "Supabase server credentials are not configured",
    details: null,
    hint: null,
    environment: { supabaseUrlExists: false, supabaseServerKeyExists: false },
  });
  assert.doesNotMatch(JSON.stringify(logs), /member@example\.invalid/);
});

test("missing table returns unavailable with sanitized Supabase diagnostics", async () => {
  const logs: string[] = [];
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
    logError: (message) => logs.push(message),
  });
  assert.equal(result, "unavailable");
  assert.deepEqual(JSON.parse(logs[0]!.slice("[waitlist] ".length)), {
    failureStage: "supabase-insert",
    errorCode: "42P01",
    message: 'relation "public.launch_waitlist" does not exist',
    details: "Schema cache lookup failed",
    hint: "Reload the schema cache",
    environment: { supabaseUrlExists: true, supabaseServerKeyExists: true },
  });
  assert.doesNotMatch(JSON.stringify(logs), /not-logged|member@example\.invalid/);
});

test("invalid credentials return unavailable without leaking the key or email", async () => {
  const logs: string[] = [];
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
    logError: (message) => logs.push(message),
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

test("every diagnostic is one identifiable structured console line", () => {
  const logs: string[] = [];
  logWaitlistFailure(
    "request-json",
    new Error("Malformed body"),
    {
      NEXT_PUBLIC_SUPABASE_URL: "https://project.example.invalid",
      SUPABASE_SERVICE_ROLE_KEY: "configured-but-never-logged",
    },
    (message) => logs.push(message),
  );
  assert.equal(logs.length, 1);
  assert.match(logs[0]!, /^\[waitlist\] \{.+\}$/);
  assert.deepEqual(JSON.parse(logs[0]!.slice("[waitlist] ".length)), {
    failureStage: "request-json",
    errorCode: null,
    message: "Malformed body",
    details: null,
    hint: null,
    environment: { supabaseUrlExists: true, supabaseServerKeyExists: true },
  });
  assert.doesNotMatch(logs[0]!, /configured-but-never-logged/);
});

test("diagnostics redact authenticated URLs and bearer credentials", () => {
  const logs: string[] = [];
  logWaitlistFailure(
    "supabase-request",
    {
      code: "NETWORK",
      message: "GET https://example.invalid/rest?apikey=secret-value failed",
      details: "Authorization: Bearer secret-value",
    },
    {},
    (message) => logs.push(message),
  );
  assert.doesNotMatch(logs[0]!, /secret-value/);
  assert.match(logs[0]!, /\[redacted-secret\]/);
});
