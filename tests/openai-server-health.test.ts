import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { checkOpenAIConnection, createOpenAIClient } from "../app/lib/server/openai.ts";

test("OpenAI client remains unconfigured when the server key is absent", () => {
  assert.equal(createOpenAIClient(""), null);
  assert.equal(createOpenAIClient("   "), null);
});

test("OpenAI health check reports not configured without making a request", async () => {
  assert.deepEqual(await checkOpenAIConnection(null), {
    status: "not_configured",
    reason: "missing_api_key",
  });
});

test("OpenAI health check confirms a successful sanitized connection", async () => {
  let requested = false;
  const result = await checkOpenAIConnection({
    responses: {
      async create(body) {
        requested = true;
        assert.equal(body.store, false);
        assert.equal(body.max_output_tokens, 16);
        return { data: [{ id: "test-model" }] };
      },
    },
  });
  assert.equal(requested, true);
  assert.deepEqual(result, { status: "connected", reason: null });
});

test("OpenAI health check sanitizes provider failures", async () => {
  const result = await checkOpenAIConnection({
    responses: {
      async create() {
        throw new Error("secret-bearing provider failure");
      },
    },
  });
  assert.deepEqual(result, { status: "unavailable", reason: "provider_unavailable" });
  assert.doesNotMatch(JSON.stringify(result), /secret-bearing/);
});

test("OpenAI health check exposes only safe operational failure categories", async () => {
  const authentication = await checkOpenAIConnection({
    responses: { async create() { throw { status: 401, message: "credential value" }; } },
  });
  const rateLimit = await checkOpenAIConnection({
    responses: { async create() { throw { status: 429, message: "account detail" }; } },
  });
  const quota = await checkOpenAIConnection({
    responses: { async create() { throw { status: 429, code: "insufficient_quota", message: "billing detail" }; } },
  });
  const timeout = await checkOpenAIConnection({
    responses: { async create() { throw { name: "AbortError", message: "request URL" }; } },
  });
  const permission = await checkOpenAIConnection({
    responses: { async create() { throw { status: 403, message: "project detail" }; } },
  });
  const model = await checkOpenAIConnection({
    responses: { async create() { throw { status: 404, code: "model_not_found", message: "model detail" }; } },
  });
  assert.deepEqual(authentication, { status: "unavailable", reason: "authentication_rejected" });
  assert.deepEqual(rateLimit, { status: "unavailable", reason: "rate_limited" });
  assert.deepEqual(quota, { status: "unavailable", reason: "quota_exhausted" });
  assert.deepEqual(timeout, { status: "unavailable", reason: "timeout" });
  assert.deepEqual(permission, { status: "unavailable", reason: "permission_denied" });
  assert.deepEqual(model, { status: "unavailable", reason: "model_unavailable" });
  assert.doesNotMatch(JSON.stringify([authentication, rateLimit, quota, timeout, permission, model]), /credential|account detail|billing detail|request URL|project detail|model detail/);
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
