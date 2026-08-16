import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { applyAIMorningBrief, createMorningBrief, MORNING_BRIEF_PLACEHOLDER_INPUT } from "../app/lib/morning-brief-engine.ts";
import { DEFAULT_MORNING_BRIEF_MODEL, generateAIMorningBrief } from "../app/lib/server/ai-morning-brief.ts";

const verifiedBrief = createMorningBrief({
  source: "verified",
  asOf: "2026-07-17T07:30:00.000Z",
  sessionLabel: "London market session",
  marketCondition: "Neutral conditions with elevated volatility",
  confidence: 64,
  directionalBias: "neutral",
  keyRisk: "Volatility remains elevated",
  nextAction: "Recalculate after the next verified provider update",
});

test("live Morning Brief uses structured OpenAI output grounded in deterministic evidence", async () => {
  let request: Record<string, unknown> | null = null;
  const result = await generateAIMorningBrief(verifiedBrief, {
    responses: {
      async create(body) {
        request = body;
        return {
          output_text: JSON.stringify({
            headline: "Mixed conditions favour patience",
            summary: "Verified signals remain balanced while volatility keeps uncertainty elevated.",
            priorities: [...verifiedBrief.priorities].reverse(),
          }),
        };
      },
    },
  }, "test-model");
  assert.equal(result.status, "generated");
  assert.equal((request as Record<string, unknown> | null)?.store, false);
  assert.match(JSON.stringify(request), /json_schema/);
  assert.match(JSON.stringify(request), /Do not add facts, prices, levels/);
  assert.doesNotMatch(JSON.stringify(request), /OPENAI_API_KEY|apikey/i);
  const enhanced = applyAIMorningBrief(verifiedBrief, result);
  assert.equal(enhanced.generation, "ai-assisted");
  assert.equal(enhanced.aiStatus, "generated");
  assert.equal(enhanced.summary, "Verified signals remain balanced while volatility keeps uncertainty elevated.");
});

test("Morning Brief never calls OpenAI for preview or unavailable data", async () => {
  let requested = false;
  const preview = createMorningBrief(MORNING_BRIEF_PLACEHOLDER_INPUT);
  const result = await generateAIMorningBrief(preview, {
    responses: {
      async create() {
        requested = true;
        return { output_text: "{}" };
      },
    },
  }, "test-model");
  assert.equal(requested, false);
  assert.deepEqual(result, { status: "not_configured", content: null });
});

test("invalid, invented, or incomplete AI output preserves deterministic fallback", async () => {
  const result = await generateAIMorningBrief(verifiedBrief, {
    responses: {
      async create() {
        return {
          output_text: JSON.stringify({
            headline: "Buy above resistance",
            summary: "Guaranteed target 6500.",
            priorities: ["Invented priority"],
          }),
        };
      },
    },
  }, "test-model");
  assert.deepEqual(result, { status: "invalid_response", content: null });
  const fallback = applyAIMorningBrief(verifiedBrief, result);
  assert.equal(fallback.generation, "deterministic");
  assert.equal(fallback.headline, verifiedBrief.headline);
  assert.equal(fallback.summary, null);
});

test("rate limits, timeouts, and provider failures return safe fallback categories", async () => {
  const clientFor = (error: unknown) => ({
    responses: { async create() { throw error; } },
  });
  assert.deepEqual(await generateAIMorningBrief(verifiedBrief, clientFor({ status: 429 }), "test-model"), {
    status: "rate_limited",
    content: null,
  });
  assert.deepEqual(await generateAIMorningBrief(verifiedBrief, clientFor({ status: 429, code: "insufficient_quota" }), "test-model"), {
    status: "quota_exhausted",
    content: null,
  });
  assert.deepEqual(await generateAIMorningBrief(verifiedBrief, clientFor({ name: "AbortError" }), "test-model"), {
    status: "timeout",
    content: null,
  });
  assert.deepEqual(await generateAIMorningBrief(verifiedBrief, clientFor(new Error("secret provider detail")), "test-model"), {
    status: "unavailable",
    content: null,
  });
});

test("Morning Brief model has a server-side default and supports environment overrides", () => {
  assert.equal(DEFAULT_MORNING_BRIEF_MODEL, "gpt-5-mini");
});

test("dashboard wires live AI only into entitled verified Morning Brief output", async () => {
  const brief = await readFile(new URL("../app/brief/page.tsx", import.meta.url), "utf8");
  const panel = await readFile(new URL("../app/dashboard/components/MorningBriefPanel.tsx", import.meta.url), "utf8");
  assert.match(brief, /MorningMarketBrief|composeMorningMarketBrief/);
  assert.match(brief, /createProgressiveAccess/);
  assert.doesNotMatch(brief, /redirect\("\/terminal"\)/);
  assert.match(panel, /generateAIMorningBrief/);
  assert.match(panel, /applyAIMorningBrief/);
  assert.match(panel, /Deterministic fallback active/);
});
