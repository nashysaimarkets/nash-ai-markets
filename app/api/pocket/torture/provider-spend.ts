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
      || !Number.isSafeInteger(call.maxCostMicroUsd) || call.maxCostMicroUsd < 1 || call.maxCostMicroUsd > bound.maxCostMicroUsd
      || typeof call.costBoundEvidenceRef !== "string" || !call.costBoundEvidenceRef.trim()) {
      throw new Error("Benchmark call plan does not fit verified model bounds.");
    }
  }
  if (planned.reduce((sum, call) => sum + call.maxCostMicroUsd, 0) > 5_000_000) throw new Error("Benchmark case plan exceeds the separate $5 pilot cap.");
  return { bounds, plan };
}

function envelopeFacts(envelope: ProviderRequestEnvelope) {
  if (envelope.store !== false || envelope.service_tier !== "default") throw new Error("Benchmark request must disable storage and pin the verified service tier.");
  if ("tools" in envelope || "tool_choice" in envelope || "background" in envelope || "previous_response_id" in envelope) throw new Error("Benchmark request contains an unpriced provider feature.");
  const input = Array.isArray(envelope.input) ? envelope.input : [];
  let textChars = typeof envelope.instructions === "string" ? envelope.instructions.length : 0;
  let images = 0;
  let imageBytes = 0;
  for (const message of input) {
    if (!message || typeof message !== "object") throw new Error("Benchmark request input is malformed.");
    const content = Array.isArray((message as Record<string, unknown>).content) ? (message as { content: unknown[] }).content : [];
    for (const item of content) {
      if (!item || typeof item !== "object") throw new Error("Benchmark request content is malformed.");
      const value = item as Record<string, unknown>;
      if (value.type === "input_text") {
        if (typeof value.text !== "string") throw new Error("Benchmark text input is malformed.");
        textChars += value.text.length;
      } else if (value.type === "input_image") {
        if (value.detail !== "high" || typeof value.image_url !== "string" || !/^data:image\/(png|jpeg|webp);base64,/.test(value.image_url)) throw new Error("Benchmark image input is not a bounded high-detail data image.");
        images++;
        imageBytes += Math.floor((value.image_url.length - value.image_url.indexOf(",") - 1) * 3 / 4);
      } else {
        throw new Error("Benchmark request contains an unpriced input type.");
      }
    }
  }
  const text = envelope.text as Record<string, unknown> | undefined;
  const format = text?.format as Record<string, unknown> | undefined;
  if (format?.type !== "json_schema" || format.strict !== true || !format.schema) throw new Error("Benchmark request must use the verified strict schema.");
  return { textChars, images, imageBytes, schemaBytes: Buffer.byteLength(JSON.stringify(format.schema), "utf8") };
}

export function verifyPocketBenchmarkEnvelope(slot: BenchmarkCallSlot, envelope: ProviderRequestEnvelope, scope = scopes.getStore()) {
  if (!scope) return null;
  const planned = scope.plan[slot];
  if (envelope.model !== planned.model || envelope.max_output_tokens !== planned.maxOutputTokens) throw new Error("Provider request does not match the planned model/output bound.");
  const facts = envelopeFacts(envelope);
  if (facts.textChars > planned.maxInputTextChars || facts.schemaBytes > planned.maxSchemaBytes || facts.images > planned.maxImages || facts.imageBytes > planned.maxImageBytes) throw new Error("Provider request exceeds the verified text/schema/image envelope.");
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
  if (!response._request_id?.trim() || !response.id?.trim() || response.model !== facts.model || response.service_tier !== facts.serviceTier) throw new Error("Provider receipt identity/model/tier mismatch; charge remains unresolved.");
  const receipt = await invoke(scope.client, "record_pocket_benchmark_receipt", {
    p_ledger_key: scope.ledgerKey, p_case_id: scope.caseId, p_slot: slot,
    p_provider_request_id: response._request_id, p_response_id: response.id,
    p_model: response.model, p_service_tier: response.service_tier,
    p_usage: response.usage ?? null, p_envelope_sha256: facts.fingerprint,
  });
  if (receipt.ok !== true || receipt.status !== "submitted") throw new Error("Provider receipt persistence failed; charge remains unresolved.");
  return response;
}
