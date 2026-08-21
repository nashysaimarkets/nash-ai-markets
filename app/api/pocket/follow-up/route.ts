import { NextResponse } from "next/server";
import { createOpenAIClient, OPENAI_DEFAULT_MODEL } from "../../../lib/server/openai";

export const runtime = "nodejs";
export const maxDuration = 30;
const MAX_CONTEXT_LENGTH = 36_000;
const MAX_QUESTION_LENGTH = 180;

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
  let question = "";
  let analysis: unknown;
  try {
    const payload = await request.json() as { question?: unknown; analysis?: unknown };
    question = typeof payload.question === "string" ? payload.question.trim() : "";
    analysis = payload.analysis;
  } catch {
    return NextResponse.json({ error: "Invalid follow-up request." }, { status: 400 });
  }

  const context = JSON.stringify(analysis);
  if (!question || question.length > MAX_QUESTION_LENGTH || !analysis || context.length > MAX_CONTEXT_LENGTH) {
    return NextResponse.json({ error: "Please ask one short question about this result." }, { status: 400 });
  }

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
    return NextResponse.json({ reply: JSON.parse(output) }, { headers: { "cache-control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Ask Bullseye could not answer safely. Please retry once." }, { status: 503 });
  }
}
