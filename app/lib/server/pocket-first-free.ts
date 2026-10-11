import { AsyncLocalStorage } from "node:async_hooks";
import { createHash } from "node:crypto";

export type FirstFreeIdentity = { id: string; email: string };
export type FirstFreeRpc = { rpc: (name: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }> };
type Scope = { client: FirstFreeRpc; args: Record<string, unknown>; dispatched: boolean; claim?: Promise<void>; signal: AbortSignal };
const scopes = new AsyncLocalStorage<Scope>();
export function isPocketFirstFreeRequest() { return !!scopes.getStore(); }
const identities = new WeakMap<Request, FirstFreeIdentity>();
export function rememberPocketFirstFreeIdentity(request: Request, user: FirstFreeIdentity) { identities.set(request, user); }
const digest = (value: string) => createHash("sha256").update(value).digest("hex");
export function firstFreePayloadKeys(payload: Record<string, unknown>) {
  return { imageKey: digest(JSON.stringify([payload.image, payload.contextImage || ""])), requestKey: digest(JSON.stringify(payload)) };
}
const unavailable = () => Response.json({ error: "Your free scan could not be verified. Please retry shortly.", code: "POCKET_FREE_UNAVAILABLE" }, { status: 503, headers: { "Cache-Control": "private, no-store" } });
async function rpc(client: FirstFreeRpc, name: string, args: Record<string, unknown>) {
  const { data, error } = await client.rpc(name, args);
  if (error || !data || typeof data !== "object" || Array.isArray(data)) throw new Error("Free access ledger unavailable");
  return data as Record<string, unknown>;
}

/** Called by the shared OpenAI client immediately before every actual dispatch.
 * All parallel main/geometry calls share one exclusive request claim. An aborted
 * response after dispatch never replenishes the allowance. SDK retries stay off. */
export async function claimPocketFirstFreeProviderDispatch(): Promise<void> {
  const scope = scopes.getStore();
  if (!scope) return;
  scope.signal.throwIfAborted();
  scope.claim ??= (async () => {
    const result = await rpc(scope.client, "claim_pocket_first_free", scope.args);
    if (result.ok !== true) throw new Error("Free provider admission denied");
    scope.dispatched = true;
  })();
  await scope.claim;
  scope.signal.throwIfAborted();
}

export async function executePocketFirstFreeRequest(request: Request, user: FirstFreeIdentity, client: FirstFreeRpc, run: () => Promise<Response>): Promise<Response> {
  const phase = new URL(request.url).pathname.split("/").at(-1);
  if (phase !== "preflight" && phase !== "analyse") return Response.json({ error: "This tool requires a subscription.", code: "POCKET_SUBSCRIPTION_REQUIRED" }, { status: 403 });
  if (request.signal.aborted) return new Response(null, { status: 499 });
  let scope: Scope | undefined;
  try {
    // Bound the entire upload before parsing, including chunked bodies and extra
    // attacker-controlled fields. Two maximum images fit in this transport cap.
    const maxBytes = 23_000_000;
    const declaredLength = Number(request.headers.get("content-length") || 0);
    const tooLarge = () => Response.json({ error: "Chart upload is too large." }, { status: 413 });
    if (declaredLength > maxBytes) return tooLarge();
    const reader = request.clone().body?.getReader();
    const chunks: Uint8Array[] = []; let total = 0;
    if (reader) {
      try {
        while (true) {
          request.signal.throwIfAborted();
          const { value, done } = await reader.read();
          if (done) break;
          total += value.byteLength;
          if (total > maxBytes) { void reader.cancel().catch(() => undefined); return tooLarge(); }
          chunks.push(value);
        }
      } finally { reader.releaseLock(); }
    }
    let payload: unknown;
    try { payload = JSON.parse(Buffer.concat(chunks, total).toString("utf8")); }
    catch { return Response.json({ error: "Invalid chart upload." }, { status: 400 }); }
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) return Response.json({ error: "Invalid chart upload." }, { status: 400 });
    const record = payload as Record<string, unknown>;
    const imageValid = (image: unknown) => typeof image === "string" && image.length <= 11_000_000 && /^data:image\/(jpeg|png|webp);base64,/.test(image);
    if (!imageValid(record.image) || (record.contextImage && !imageValid(record.contextImage))) return Response.json({ error: "Please upload valid chart images under 8 MB." }, { status: 400 });
    if (phase === "analyse" && (!record.chartConfirmation || typeof record.chartConfirmation !== "object")) return Response.json({ error: "Confirm chart facts before your free analysis." }, { status: 400 });
    const keys = firstFreePayloadKeys(record);
    const args = { p_user_id: user.id, p_email_hash: digest(user.email.trim().toLowerCase()), p_phase: phase, p_image_key: keys.imageKey, p_request_key: keys.requestKey };
    const reserved = await rpc(client, "reserve_pocket_first_free", args);
    if (reserved.status === "replay" && reserved.response_status === 200 && reserved.response_body && typeof reserved.response_body === "object") return Response.json(reserved.response_body, { headers: { "Cache-Control": "private, no-store", "x-pocket-free-replay": "1" } });
    if (reserved.allowed !== true || reserved.status !== "reserved" || typeof reserved.lease !== "string" || !reserved.lease) {
      if (reserved.status === "interrupted") return Response.json({ error: "Your free scan was interrupted after admission. It cannot be run again for free. If its result arrives, retrying this exact upload can recover it.", code: "POCKET_FREE_INTERRUPTED" }, { status: 503, headers: { "Cache-Control": "private, no-store" } });
      const busy = reserved.status === "busy";
      return Response.json({ error: busy ? "Your free scan is still running. Retry shortly to recover its result." : reserved.status === "preflight_required" ? "Complete a readable preflight for this exact chart before your free analysis." : "Your free allowance is unavailable or already used. A subscription is required for more scans.", code: busy ? "POCKET_FREE_BUSY" : "POCKET_FREE_REQUIRED" }, { status: busy ? 409 : 403, headers: { "Cache-Control": "private, no-store", ...(busy ? { "Retry-After": "5" } : {}) } });
    }
    scope = { client, args: { ...args, p_lease: reserved.lease }, signal: request.signal, dispatched: false };
    const response = await scopes.run(scope, run);
    const text = await response.clone().text();
    const body = text && text.length <= 1_000_000 ? JSON.parse(text) as unknown : null;
    const finished = await rpc(client, "finish_pocket_first_free", { ...scope.args, p_dispatched: scope.dispatched, p_response_status: response.status, p_response_body: body });
    if (finished.ok !== true) return unavailable();
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  } catch {
    // Database failures leave uncertain dispatches consumed. Release is permitted
    // only if the DB independently knows that dispatch has never been claimed.
    if (scope) await rpc(client, "finish_pocket_first_free", { ...scope.args, p_dispatched: scope.dispatched, p_response_status: 503, p_response_body: { error: "Free scan interrupted; no additional free provider request will be made." } }).catch(() => undefined);
    return unavailable();
  }
}

export async function withPocketFirstFreeRequest(request: Request, run: () => Promise<Response>): Promise<Response> {
  const user = identities.get(request);
  if (!user) return run();
  const { createAdminClient } = await import("../../../utils/supabase/admin.ts");
  return executePocketFirstFreeRequest(request, user, createAdminClient(), run);
}
