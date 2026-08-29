import { NextResponse } from "next/server";
import { createOpenAIClient, OPENAI_DEFAULT_MODEL } from "../../../lib/server/openai";
import { readBoundedJsonBody, RequestBodyTooLargeError } from "../../../lib/server/bounded-json-body";
import { pocketBudgetHeaders, takePocketBudget } from "../../../lib/server/pocket-request-budget";
import { rejectCrossOrigin } from "../../../lib/server/same-origin";

export const runtime = "nodejs";
export const maxDuration = 60;
// Match the 8 MB upload contract used by the Pocket UI and analysis route.
// A base64 data URL can be roughly 4/3 larger than its original file.
const MAX_IMAGE_LENGTH = 11_000_000;
const MAX_REQUEST_BYTES = MAX_IMAGE_LENGTH * 2 + 20_000;

const schema = {
  type: "object",
  additionalProperties: false,
  properties: {
    outcome: { type: "string", enum: ["PROFIT", "LOSS", "BREAKEVEN", "UNCLEAR"] },
    processGrade: { type: "string", enum: ["A", "B", "C", "D", "F"] },
    decisionQuality: { type: "integer", minimum: 0, maximum: 100 },
    headline: { type: "string", maxLength: 120 },
    outcomeSummary: { type: "string", maxLength: 320 },
    confirmationReview: { type: "string", maxLength: 260 },
    invalidationReview: { type: "string", maxLength: 260 },
    timingReview: { type: "string", maxLength: 260 },
    disciplineReview: { type: "string", maxLength: 260 },
    goodDecisionBadOutcome: { type: "boolean" },
    lessons: { type: "array", maxItems: 4, items: { type: "string", maxLength: 150 } },
    behaviourTags: { type: "array", maxItems: 5, items: { type: "string", maxLength: 50 } },
  },
  required: ["outcome", "processGrade", "decisionQuality", "headline", "outcomeSummary", "confirmationReview", "invalidationReview", "timingReview", "disciplineReview", "goodDecisionBadOutcome", "lessons", "behaviourTags"],
} as const;

export async function POST(request: Request) {
  const crossOrigin = rejectCrossOrigin(request);
  if (crossOrigin) return crossOrigin;
  let payload: { beforeImage?: unknown; afterImage?: unknown; lockedAnalysis?: unknown };
  try {
    payload = await readBoundedJsonBody(request, MAX_REQUEST_BYTES) as typeof payload;
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return NextResponse.json({ error: "The review request is too large." }, { status: 413 });
    }
    return NextResponse.json({ error: "Invalid review request." }, { status: 400 });
  }
  try {
    const beforeImage = typeof payload.beforeImage === "string" ? payload.beforeImage : "";
    const afterImage = typeof payload.afterImage === "string" ? payload.afterImage : "";
    if (![beforeImage, afterImage].every((image) => /^data:image\/(jpeg|png|webp);base64,/.test(image) && image.length <= MAX_IMAGE_LENGTH)) {
      return NextResponse.json({ error: "Both chart screenshots are required." }, { status: 400 });
    }
    const budget = takePocketBudget(request, "review");
    if (!budget.allowed) return NextResponse.json(
      { error: "Your beta review allowance needs a short reset. No request was sent to the AI provider." },
      { status: 429, headers: pocketBudgetHeaders(budget) },
    );
    const client = createOpenAIClient(undefined, 55_000);
    if (!client) return NextResponse.json({ error: "AI review is not connected." }, { status: 503 });
    const lockedAnalysis = JSON.stringify(payload.lockedAnalysis ?? {}).slice(0, 12_000);
    const response = await client.responses.create({
      model: process.env.OPENAI_POCKET_MODEL?.trim() || OPENAI_DEFAULT_MODEL,
      reasoning: { effort: "low" },
      store: false,
      instructions: [
        "You are Bullseye's post-trade process auditor.",
        "Compare the locked before-chart and its original audit with the after-chart. Never invent entries, exits, profit, loss, prices or actions that are not visibly evidenced.",
        "Judge decision process separately from financial outcome. A disciplined plan may lose; a poor process may win. Mark outcome UNCLEAR when execution or P&L is not visible.",
        "Assess whether the original confirmation and invalidation conditions appear to have occurred, but say unknown when screenshots cannot prove timing or execution.",
        "Be concise, constructive and blunt. This is educational process review, not personalised financial advice.",
      ].join(" "),
      input: [{ role: "user", content: [
        { type: "input_text", text: `Locked pre-trade audit: ${lockedAnalysis}` },
        { type: "input_text", text: "BEFORE CHART" },
        { type: "input_image", image_url: beforeImage, detail: "high" },
        { type: "input_text", text: "AFTER CHART" },
        { type: "input_image", image_url: afterImage, detail: "high" },
      ] }],
      max_output_tokens: 2200,
      text: { format: { type: "json_schema", name: "bullseye_process_review", strict: true, schema } },
    });
    const output = response.output_text?.trim();
    if (!output) throw new Error("Review response was empty.");
    return NextResponse.json({ review: JSON.parse(output) }, { headers: pocketBudgetHeaders(budget) });
  } catch (error) {
    console.error("[pocket-bullseye] review unavailable", error instanceof Error ? error.name : "Error");
    return NextResponse.json({ error: "Bullseye could not complete the comparison safely." }, { status: 503 });
  }
}
