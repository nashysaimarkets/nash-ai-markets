import assert from "node:assert/strict";
import test from "node:test";
import { appleActionErrorMessage, appleInactiveMessage, createAppleActionCoordinator } from "../app/pocket/apple-purchase-flow";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

test("closing and reopening during a purchase attaches to the same request without purchasing twice", async () => {
  const apple = deferred<{ entitled: boolean }>();
  let purchaseCalls = 0;
  let restoreCalls = 0;
  const flow = createAppleActionCoordinator({
    purchase: () => { purchaseCalls++; return apple.promise; },
    restore: async () => { restoreCalls++; return { entitled: false }; },
  });
  const first = flow.run("purchase");
  assert.equal(flow.pending()?.kind, "purchase");
  const reopened = flow.run("purchase");
  assert.equal(first, reopened);
  await assert.rejects(flow.run("restore"), /previous request/);
  assert.equal(purchaseCalls, 1);
  assert.equal(restoreCalls, 0);
  apple.resolve({ entitled: true });
  assert.deepEqual(await reopened, { entitled: true });
  assert.equal(flow.pending(), null);
  assert.deepEqual(await flow.run("restore"), { entitled: false });
  assert.equal(restoreCalls, 1);
});

test("a cancelled request releases the action lock and a later attempt can succeed", async () => {
  const apple = deferred<{ entitled: boolean }>();
  let attempts = 0;
  const flow = createAppleActionCoordinator({
    purchase: () => ++attempts === 1 ? apple.promise : Promise.resolve({ entitled: true }),
    restore: async () => ({ entitled: false }),
  });
  const first = flow.run("purchase");
  apple.reject({ code: "STORE_PURCHASE_CANCELLED", message: "Purchase cancelled." });
  await assert.rejects(first);
  assert.equal(flow.pending(), null);
  assert.deepEqual(await flow.run("purchase"), { entitled: true });
  assert.equal(attempts, 2);
});

test("synchronous bridge failures also release the action lock", async () => {
  const flow = createAppleActionCoordinator({
    purchase: () => { throw new Error("Bridge unavailable"); },
    restore: async () => ({ entitled: false }),
  });
  await assert.rejects(flow.run("purchase"), /Bridge unavailable/);
  assert.equal(flow.pending(), null);
  await flow.run("restore");
});

test("native error objects remain readable and unconfirmed payments are not described as uncharged", () => {
  assert.equal(appleActionErrorMessage({ code: "STORE_PRODUCT_UNAVAILABLE", message: "Product unavailable from Apple" }, "purchase"), "Product unavailable from Apple");
  assert.match(appleActionErrorMessage({ code: "STORE_PURCHASE_CANCELLED" }, "purchase"), /not been charged/);
  assert.match(appleActionErrorMessage({ message: "User canceled" }, "restore"), /Restore cancelled/);
  assert.doesNotMatch(appleInactiveMessage("purchase"), /not been charged/);
  assert.match(appleInactiveMessage("purchase"), /restore purchases before/);
  assert.match(appleInactiveMessage("restore"), /No active/);
});
