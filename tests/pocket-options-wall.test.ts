import test from "node:test";
import assert from "node:assert/strict";
import { crossCheckOptionsWall } from "../app/pocket/options-wall.ts";

const read = { symbol: "NASDAQ:AAPL", readable: true, limitation: "", rows: [
  { side: "CALL" as const, strike: 200, volume: 12000, expiry: "2026-10-02" },
  { side: "PUT" as const, strike: 180, volume: 8000, expiry: "2026-10-02" },
] };
const levels = [{ kind: "resistance", price: "200.25", label: "Prior high" }, { kind: "support", price: "160", label: "Base" }];

test("reports a visible overlap without treating a call as resistance", () => {
  const result = crossCheckOptionsWall(read, "AAPL", levels);
  assert.equal(result.status, "MATCHED");
  assert.equal(result.matches.length, 1);
  assert.equal(result.matches[0].level.price, 200.25);
  assert.match(result.message, /not a directional signal/);
});

test("holds mismatched, unidentified and unreadable symbols", () => {
  assert.equal(crossCheckOptionsWall(read, "MSFT", levels).status, "UNVERIFIED");
  assert.equal(crossCheckOptionsWall(read, "UNKNOWN", levels).status, "UNVERIFIED");
  assert.equal(crossCheckOptionsWall({ ...read, readable: false }, "AAPL", levels).status, "UNVERIFIED");
});

test("never creates matches from missing levels, invalid prices or distant strikes", () => {
  assert.equal(crossCheckOptionsWall(read, "AAPL", [{ kind: "support", price: "unknown", label: "" }]).status, "UNVERIFIED");
  assert.equal(crossCheckOptionsWall(read, "AAPL", [{ kind: "resistance", price: "201.50", label: "" }]).status, "NO_OVERLAP");
  assert.equal(crossCheckOptionsWall({ ...read, rows: [{ ...read.rows[0], expiry: "" }] }, "AAPL", levels).status, "UNVERIFIED");
});
