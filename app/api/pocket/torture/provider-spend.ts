import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import { reservePocketTestSpend, submitPocketTestSpend, type ReserveSpendInput, type SpendLedgerRpc } from "./spend-ledger.ts";
import { isCumulativeTestSpendHeld } from "./spending-hold.ts";

type ProviderReceipt = { _request_id?: string | null; id?: string; model?: string; usage?: unknown };

/** Charge uncertainty stays submitted indefinitely. Only reconciled dollar
 * evidence may later settle it; token counts are not authoritative charges. */
export async function executeReservedPocketProviderCall<T extends ProviderReceipt>(
  client: SpendLedgerRpc, input: ReserveSpendInput, dispatch: () => Promise<T>,
): Promise<T> {
  const reserved = await reservePocketTestSpend(client, input);
  if (reserved.allowed !== true || reserved.status !== "reserved") throw new Error("Test spend reservation denied or already dispatched.");
  const claim = await submitPocketTestSpend(client, input);
  if (claim.claimed !== true) throw new Error("Test spend dispatch already claimed.");
  const response = await dispatch();
  if (!response._request_id?.trim() || !response.id?.trim() || !response.model?.trim()) {
    throw new Error("Provider receipt missing; reserved spend remains unresolved.");
  }
  const { data, error } = await client.rpc("record_pocket_test_spend_receipt", {
    p_ledger_key: input.ledgerKey, p_request_key: input.requestKey,
    p_provider_request_id: response._request_id, p_response_id: response.id,
    p_model: response.model, p_usage: response.usage ?? null,
  });
  const receipt = data as Record<string, unknown> | null;
  if (error || receipt?.ok !== true || receipt.status !== "submitted" || receipt.reservation_id !== reserved.reservation_id) {
    throw new Error("Provider receipt persistence failed; reserved spend remains unresolved.");
  }
  return response;
}

type ModelBound = { maxOutputTokens: number; maxCostMicroUsd: number; fullContextCostBoundEvidenceRef: string };
type Scope = {
  client: SpendLedgerRpc;
  ledgerKey: string; projectRef: string; ownerApprovalRef: string;
  attemptKey: string; nextCall: number; bounds: Record<string, ModelBound>;
};
const scopes = new AsyncLocalStorage<Scope>();

/** This scope is established only internally, never from customer headers. */
export async function withPocketTestSpendScope<T>(caseId: string, run: () => Promise<T>): Promise<T> {
  if (isCumulativeTestSpendHeld()) throw new Error("Cumulative test spending remains held.");
  const required = (key: string) => {
    const value = process.env[key]?.trim();
    if (!value || value.length > 200) throw new Error(`Missing verified test spend configuration: ${key}`);
    return value;
  };
  const ledgerKey = required("POCKET_TEST_SPEND_LEDGER_KEY");
  const projectRef = required("POCKET_TEST_OPENAI_PROJECT_ID");
  const ownerApprovalRef = required("POCKET_TEST_SPEND_APPROVAL_REF");
  const bounds = JSON.parse(process.env.POCKET_TEST_MODEL_COST_BOUNDS ?? "null") as Record<string, ModelBound> | null;
  if (!bounds || typeof bounds !== "object" || Array.isArray(bounds) || !Object.keys(bounds).length) throw new Error("Verified full-context model cost bounds missing.");
  for (const bound of Object.values(bounds)) {
    if (!Number.isSafeInteger(bound.maxOutputTokens) || bound.maxOutputTokens < 1
      || !Number.isSafeInteger(bound.maxCostMicroUsd) || bound.maxCostMicroUsd < 1 || bound.maxCostMicroUsd > 2000000
      || typeof bound.fullContextCostBoundEvidenceRef !== "string" || !bound.fullContextCostBoundEvidenceRef.trim()) {
      throw new Error("Invalid verified full-context model cost bound.");
    }
  }
  const { createAdminClient } = await import("../../../../utils/supabase/admin.ts");
  return scopes.run({ client: createAdminClient(), ledgerKey, projectRef, ownerApprovalRef,
    attemptKey: `${caseId}:${randomUUID()}`, nextCall: 0, bounds }, run);
}

export function pocketTestProviderProject(): string | undefined { return scopes.getStore()?.projectRef; }

/** Includes precision retries and optional context calls: each call gets its
 * own reservation. Ordinary customer requests do not enter the test scope. */
export async function dispatchPocketAnalysisProviderCall<T extends ProviderReceipt>(
  model: string, maxOutputTokens: number, dispatch: () => Promise<T>,
): Promise<T> {
  const scope = scopes.getStore();
  if (!scope) return dispatch();
  if (isCumulativeTestSpendHeld()) throw new Error("Cumulative test spending remains held.");
  const bound = scope.bounds[model];
  if (!bound || maxOutputTokens > bound.maxOutputTokens) throw new Error("Provider request exceeds verified model cost bound.");
  return executeReservedPocketProviderCall(scope.client, {
    ledgerKey: scope.ledgerKey, projectRef: scope.projectRef, ownerApprovalRef: scope.ownerApprovalRef,
    requestKey: `${scope.attemptKey}:call-${++scope.nextCall}`, estimatedMicroUsd: bound.maxCostMicroUsd,
  }, dispatch);
}
