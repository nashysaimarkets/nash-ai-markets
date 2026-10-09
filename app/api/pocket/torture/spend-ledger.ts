export const HARD_TEST_CAP_MICRO_USD = 2_000_000;

type RpcError = { code?: string; message?: string };
export type SpendLedgerRpc = {
  rpc(name: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: RpcError | null }>;
};

type LedgerReply = Record<string, unknown>;

function requiredText(value: string, label: string) {
  const normalized = value.trim();
  if (!normalized || normalized.length > 200) throw new Error(`${label} must be 1-200 characters.`);
  return normalized;
}

function microUsd(value: number, label: string, allowZero = false) {
  if (!Number.isSafeInteger(value) || value < (allowZero ? 0 : 1)) {
    throw new Error(`${label} must be a ${allowZero ? "non-negative" : "positive"} integer number of micro-dollars.`);
  }
  if (value > HARD_TEST_CAP_MICRO_USD) throw new Error(`${label} exceeds the cumulative $2 hard cap.`);
  return value;
}

async function invoke(client: SpendLedgerRpc, name: string, args: Record<string, unknown>): Promise<LedgerReply> {
  const { data, error } = await client.rpc(name, args);
  if (error) throw new Error(`Spend ledger unavailable (${error.code ?? "RPC"}).`);
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("Invalid spend ledger response.");
  return data as LedgerReply;
}

function validStateReply(reply: LedgerReply, states: string[]) {
  return reply.ok === true && typeof reply.reservation_id === "string" && states.includes(String(reply.status));
}

export type ReserveSpendInput = {
  ledgerKey: string;
  requestKey: string;
  projectRef: string;
  ownerApprovalRef: string;
  estimatedMicroUsd: number;
};

export async function reservePocketTestSpend(client: SpendLedgerRpc, input: ReserveSpendInput) {
  const reply = await invoke(client, "reserve_pocket_test_spend", {
    p_ledger_key: requiredText(input.ledgerKey, "Ledger key"),
    p_request_key: requiredText(input.requestKey, "Request key"),
    p_project_ref: requiredText(input.projectRef, "Project reference"),
    p_owner_approval_ref: requiredText(input.ownerApprovalRef, "Owner approval reference"),
    p_estimated_microusd: microUsd(input.estimatedMicroUsd, "Estimated spend"),
  });
  if (reply.allowed === false && typeof reply.reason === "string") return reply;
  if (reply.allowed !== true || typeof reply.reservation_id !== "string"
    || !["reserved", "submitted", "settled"].includes(String(reply.status))
    || !Number.isSafeInteger(reply.committed_microusd) || !Number.isSafeInteger(reply.remaining_microusd)) {
    throw new Error("Invalid spend ledger response.");
  }
  return reply;
}

type ReservationKey = { ledgerKey: string; requestKey: string };

export async function submitPocketTestSpend(client: SpendLedgerRpc, input: ReservationKey) {
  const reply = await invoke(client, "submit_pocket_test_spend", {
    p_ledger_key: requiredText(input.ledgerKey, "Ledger key"),
    p_request_key: requiredText(input.requestKey, "Request key"),
  });
  if (!validStateReply(reply, ["submitted"]) || typeof reply.claimed !== "boolean") throw new Error("Invalid spend ledger response.");
  return reply;
}

export async function settlePocketTestSpend(client: SpendLedgerRpc, input: ReservationKey & { actualMicroUsd: number; providerRequestId: string }) {
  const reply = await invoke(client, "settle_pocket_test_spend", {
    p_ledger_key: requiredText(input.ledgerKey, "Ledger key"),
    p_request_key: requiredText(input.requestKey, "Request key"),
    p_actual_microusd: microUsd(input.actualMicroUsd, "Actual spend", true),
    p_provider_request_id: requiredText(input.providerRequestId, "Provider request ID"),
  });
  if (!validStateReply(reply, ["settled"]) || !Number.isSafeInteger(reply.actual_microusd)
    || typeof reply.cap_exceeded !== "boolean") throw new Error("Invalid spend ledger response.");
  return reply;
}

export async function voidPocketTestSpend(client: SpendLedgerRpc, input: ReservationKey & { reason: string }) {
  const reply = await invoke(client, "void_pocket_test_spend", {
    p_ledger_key: requiredText(input.ledgerKey, "Ledger key"),
    p_request_key: requiredText(input.requestKey, "Request key"),
    p_reason: requiredText(input.reason, "Void reason"),
  });
  if (!validStateReply(reply, ["voided"])) throw new Error("Invalid spend ledger response.");
  return reply;
}
