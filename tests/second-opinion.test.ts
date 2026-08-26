import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { buildProtectedPlanCheck, generateSecondOpinion, type SecondOpinionInput } from "../app/lib/server/second-opinion.ts";

const input: SecondOpinionInput = {
  market: "ES",
  timeframe: "5m",
  currentPrice: 6500,
  direction: "long",
  entry: 6500,
  stop: 6490,
  target: 6520,
  stake: "£20 maximum",
  emotion: "calm",
  thesis: "Testing a pullback plan",
  imageDataUrl: "data:image/png;base64,aGVsbG8=",
};

test("second opinion is structured, balanced, non-stored and calculates reward/risk deterministically", async () => {
  let request: Record<string, unknown> | null = null;
  const result = await generateSecondOpinion(input, {
    responses: {
      create: async (body) => {
        request = body;
        return { output_text: JSON.stringify({
          chartReadability: "clear",
          directionalLean: "bearish",
          summary: "The screenshot supports a structured pause before the user decides.",
          observations: ["Price appears to be testing a recent consolidation area."],
          bullCase: "A constructive interpretation would require the visible structure to hold.",
          bearCase: "A defensive interpretation is that the apparent bounce fails within the visible range.",
          invalidation: "The user-defined stop is the stated boundary; Bullseye has not created another level.",
          noTradeReasons: ["The chart may not show enough prior context.", "A scheduled catalyst may change conditions."],
          disciplineCheck: "The plan has stated boundaries, but the customer should decide independently whether the risk is acceptable.",
          uncertainties: ["A single screenshot cannot confirm live price, liquidity or events."],
          visualGuides: [
            { tool: "support", yPercent: 72, label: "Visible support zone", confidence: "medium" },
          ],
          extracted: {
            market: "ES",
            timeframe: "5m",
            platform: "IG",
            visiblePrice: 6500,
            intendedDirection: "long",
            entry: 6500,
            stop: 6490,
            target: 6520,
            indicators: ["Volume"],
            confidence: "high",
            confirmationNeeded: ["Confirm that the visible stop label belongs to this plan."],
          },
        }) };
      },
    },
  }, "test-model");

  assert.equal(result.status, "generated");
  assert.equal(result.content?.riskReward, 2);
  assert.equal(result.content?.directionalLean, "bearish");
  const capturedRequest = request as Record<string, unknown> | null;
  assert.equal(capturedRequest?.store, false);
  assert.equal(capturedRequest?.max_output_tokens, 4000);
  assert.deepEqual(capturedRequest?.reasoning, { effort: "low" });
  assert.equal((capturedRequest?.text as { verbosity?: unknown })?.verbosity, "low");
  assert.match(String(capturedRequest?.instructions), /Never issue BUY, SELL/i);
  assert.match(String(capturedRequest?.instructions), /two concise professional sentences/i);
  assert.equal(result.content?.extracted.market, "ES");
  assert.equal(result.content?.extracted.confidence, "high");
  assert.deepEqual(result.content?.visualGuides, [
    { tool: "support", yPercent: 72, label: "Visible support zone", confidence: "medium" },
  ]);
});

test("second opinion fails closed when provider output is invalid", async () => {
  const result = await generateSecondOpinion(input, {
    responses: { create: async () => ({ output_text: "not-json" }) },
  }, "test-model");
  assert.deepEqual(result, { status: "invalid_response", content: null });
});

test("second opinion normalizes blank optional extracted text to null", async () => {
  const result = await generateSecondOpinion(input, {
    responses: {
      create: async () => ({ output_text: JSON.stringify({
        chartReadability: "partial",
        directionalLean: "neutral",
        summary: "The chart is only partly readable.",
        observations: ["Some structure is visible."],
        bullCase: "Visible structure could hold, but confirmation is required.",
        bearCase: "Visible structure could fail, so the opposite case remains plausible.",
        invalidation: "No new invalidation level has been invented.",
        noTradeReasons: ["Context is limited.", "No live market feed was checked."],
        disciplineCheck: "Pause and confirm the plan independently.",
        uncertainties: ["The platform is not legible."],
        visualGuides: [],
        extracted: {
          market: "   ",
          timeframe: "1h",
          platform: "",
          visiblePrice: null,
          intendedDirection: "neutral",
          entry: null,
          stop: null,
          target: null,
          indicators: [],
          confidence: "low",
          confirmationNeeded: [],
        },
      }) }),
    },
  }, "test-model");

  assert.equal(result.status, "generated");
  assert.equal(result.content?.extracted.market, null);
  assert.equal(result.content?.extracted.platform, null);
});

test("clear two-sided chart structure preserves both support and resistance guides", async () => {
  let request: Record<string, unknown> | null = null;
  const visualGuides = [
    { tool: "resistance", yPercent: 24, label: "Nearest resistance", confidence: "high" },
    { tool: "support", yPercent: 76, label: "Primary support", confidence: "high" },
  ] as const;
  const result = await generateSecondOpinion(input, {
    responses: {
      create: async (body) => {
        request = body;
        return { output_text: JSON.stringify({
          chartReadability: "clear",
          directionalLean: "neutral",
          summary: "Price remains contained between clearly repeated reactions on both sides.",
          observations: ["Repeated upper rejection and lower defence define the visible range."],
          bullCase: "Holding the lower boundary keeps a constructive range interpretation plausible.",
          bearCase: "Continued rejection at the upper boundary keeps a defensive interpretation plausible.",
          invalidation: "No exact invalidation has been invented from the screenshot.",
          noTradeReasons: ["Price is inside a visible range.", "Live conditions have not been verified."],
          disciplineCheck: "Wait for the plan's own confirmation and risk boundary.",
          uncertainties: ["A screenshot cannot confirm live liquidity."],
          visualGuides,
          extracted: {
            market: "ES", timeframe: "5m", platform: "IG", visiblePrice: 6500,
            intendedDirection: "long", entry: 6500, stop: 6490, target: 6520,
            indicators: [], confidence: "high", confirmationNeeded: [],
          },
        }) };
      },
    },
  }, "test-model");

  assert.equal(result.status, "generated");
  assert.deepEqual(result.content?.visualGuides, visualGuides);
  assert.match(String((request as Record<string, unknown> | null)?.instructions), /scan the full visible candle history/i);
  assert.match(String((request as Record<string, unknown> | null)?.instructions), /return both the nearest support and nearest resistance/i);
  assert.match(String((request as Record<string, unknown> | null)?.instructions), /do not require a second timeframe/i);
});

test("out-of-frame visual levels fail closed instead of drawing misleading guides", async () => {
  const result = await generateSecondOpinion(input, {
    responses: {
      create: async () => ({ output_text: JSON.stringify({
        chartReadability: "clear",
        directionalLean: "neutral",
        summary: "The visible range is incomplete.",
        observations: ["Only part of the structure is visible."],
        bullCase: "A constructive interpretation remains possible.",
        bearCase: "A defensive interpretation remains possible.",
        invalidation: "No exact invalidation has been invented.",
        noTradeReasons: ["Context is incomplete.", "Live conditions are unverified."],
        disciplineCheck: "Pause until the plan is complete.",
        uncertainties: ["The lower boundary is outside the screenshot."],
        visualGuides: [{ tool: "support", yPercent: 98, label: "Primary support", confidence: "low" }],
        extracted: {
          market: "ES", timeframe: "5m", platform: "IG", visiblePrice: 6500,
          intendedDirection: "long", entry: 6500, stop: 6490, target: 6520,
          indicators: [], confidence: "low", confirmationNeeded: [],
        },
      }) }),
    },
  }, "test-model");

  assert.deepEqual(result, { status: "invalid_response", content: null });
});

test("protected plan check remains useful without claiming screenshot interpretation", () => {
  const result = buildProtectedPlanCheck(input);
  assert.equal(result.chartReadability, "unreadable");
  assert.equal(result.riskReward, 2);
  assert.match(result.summary, /AI chart interpretation remains disabled/i);
  assert.match(result.observations.join(" "), /not retained or machine-interpreted/i);
  assert.deepEqual(result.visualGuides, []);
});

test("private pilot route enforces origin, authentication, size, privacy and explicit enable flag", async () => {
  const route = await readFile(new URL("../app/api/second-opinion/route.ts", import.meta.url), "utf8");
  assert.match(route, /rejectCrossOrigin/);
  assert.match(route, /supabase\.auth\.getUser/);
  assert.match(route, /SECOND_OPINION_PRIVATE_PILOT/);
  assert.match(route, /MAX_REQUEST_BYTES/);
  assert.match(route, /MAX_IMAGE_BYTES/);
  assert.match(route, /privacyConfirmed/);
  assert.match(route, /cache-control.*no-store/i);
});

test("member navigation and page expose the private Second Opinion workflow", async () => {
  const shell = await readFile(new URL("../app/components/MemberShell.tsx", import.meta.url), "utf8");
  const page = await readFile(new URL("../app/second-opinion/page.tsx", import.meta.url), "utf8");
  const workbench = await readFile(new URL("../app/second-opinion/SecondOpinionWorkbench.tsx", import.meta.url), "utf8");
  assert.match(shell, /Second Opinion/);
  assert.match(page, /requireMemberPage/);
  assert.match(workbench, /Before risking your money/);
  assert.match(workbench, /not personalised financial advice/i);
});
