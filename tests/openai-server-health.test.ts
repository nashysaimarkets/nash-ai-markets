import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { checkOpenAIConnection, createOpenAIClient } from "../app/lib/server/openai.ts";

test("OpenAI client remains unconfigured when the server key is absent", () => {
  assert.equal(createOpenAIClient(""), null);
  assert.equal(createOpenAIClient("   "), null);
});

test("OpenAI health check reports not configured without making a request", async () => {
  assert.deepEqual(await checkOpenAIConnection(null), { status: "not_configured" });
});

test("OpenAI health check confirms a successful sanitized connection", async () => {
  let requested = false;
  const result = await checkOpenAIConnection({
    models: {
      async list() {
        requested = true;
        return { data: [{ id: "test-model" }] };
      },
    },
  });
  assert.equal(requested, true);
  assert.deepEqual(result, { status: "connected" });
});

test("OpenAI health check sanitizes provider failures", async () => {
  const result = await checkOpenAIConnection({
    models: {
      async list() {
        throw new Error("secret-bearing provider failure");
      },
    },
  });
  assert.deepEqual(result, { status: "unavailable" });
  assert.doesNotMatch(JSON.stringify(result), /secret-bearing/);
});

test("OpenAI health route requires authentication and never serializes credentials or raw errors", async () => {
  const source = await readFile(new URL("../app/api/openai/health/route.ts", import.meta.url), "utf8");
  assert.match(source, /auth\.getUser\(\)/);
  assert.match(source, /authentication_required/);
  assert.match(source, /cache-control/);
  assert.doesNotMatch(source, /OPENAI_API_KEY|process\.env|console\.|error\.message/);
});

test("OpenAI API key is documented as an empty server-only example", async () => {
  const [environment, docs] = await Promise.all([
    readFile(new URL("../.env.example", import.meta.url), "utf8"),
    readFile(new URL("../docs/ENVIRONMENT_VARIABLES.md", import.meta.url), "utf8"),
  ]);
  assert.match(environment, /^OPENAI_API_KEY=$/m);
  assert.match(docs, /`OPENAI_API_KEY` \\| Secret, server only/);
  assert.doesNotMatch(environment, /^OPENAI_API_KEY=.+$/m);
});
