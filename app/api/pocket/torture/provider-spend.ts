import { AsyncLocalStorage } from "node:async_hooks";
import { createHash } from "node:crypto";
import { type SpendLedgerRpc } from "./spend-ledger.ts";
import { isBenchmarkPilotSpendHeld } from "./spending-hold.ts";

export type BenchmarkCallSlot = "main" | "primary_precision" | "rescue_precision";
export type ProviderRequestEnvelope = Record<string, unknown>;
type ProviderReceipt = { _request_id?: string | null; id?: string; model?: string; service_tier?: string | null; usage?: unknown };
type ModelBound = {
  serviceTier: "default";
  maxOutputTokens: number;
  maxInputTextChars: number;
  maxSchemaBytes: number;
  maxImages: number;
  maxImageBytes: number;
  maxImageWidth: number;
  maxImageHeight: number;
  maxImagePixels: number;
  maxCostMicroUsd: number;
  fullContextCostBoundEvidenceRef: string;
};
type PlannedCall = {
  slot: BenchmarkCallSlot;
  model: string;
  serviceTier: "default";
  maxOutputTokens: number;
  maxInputTextChars: number;
  maxSchemaBytes: number;
  maxImages: number;
  maxImageBytes: number;
  maxImageWidth: number;
  maxImageHeight: number;
  maxImagePixels: number;
  maxCostMicroUsd: number;
  costBoundEvidenceRef: string;
};
type Scope = {
  client: SpendLedgerRpc;
  ledgerKey: string;
  projectRef: string;
  ownerApprovalRef: string;
  candidateSha: string;
  caseId: string;
  plan: Record<BenchmarkCallSlot, PlannedCall>;
  bounds: Record<string, ModelBound>;
  dispatched: Set<BenchmarkCallSlot>;
};
export type BenchmarkRun<T> = {
  value: T;
  reconciliation: { reconciled: boolean; capExceeded: boolean; committedMicroUsd: number | null };
};
const scopes = new AsyncLocalStorage<Scope>();

function required(key: string) {
  const value = process.env[key]?.trim();
  if (!value || value.length > 200) throw new Error(`Missing verified benchmark configuration: ${key}`);
  return value;
}

export function parsePocketBenchmarkConfiguration() {
  const bounds = JSON.parse(process.env.POCKET_BENCHMARK_MODEL_COST_BOUNDS ?? "null") as Record<string, ModelBound> | null;
  const planned = JSON.parse(process.env.POCKET_BENCHMARK_CALL_PLAN ?? "null") as PlannedCall[] | null;
  if (!bounds || typeof bounds !== "object" || Array.isArray(bounds) || !Object.keys(bounds).length) throw new Error("Verified benchmark model bounds missing.");
  for (const [model, bound] of Object.entries(bounds)) {
    if (!model.trim() || bound.serviceTier !== "default"
      || !Number.isSafeInteger(bound.maxOutputTokens) || bound.maxOutputTokens < 1
      || !Number.isSafeInteger(bound.maxInputTextChars) || bound.maxInputTextChars < 1
      || !Number.isSafeInteger(bound.maxSchemaBytes) || bound.maxSchemaBytes < 1
      || !Number.isSafeInteger(bound.maxImages) || bound.maxImages < 1 || bound.maxImages > 2
      || !Number.isSafeInteger(bound.maxImageBytes) || bound.maxImageBytes < 1
      || !Number.isSafeInteger(bound.maxImageWidth) || bound.maxImageWidth < 1
      || !Number.isSafeInteger(bound.maxImageHeight) || bound.maxImageHeight < 1
      || !Number.isSafeInteger(bound.maxImagePixels) || bound.maxImagePixels < 1
      || !Number.isSafeInteger(bound.maxCostMicroUsd) || bound.maxCostMicroUsd < 1 || bound.maxCostMicroUsd > 5_000_000
      || typeof bound.fullContextCostBoundEvidenceRef !== "string" || !bound.fullContextCostBoundEvidenceRef.trim()) {
      throw new Error("Invalid verified benchmark model bound.");
    }
  }
  const slots: BenchmarkCallSlot[] = ["main", "primary_precision", "rescue_precision"];
  if (!Array.isArray(planned) || planned.length !== slots.length) throw new Error("Complete three-call benchmark plan missing.");
  const plan = Object.fromEntries(planned.map((call) => [call.slot, call])) as Record<BenchmarkCallSlot, PlannedCall>;
  for (const slot of slots) {
    const call = plan[slot];
    const bound = call && bounds[call.model];
    if (!call || call.slot !== slot || !bound || call.serviceTier !== bound.serviceTier
      || !Number.isSafeInteger(call.maxOutputTokens) || call.maxOutputTokens < 1 || call.maxOutputTokens > bound.maxOutputTokens
      || !Number.isSafeInteger(call.maxInputTextChars) || call.maxInputTextChars < 1 || call.maxInputTextChars > bound.maxInputTextChars
      || !Number.isSafeInteger(call.maxSchemaBytes) || call.maxSchemaBytes < 1 || call.maxSchemaBytes > bound.maxSchemaBytes
      || !Number.isSafeInteger(call.maxImages) || call.maxImages < 1 || call.maxImages > bound.maxImages
      || !Number.isSafeInteger(call.maxImageBytes) || call.maxImageBytes < 1 || call.maxImageBytes > bound.maxImageBytes
      || !Number.isSafeInteger(call.maxImageWidth) || call.maxImageWidth < 1 || call.maxImageWidth > bound.maxImageWidth
      || !Number.isSafeInteger(call.maxImageHeight) || call.maxImageHeight < 1 || call.maxImageHeight > bound.maxImageHeight
      || !Number.isSafeInteger(call.maxImagePixels) || call.maxImagePixels < 1 || call.maxImagePixels > bound.maxImagePixels
      || !Number.isSafeInteger(call.maxCostMicroUsd) || call.maxCostMicroUsd < 1 || call.maxCostMicroUsd > bound.maxCostMicroUsd
      || typeof call.costBoundEvidenceRef !== "string" || !call.costBoundEvidenceRef.trim()) {
      throw new Error("Benchmark call plan does not fit verified model bounds.");
    }
  }
  if (planned.reduce((sum, call) => sum + call.maxCostMicroUsd, 0) > 5_000_000) throw new Error("Benchmark case plan exceeds the separate $5 pilot cap.");
  return { bounds, plan };
}

function exactKeys(value: Record<string, unknown>, allowed: readonly string[], label: string) {
  const keys = Object.keys(value);
  if (keys.some((key) => !allowed.includes(key)) || allowed.some((key) => !(key in value))) {
    throw new Error(`Benchmark ${label} shape is not approved.`);
  }
}

function webpDimensions(bytes: Buffer): { width: number; height: number } | null {
  if (bytes.length < 30 || bytes.toString("ascii", 0, 4) !== "RIFF" || bytes.toString("ascii", 8, 12) !== "WEBP") return null;
  let offset = 12;
  while (offset + 8 <= bytes.length) {
    const type = bytes.toString("ascii", offset, offset + 4);
    const size = bytes.readUInt32LE(offset + 4);
    const data = offset + 8;
    if (data + size > bytes.length) return null;
    if (type === "VP8X" && size >= 10) return {
      width: 1 + bytes[data + 4]! + (bytes[data + 5]! << 8) + (bytes[data + 6]! << 16),
      height: 1 + bytes[data + 7]! + (bytes[data + 8]! << 8) + (bytes[data + 9]! << 16),
    };
    if (type === "VP8L" && size >= 5 && bytes[data] === 0x2f) return {
      width: 1 + bytes[data + 1]! + ((bytes[data + 2]! & 0x3f) << 8),
      height: 1 + (bytes[data + 2]! >> 6) + (bytes[data + 3]! << 2) + ((bytes[data + 4]! & 0x0f) << 10),
    };
    if (type === "VP8 " && size >= 10 && bytes[data + 3] === 0x9d && bytes[data + 4] === 0x01 && bytes[data + 5] === 0x2a) return {
      width: bytes.readUInt16LE(data + 6) & 0x3fff,
      height: bytes.readUInt16LE(data + 8) & 0x3fff,
    };
    offset = data + size + (size % 2);
  }
  return null;
}

function jpegDimensions(bytes: Buffer): { width: number; height: number } | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  const sof = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);
  let offset = 2;
  while (offset + 4 <= bytes.length) {
    while (offset < bytes.length && bytes[offset] === 0xff) offset++;
    const marker = bytes[offset++];
    if (marker === undefined || marker === 0xd9 || marker === 0xda) return null;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (offset + 2 > bytes.length) return null;
    const size = bytes.readUInt16BE(offset);
    if (size < 2 || offset + size > bytes.length) return null;
    if (sof.has(marker) && size >= 7) return { height: bytes.readUInt16BE(offset + 3), width: bytes.readUInt16BE(offset + 5) };
    offset += size;
  }
  return null;
}

function decodedImage(value: string) {
  const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  if (!match || match[2]!.length % 4 !== 0) throw new Error("Benchmark image input is not canonical base64 image data.");
  const bytes = Buffer.from(match[2]!, "base64");
  if (!bytes.length || bytes.toString("base64") !== match[2]) throw new Error("Benchmark image input is invalid base64 data.");
  let dimensions: { width: number; height: number } | null = null;
  if (match[1] === "png" && bytes.length >= 24 && bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))
    && bytes.toString("ascii", 12, 16) === "IHDR") dimensions = { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
  else if (match[1] === "jpeg") dimensions = jpegDimensions(bytes);
  else if (match[1] === "webp") dimensions = webpDimensions(bytes);
  if (!dimensions || dimensions.width < 1 || dimensions.height < 1) throw new Error("Benchmark image metadata is invalid or unsupported.");
  return { bytes: bytes.length, ...dimensions, pixels: dimensions.width * dimensions.height };
}

function envelopeFacts(envelope: ProviderRequestEnvelope) {
  exactKeys(envelope, ["model","service_tier","reasoning","store","instructions","input","max_output_tokens","text"], "request");
  if (envelope.store !== false || envelope.service_tier !== "default") throw new Error("Benchmark request must disable storage and pin the verified service tier.");
  const reasoning = envelope.reasoning;
  if (!reasoning || typeof reasoning !== "object" || Array.isArray(reasoning)) throw new Error("Benchmark reasoning shape is not approved.");
  exactKeys(reasoning as Record<string, unknown>, ["effort"], "reasoning");
  if ((reasoning as Record<string, unknown>).effort !== "low") throw new Error("Benchmark reasoning effort is not priced.");
  if (typeof envelope.instructions !== "string") throw new Error("Benchmark instructions are malformed.");
  if (!Array.isArray(envelope.input) || envelope.input.length !== 1) throw new Error("Benchmark request input shape is not approved.");
  const input = envelope.input;
  let textChars = envelope.instructions.length;
  let images = 0;
  let imageBytes = 0;
  let imagePixels = 0;
  let maxImageWidth = 0;
  let maxImageHeight = 0;
  for (const message of input) {
    if (!message || typeof message !== "object" || Array.isArray(message)) throw new Error("Benchmark request input is malformed.");
    exactKeys(message as Record<string, unknown>, ["role","content"], "message");
    if ((message as Record<string, unknown>).role !== "user" || !Array.isArray((message as Record<string, unknown>).content)) throw new Error("Benchmark message is not an approved user message.");
    const content = (message as { content: unknown[] }).content;
    if (content.length < 2 || content.length > 3) throw new Error("Benchmark message content count is not approved.");
    for (const item of content) {
      if (!item || typeof item !== "object" || Array.isArray(item)) throw new Error("Benchmark request content is malformed.");
      const value = item as Record<string, unknown>;
      if (value.type === "input_text") {
        exactKeys(value, ["type","text"], "text item");
        if (typeof value.text !== "string") throw new Error("Benchmark text input is malformed.");
        textChars += value.text.length;
      } else if (value.type === "input_image") {
        exactKeys(value, ["type","image_url","detail"], "image item");
        if (value.detail !== "high" || typeof value.image_url !== "string") throw new Error("Benchmark image input is not a bounded high-detail data image.");
        const decoded = decodedImage(value.image_url);
        images++;
        imageBytes += decoded.bytes;
        imagePixels += decoded.pixels;
        maxImageWidth = Math.max(maxImageWidth, decoded.width);
        maxImageHeight = Math.max(maxImageHeight, decoded.height);
      } else {
        throw new Error("Benchmark request contains an unpriced input type.");
      }
    }
  }
  const text = envelope.text;
  if (!text || typeof text !== "object" || Array.isArray(text)) throw new Error("Benchmark text response shape is malformed.");
  exactKeys(text as Record<string, unknown>, ["format"], "text response");
  const format = (text as Record<string, unknown>).format;
  if (!format || typeof format !== "object" || Array.isArray(format)) throw new Error("Benchmark format is malformed.");
  exactKeys(format as Record<string, unknown>, ["type","name","strict","schema"], "format");
  const typedFormat = format as Record<string, unknown>;
  if (typedFormat.type !== "json_schema" || typedFormat.strict !== true || typeof typedFormat.name !== "string"
    || !/^[a-z0-9_]{1,64}$/.test(typedFormat.name) || !typedFormat.schema || typeof typedFormat.schema !== "object" || Array.isArray(typedFormat.schema)) {
    throw new Error("Benchmark request must use the verified strict schema.");
  }
  return { textChars, images, imageBytes, imagePixels, maxImageWidth, maxImageHeight,
    schemaBytes: Buffer.byteLength(JSON.stringify(format), "utf8") };
}

export function verifyPocketBenchmarkEnvelope(slot: BenchmarkCallSlot, envelope: ProviderRequestEnvelope, scope = scopes.getStore()) {
  if (!scope) return null;
  const planned = scope.plan[slot];
  if (envelope.model !== planned.model || envelope.max_output_tokens !== planned.maxOutputTokens) throw new Error("Provider request does not match the planned model/output bound.");
  const facts = envelopeFacts(envelope);
  if (facts.textChars > planned.maxInputTextChars || facts.schemaBytes > planned.maxSchemaBytes || facts.images > planned.maxImages
    || facts.imageBytes > planned.maxImageBytes || facts.maxImageWidth > planned.maxImageWidth
    || facts.maxImageHeight > planned.maxImageHeight || facts.imagePixels > planned.maxImagePixels) {
    throw new Error("Provider request exceeds the verified text/schema/image envelope.");
  }
  const fingerprint = createHash("sha256").update(JSON.stringify(envelope, (_key, value) =>
    typeof value === "string" && value.startsWith("data:image/") ? `sha256:${createHash("sha256").update(value).digest("hex")}` : value,
  )).digest("hex");
  return { ...facts, fingerprint, model: planned.model, serviceTier: planned.serviceTier, maxOutputTokens: planned.maxOutputTokens };
}

async function invoke(client: SpendLedgerRpc, name: string, args: Record<string, unknown>) {
  const { data, error } = await client.rpc(name, args);
  if (error || !data || typeof data !== "object" || Array.isArray(data)) throw new Error(`Benchmark ledger unavailable (${error?.code ?? "RPC"}).`);
  return data as Record<string, unknown>;
}

/** Deterministic named-case claim; all three possible calls are reserved atomically. */
export async function withPocketTestSpendScope<T>(caseId: string, run: () => Promise<T>): Promise<BenchmarkRun<T>> {
  if (isBenchmarkPilotSpendHeld()) throw new Error("Benchmark pilot spending remains held.");
  if (!/^[a-z0-9][a-z0-9-]{1,79}$/.test(caseId)) throw new Error("Invalid durable benchmark case ID.");
  const ledgerKey = required("POCKET_BENCHMARK_LEDGER_KEY");
  const projectRef = required("POCKET_BENCHMARK_OPENAI_PROJECT_ID");
  const ownerApprovalRef = required("POCKET_BENCHMARK_APPROVAL_REF");
  const candidateSha = required("POCKET_BENCHMARK_CANDIDATE_SHA");
  if (!/^[0-9a-f]{40}$/.test(candidateSha)) throw new Error("Benchmark candidate SHA is not exact.");
  const { bounds, plan } = parsePocketBenchmarkConfiguration();
  const { createAdminClient } = await import("../../../../utils/supabase/admin.ts");
  const client = createAdminClient();
  const claim = await invoke(client, "claim_pocket_benchmark_case", {
    p_ledger_key: ledgerKey, p_case_id: caseId, p_project_ref: projectRef,
    p_owner_approval_ref: ownerApprovalRef, p_candidate_sha: candidateSha, p_plan: Object.values(plan),
  });
  if (claim.allowed !== true || claim.status !== "reserved" || claim.idempotent !== false) throw new Error("Benchmark case is already claimed or its complete reservation was denied.");
  const scope: Scope = { client, ledgerKey, projectRef, ownerApprovalRef, candidateSha, caseId, plan, bounds, dispatched: new Set() };
  const result = await scopes.run(scope, run);
  for (const slot of ["main", "primary_precision", "rescue_precision"] as const) {
    if (!scope.dispatched.has(slot)) await invoke(client, "void_pocket_benchmark_call", { p_ledger_key: ledgerKey, p_case_id: caseId, p_slot: slot, p_reason: "not required by completed conditional path" });
  }
  const postflight = await invoke(client, "assert_pocket_benchmark_case_reconciled", { p_ledger_key: ledgerKey, p_case_id: caseId });
  if (postflight.cap_exceeded === true) throw new Error("Benchmark case exceeds the pilot cap; scoring is vetoed.");
  return {
    value: result,
    reconciliation: {
      reconciled: postflight.reconciled === true,
      capExceeded: postflight.cap_exceeded === true,
      committedMicroUsd: typeof postflight.committed_microusd === "number" ? postflight.committed_microusd : null,
    },
  };
}

async function benchmarkAdmin() {
  const { createAdminClient } = await import("../../../../utils/supabase/admin.ts");
  return createAdminClient();
}

/** Store provisional synthetic-case evidence, but never release it before authoritative settlement. */
export async function recordPocketBenchmarkMeasurement(caseId: string, measurement: unknown) {
  const client = await benchmarkAdmin();
  return invoke(client, "record_pocket_benchmark_measurement", {
    p_ledger_key: required("POCKET_BENCHMARK_LEDGER_KEY"), p_case_id: caseId, p_measurement: measurement,
  });
}

/** Returns measurement evidence only after the ledger's final settlement veto passes. */
export async function releasePocketBenchmarkMeasurement(caseId: string) {
  const client = await benchmarkAdmin();
  return invoke(client, "release_pocket_benchmark_measurement", {
    p_ledger_key: required("POCKET_BENCHMARK_LEDGER_KEY"), p_case_id: caseId,
  });
}

export function pocketTestProviderProject(): string | undefined { return scopes.getStore()?.projectRef; }

function completeProviderUsage(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const usage = value as Record<string, unknown>;
  const input = usage.input_tokens;
  const output = usage.output_tokens;
  const total = usage.total_tokens;
  return Number.isSafeInteger(input) && (input as number) >= 0
    && Number.isSafeInteger(output) && (output as number) >= 0
    && Number.isSafeInteger(total) && total === (input as number) + (output as number);
}

export async function dispatchPocketAnalysisProviderCall<T extends ProviderReceipt>(slot: BenchmarkCallSlot, envelope: ProviderRequestEnvelope, dispatch: () => Promise<T>): Promise<T> {
  const scope = scopes.getStore();
  if (!scope) return dispatch();
  if (isBenchmarkPilotSpendHeld()) throw new Error("Benchmark pilot spending remains held.");
  if (scope.dispatched.has(slot)) throw new Error("Benchmark call slot was already dispatched.");
  const facts = verifyPocketBenchmarkEnvelope(slot, envelope, scope)!;
  const claim = await invoke(scope.client, "submit_pocket_benchmark_call", { p_ledger_key: scope.ledgerKey, p_case_id: scope.caseId, p_slot: slot, p_envelope_sha256: facts.fingerprint });
  if (claim.claimed !== true || claim.status !== "submitted") throw new Error("Benchmark dispatch claim denied.");
  scope.dispatched.add(slot);
  const response = await dispatch();
  if (!response._request_id?.trim() || !response.id?.trim() || response.model !== facts.model || response.service_tier !== facts.serviceTier
    || !completeProviderUsage(response.usage)) throw new Error("Provider receipt identity/model/tier/usage mismatch; charge remains unresolved.");
  const receipt = await invoke(scope.client, "record_pocket_benchmark_receipt", {
    p_ledger_key: scope.ledgerKey, p_case_id: scope.caseId, p_slot: slot,
    p_provider_request_id: response._request_id, p_response_id: response.id,
    p_model: response.model, p_service_tier: response.service_tier,
    p_usage: response.usage, p_envelope_sha256: facts.fingerprint,
  });
  if (receipt.ok !== true || receipt.status !== "submitted") throw new Error("Provider receipt persistence failed; charge remains unresolved.");
  return response;
}
