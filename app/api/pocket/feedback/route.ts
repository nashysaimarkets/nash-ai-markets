import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { readBoundedJsonBody, RequestBodyTooLargeError } from "../../../lib/server/bounded-json-body";
import { pocketBudgetHeaders, takePocketBudget } from "../../../lib/server/pocket-request-budget";
import { dispatchLaunchEmail } from "../../../lib/server/resend-launch-email";
import { isSameOrigin } from "../../../lib/server/same-origin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const KINDS = new Set(["OFFENSIVE_OR_UNSAFE", "INCORRECT", "TECHNICAL", "IDEA"]);

function text(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").slice(0, maxLength) : "";
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ ok: false }, { status: 403, headers: { "cache-control": "no-store" } });
  const budget = takePocketBudget(request, "feedback");
  const headers = pocketBudgetHeaders(budget);
  if (!budget.allowed) return NextResponse.json({ ok: false, code: "RATE_LIMITED" }, { status: 429, headers });

  let body: unknown;
  try {
    body = await readBoundedJsonBody(request, 4_096);
  } catch (error) {
    const status = error instanceof RequestBodyTooLargeError ? 413 : 400;
    return NextResponse.json({ ok: false, code: "INVALID_REPORT" }, { status, headers });
  }
  if (!body || typeof body !== "object") return NextResponse.json({ ok: false, code: "INVALID_REPORT" }, { status: 400, headers });
  const record = body as Record<string, unknown>;
  const kind = text(record.kind, 40);
  const note = text(record.note, 1_000);
  const context = text(record.context, 500);
  if (!KINDS.has(kind) || note.length < 10) return NextResponse.json({ ok: false, code: "INVALID_REPORT" }, { status: 400, headers });

  const recipient = process.env.POCKET_FEEDBACK_TO?.trim() || "hello@nashaimarkets.com";
  const result = await dispatchLaunchEmail({
    to: recipient,
    idempotencyKey: `pocket-feedback:${randomUUID()}`,
    email: {
      template: "pocket-feedback",
      subject: `Pocket Bullseye feedback — ${kind.replaceAll("_", " ")}`,
      text: [
        `Category: ${kind}`,
        `Report:\n${note}`,
        context ? `Non-sensitive result context:\n${context}` : "No result context supplied.",
        "No chart image, account information or payment information is attached.",
      ].join("\n\n"),
    },
  });
  if (result.status !== "sent") return NextResponse.json({ ok: false, code: "DELIVERY_UNAVAILABLE" }, { status: 503, headers });
  return NextResponse.json({ ok: true }, { headers });
}
