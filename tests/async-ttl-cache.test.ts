import assert from "node:assert/strict";
import test from "node:test";
import { createAsyncTtlCache } from "../app/lib/server/async-ttl-cache.ts";

test("coalesces concurrent server reads and reuses a value until expiry", async () => {
  let now = 1_000;
  let loads = 0;
  const cache = createAsyncTtlCache<number>({ ttlMs: 100, now: () => now });
  const loader = async () => {
    loads += 1;
    await Promise.resolve();
    return loads;
  };

  assert.deepEqual(await Promise.all([cache.get(loader), cache.get(loader), cache.get(loader)]), [1, 1, 1]);
  assert.equal(await cache.get(loader), 1);
  assert.equal(loads, 1);

  now += 101;
  assert.equal(await cache.get(loader), 2);
  assert.equal(loads, 2);
});

test("does not retain failures unless a short failure TTL is configured", async () => {
  let loads = 0;
  const uncachedFailure = createAsyncTtlCache<string>({
    ttlMs: 100,
    isFailure: (value) => value === "unavailable",
  });
  const loader = async () => {
    loads += 1;
    return "unavailable";
  };

  await uncachedFailure.get(loader);
  await uncachedFailure.get(loader);
  assert.equal(loads, 2);
});
