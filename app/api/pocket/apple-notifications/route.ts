import { createPocketAppleVerifier } from "../../../lib/server/pocket-apple-access";
import { verifyPocketAppleEvent } from "../../../lib/server/pocket-apple-events";
import { createAdminClient } from "../../../../utils/supabase/admin";
export const runtime = "nodejs";
export const maxDuration = 30;
export async function POST(request: Request) {
  const headers = { "Cache-Control": "private, no-store" };
  // Bound the stream, including chunked transfers with no content-length.
  let proof: unknown;
  try {
    const reader = request.body?.getReader();
    if (!reader) return Response.json({ error: "Missing notification." }, { status: 400, headers });
    const chunks: Uint8Array[] = []; let size = 0;
    while (true) {
      const chunk = await reader.read(); if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > 66000) { await reader.cancel(); return Response.json({ error: "Notification too large." }, { status: 413, headers }); }
      chunks.push(chunk.value);
    }
    proof = (JSON.parse(Buffer.concat(chunks).toString("utf8")) as { signedPayload?: unknown }).signedPayload;
  } catch { return Response.json({ error: "Invalid notification." }, { status: 400, headers }); }
  if (typeof proof !== "string" || !proof || proof.length > 64000) return Response.json({ error: "Invalid notification." }, { status: 400, headers });
  try {
    const { verifier, environment, appId } = await createPocketAppleVerifier();
    let event;
    try {
      event = await verifyPocketAppleEvent(proof, { environment, appId,
        verifyNotification: value => verifier.verifyAndDecodeNotification(value),
        verifyTransaction: value => verifier.verifyAndDecodeTransaction(value) });
    } catch { return Response.json({ error: "Apple signature or identity could not be verified." }, { status: 400, headers }); }
    const { data, error } = await createAdminClient().rpc("record_pocket_apple_event", {
      p_environment: event.environment, p_notification_id: event.id, p_type: event.type,
      p_subtype: event.subtype, p_signed_date: event.signedDate, p_original_transaction_id: event.originalTransactionId, p_digest: event.digest,
    });
    if (error || data !== true) throw new Error("Apple event persistence unavailable");
    return Response.json({ received: true }, { headers });
  } catch { return Response.json({ error: "Apple notification handling is unavailable; retry delivery." }, { status: 503, headers }); }
}
