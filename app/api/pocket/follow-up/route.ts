import { NextResponse } from "next/server";
import { createOpenAIClient, OPENAI_DEFAULT_MODEL } from "../../../lib/server/openai";
import { readBoundedJsonBody, RequestBodyTooLargeError } from "../../../lib/server/bounded-json-body";
import { pocketBudgetHeaders, takePocketBudget } from "../../../lib/server/pocket-request-budget";
import { rejectCrossOrigin } from "../../../lib/server/same-origin";

export const runtime = "nodejs";
export const maxDuration = 30;
const MAX_CONTEXT_LENGTH = 36_000;
const MAX_QUESTION_LENGTH = 180;
const MAX_REQUEST_BYTES = MAX_CONTEXT_LENGTH + MAX_QUESTION_LENGTH + 4_096;

const schema = {
  type: "object",
  additionalProperties: false,
  properties: {
    answer: { type: "string", maxLength: 520 },
    evidence: { type: "array", maxItems: 4, items: { type: "string", maxLength: 150 } },
    caution: { type: "string", maxLength: 180 },
    nextCheck: { type: "string", maxLength: 180 },
  },
  required: ["answer", "evidence", "caution", "nextCheck"],
} as const;

export async function POST(request: Request) {
  const crossOrigin = rejectCrossOrigin(request);
  if (crossOrigin) return crossOrigin;
  let question = "";
  let analysis: unknown;
  try {
    const payload = await readBoundedJsonBody(request, MAX_REQUEST_BYTES) as { question?: unknown; analysis?: unknown };
    question = typeof payload.question === "string" ? payload.question.trim() : "";
    analysis = payload.analysis;
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return NextResponse.json({ error: "The follow-up request is too large." }, { status: 413 });
    }
    return NextResponse.json({ error: "Invalid follow-up request." }, { status: 400 });
  }

  const context = JSON.stringify(analysis);
  if (!question || question.length > MAX_QUESTION_LENGTH || !analysis || context.length > MAX_CONTEXT_LENGTH) {
    return NextResponse.json({ error: "Please ask one short question about this result." }, { status: 400 });
  }

  const budget = takePocketBudget(request, "follow-up");
  if (!budget.allowed) return NextResponse.json(
    { error: "Your Ask Bullseye beta allowance needs a short reset. No request was sent to the AI provider." },
    { status: 429, headers: pocketBudgetHeaders(budget) },
  );

  const client = createOpenAIClient(undefined, 25_000);
  if (!client) return NextResponse.json({ error: "Ask Bullseye is not connected in this environment." }, { status: 503 });

  try {
    const response = await client.responses.create({
      model: process.env.OPENAI_POCKET_MODEL?.trim() || OPENAI_DEFAULT_MODEL,
      reasoning: { effort: "low" },
      store: false,
      instructions: [
        "You are Ask Bullseye, a cautious follow-up explainer for one completed chart audit.",
        "Answer only from the supplied structured audit. Do not claim to see the original chart and do not add current prices, news, events, indicators, entries, stops or targets.",
        "Distinguish visible evidence from inference. If the audit does not contain enough information, say so directly and name the single best next check.",
        "Never instruct the user to buy, sell or place an order. Keep the answer concise and useful on a phone.",
      ].join(" "),
      input: `AUDIT: ${context}\n\nQUESTION: ${question}`,
      max_output_tokens: 700,
      text: { format: { type: "json_schema", name: "pocket_follow_up", strict: true, schema } },
    });
    const output = response.output_text?.trim();
    if (!output) throw new Error("empty");
    return NextResponse.json({ reply: JSON.parse(output) }, { headers: pocketBudgetHeaders(budget) });
  } catch {
    return NextResponse.json({ error: "Ask Bullseye could not answer safely. Please retry once." }, { status: 503 });
  }
}
