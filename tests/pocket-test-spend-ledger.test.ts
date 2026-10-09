import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import {
  HARD_TEST_CAP_MICRO_USD,
  reservePocketTestSpend,
  submitPocketTestSpend,
  settlePocketTestSpend,
  voidPocketTestSpend,
} from "../app/api/pocket/torture/spend-ledger.ts";

type RpcResult = { data: unknown; error: null | { code?: string; message?: string } };

function fakeRpc(results: RpcResult[]) {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  return {
    calls,
    client: {
      async rpc(name: string, args: Record<string, unknown>) {
        calls.push({ name, args });
        return results.shift() ?? { data: null, error: { message: "unexpected RPC" } };
      },
    },
  };
}

const reservation = {
  ledgerKey: "pocket-image-torture-v1",
  requestKey: "range-clear:attempt-1",
  projectRef: "project-ref-from-verified-export",
  ownerApprovalRef: "approval-after-cost-reconciliation",
  estimatedMicroUsd: 180_000,
};

test("reservation uses integer micro-dollars and the atomic Supabase RPC", async () => {
  const rpc = fakeRpc([{ data: { allowed: true, reservation_id: "r-1", status: "reserved", committed_microusd: 180_000, remaining_microusd: 1_820_000 }, error: null }]);
  const result = await reservePocketTestSpend(rpc.client, reservation);

  assert.equal(HARD_TEST_CAP_MICRO_USD, 2_000_000);
  assert.deepEqual(rpc.calls, [{
    name: "reserve_pocket_test_spend",
    args: {
      p_ledger_key: reservation.ledgerKey,
      p_request_key: reservation.requestKey,
      p_project_ref: reservation.projectRef,
      p_owner_approval_ref: reservation.ownerApprovalRef,
      p_estimated_microusd: reservation.estimatedMicroUsd,
    },
  }]);
  assert.equal(result.allowed, true);
});

test("ledger client fails closed on RPC errors, malformed replies and unsafe amounts", async () => {
  const failed = fakeRpc([{ data: null, error: { code: "P0001", message: "ledger disabled" } }]);
  await assert.rejects(() => reservePocketTestSpend(failed.client, reservation), /spend ledger unavailable/i);

  const malformed = fakeRpc([{ data: { allowed: true }, error: null }]);
  await assert.rejects(() => reservePocketTestSpend(malformed.client, reservation), /invalid spend ledger response/i);

  await assert.rejects(() => reservePocketTestSpend(fakeRpc([]).client, { ...reservation, estimatedMicroUsd: 0 }), /positive integer/i);
  await assert.rejects(() => reservePocketTestSpend(fakeRpc([]).client, { ...reservation, estimatedMicroUsd: HARD_TEST_CAP_MICRO_USD + 1 }), /hard cap/i);
});

test("submitted work cannot be released; settlement records actual provider cost", async () => {
  const rpc = fakeRpc([
    { data: { ok: true, reservation_id: "r-1", status: "submitted", claimed: true }, error: null },
    { data: { ok: true, reservation_id: "r-1", status: "settled", actual_microusd: 177_250, cap_exceeded: false }, error: null },
    { data: { ok: true, reservation_id: "r-2", status: "voided" }, error: null },
  ]);

  await submitPocketTestSpend(rpc.client, { ledgerKey: reservation.ledgerKey, requestKey: reservation.requestKey });
  await settlePocketTestSpend(rpc.client, { ledgerKey: reservation.ledgerKey, requestKey: reservation.requestKey, actualMicroUsd: 177_250, providerRequestId: "req-safe-redacted" });
  await voidPocketTestSpend(rpc.client, { ledgerKey: reservation.ledgerKey, requestKey: "never-dispatched:attempt-1", reason: "cancelled before dispatch" });

  assert.deepEqual(rpc.calls.map(call => call.name), [
    "submit_pocket_test_spend",
    "settle_pocket_test_spend",
    "void_pocket_test_spend",
  ]);
});

test("only the first atomic submit claimant may dispatch a provider request", async () => {
  const rpc = fakeRpc([
    { data: { ok: true, reservation_id: "r-1", status: "submitted", claimed: true }, error: null },
    { data: { ok: true, reservation_id: "r-1", status: "submitted", claimed: false }, error: null },
  ]);
  const first = await submitPocketTestSpend(rpc.client, { ledgerKey: reservation.ledgerKey, requestKey: reservation.requestKey });
  const duplicate = await submitPocketTestSpend(rpc.client, { ledgerKey: reservation.ledgerKey, requestKey: reservation.requestKey });
  assert.equal(first.claimed, true);
  assert.equal(duplicate.claimed, false);
});

test("migration keeps reservations private, atomic and closed until reconciled approval", async () => {
  const migrations = new URL("../supabase/migrations/", import.meta.url);
  const sql = await readFile(new URL("20261009191944_pocket_test_spend_reservations.sql", migrations), "utf8");

  assert.match(sql, /create schema if not exists private/);
  assert.match(sql, /historical_spend_microusd bigint/);
  assert.match(sql, /historical_attribution_complete boolean not null default false/);
  assert.match(sql, /owner_approved_at timestamptz/);
  assert.match(sql, /enabled boolean not null default false/);
  assert.match(sql, /cap_microusd bigint not null[\s\S]*cap_microusd <= 2000000/);
  assert.match(sql, /for update/);
  assert.match(sql, /status in \('reserved', 'submitted', 'settled'\)/);
  assert.match(sql, /status = 'reserved'/);
  assert.doesNotMatch(sql, /expires_at|interval\s+'|delete from private\.pocket_test_spend_reservations/i);
  assert.doesNotMatch(sql, /insert into private\.pocket_test_spend_ledgers/i);
  assert.match(sql, /security definer[\s\S]*set search_path = pg_catalog, private/);
  assert.match(sql, /revoke all on function public\.reserve_pocket_test_spend[\s\S]*from public, anon, authenticated/);
  assert.match(sql, /grant execute on function public\.reserve_pocket_test_spend[\s\S]*to service_role/);
});
