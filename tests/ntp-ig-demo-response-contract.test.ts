import assert from "node:assert/strict";
import test from "node:test";
import {
  parseIgDemoAccountSummaries,
  parseIgDemoPositionSummaries,
} from "../app/lib/server/ntp-ig-demo-response-contract.ts";

const account = {
  accountId: "ABC123",
  accountType: "SPREADBET",
  status: "ENABLED",
  currency: "GBP",
  preferred: true,
  accountName: "PRIVATE CUSTOMER NAME",
  balance: { balance: 123.45, available: 100, profitLoss: -5 },
};

const position = {
  market: { epic: "IX.D.SPTRD.DAILY.IP", bid: 5123, offer: 5124 },
  position: {
    dealId: "DEAL-12",
    direction: "SELL",
    size: 0.5,
    level: 5110,
    currency: "GBP",
    stopLevel: 5170,
  },
};

function rejects(fn: () => unknown): void {
  assert.throws(fn, { message: "IG_DEMO_UNEXPECTED_RESPONSE_CONTRACT" });
}

test("valid IG accounts v1 projects only a read-only identity summary", () => {
  const result = parseIgDemoAccountSummaries({ accounts: [account] });
  assert.deepEqual(result, [{
    accountId: "ABC123", accountType: "SPREADBET", status: "ENABLED", currency: "GBP", preferred: true,
  }]);
  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result[0]), true);
  assert.equal(JSON.stringify(result).includes("PRIVATE CUSTOMER NAME"), false);
  assert.equal(JSON.stringify(result).includes("123.45"), false);
});

test("empty valid accounts response is distinct from missing or failed response", () => {
  assert.deepEqual(parseIgDemoAccountSummaries({ accounts: [] }), []);
  for (const value of [null, undefined, {}, { errorCode: "IG_SECRET" }, [], { accounts: null }, { accounts: {} }]) {
    rejects(() => parseIgDemoAccountSummaries(value));
  }
});

test("account IDs are unique and restricted, and preferred must be boolean", () => {
  rejects(() => parseIgDemoAccountSummaries({ accounts: [account, account] }));
  for (const invalid of ["", " account", "ACCOUNT\nsecret", 42, "..//secret", "a".repeat(97)]) {
    rejects(() => parseIgDemoAccountSummaries({ accounts: [{ ...account, accountId: invalid }] }));
  }
  rejects(() => parseIgDemoAccountSummaries({ accounts: [{ ...account, preferred: "true" }] }));
});

test("account enums and ISO currency fail closed on unknown or malformed provider values", () => {
  for (const accountType of [null, "SYNTHETIC", "spreadbet", 0]) {
    rejects(() => parseIgDemoAccountSummaries({ accounts: [{ ...account, accountType }] }));
  }
  for (const status of [null, "UNKNOWN", "DISABLE"]) {
    rejects(() => parseIgDemoAccountSummaries({ accounts: [{ ...account, status }] }));
  }
  for (const currency of [null, "gbp", "GBP\n", "GBPP", "£"]) {
    rejects(() => parseIgDemoAccountSummaries({ accounts: [{ ...account, currency }] }));
  }
});

test("IG accounts v1 permits documented CFD and disabled account metadata without inventing eligibility", () => {
  assert.deepEqual(parseIgDemoAccountSummaries({ accounts: [{
    ...account, accountId: "CFD-1", accountType: "CFD", preferred: false, status: "SUSPENDED_FROM_DEALING", currency: "USD",
  }] })[0], {
    accountId: "CFD-1", accountType: "CFD", preferred: false, status: "SUSPENDED_FROM_DEALING", currency: "USD",
  });
});

test("response list budget rejects unbounded provider arrays", () => {
  rejects(() => parseIgDemoAccountSummaries({ accounts: Array.from({ length: 101 }, (_, i) => ({ ...account, accountId: "A" + i })) }));
  rejects(() => parseIgDemoPositionSummaries({ positions: Array.from({ length: 101 }, (_, i) => ({
    ...position, position: { ...position.position, dealId: "D" + i },
  })) }));
});

test("valid IG positions v2 projects documented data but no quote or unauthorised account metadata", () => {
  const result = parseIgDemoPositionSummaries({ positions: [position] });
  assert.deepEqual(result, [{
    dealId: "DEAL-12", epic: "IX.D.SPTRD.DAILY.IP",
    direction: "SELL", size: 0.5, openLevel: 5110, currency: "GBP",
  }]);
  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result[0]), true);
  assert.equal("accountId" in result[0], false);
  assert.equal("bid" in result[0], false);
  assert.equal("stopLevel" in result[0], false);
});

test("missing positions and opaque errors never masquerade as zero positions", () => {
  assert.deepEqual(parseIgDemoPositionSummaries({ positions: [] }), []);
  for (const raw of [null, {}, { errorCode: "PRIVATE-TOKEN" }, { positions: null }, { positions: false }]) {
    rejects(() => parseIgDemoPositionSummaries(raw));
  }
  rejects(() => parseIgDemoPositionSummaries({ positions: [{}] }));
  rejects(() => parseIgDemoPositionSummaries({ positions: [{ ...position, market: null }] }));
  rejects(() => parseIgDemoPositionSummaries({ positions: [{ ...position, position: null }] }));
});

test("malformed deal IDs, EPICs and duplicates fail closed", () => {
  rejects(() => parseIgDemoPositionSummaries({ positions: [position, position] }));
  for (const dealId of [undefined, "", "test secret", 123]) {
    rejects(() => parseIgDemoPositionSummaries({ positions: [{ ...position, position: { ...position.position, dealId } }] }));
  }
  for (const epic of [undefined, 0, "", "IX.D.INVALID\nHEADER"]) {
    rejects(() => parseIgDemoPositionSummaries({ positions: [{ ...position, market: { ...position.market, epic } }] }));
  }
});

test("size, level, currency and direction are strictly validated without financial coercion", () => {
  for (const size of [0, -1, "0.5", null, Number.NaN, Infinity]) {
    rejects(() => parseIgDemoPositionSummaries({ positions: [{ ...position, position: { ...position.position, size } }] }));
  }
  for (const level of [undefined, null, "5110", Number.NaN, Infinity]) {
    rejects(() => parseIgDemoPositionSummaries({ positions: [{ ...position, position: { ...position.position, level } }] }));
  }
  for (const direction of ["LONG", "sell", null, ""]) {
    rejects(() => parseIgDemoPositionSummaries({ positions: [{ ...position, position: { ...position.position, direction } }] }));
  }
  rejects(() => parseIgDemoPositionSummaries({ positions: [{ ...position, position: { ...position.position, currency: "INVALID" } }] }));
});

test("provider secrets never appear in schema errors", () => {
  try {
    parseIgDemoPositionSummaries({ positions: [{ ...position, position: { dealId: "secret private-token" } }] });
    assert.fail("should have rejected");
  } catch (error) {
    assert.equal((error as Error).message, "IG_DEMO_UNEXPECTED_RESPONSE_CONTRACT");
  }
});
