import assert from "node:assert/strict";
import test from "node:test";
import { appleActionErrorMessage, appleErrorDiagnostic, appleInactiveMessage, createAppleActionCoordinator, formatAppleErrorDiagnostic } from "../app/pocket/apple-purchase-flow";

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

const diagnosticFixture = {
  operation: "purchase", stage: "confirmation",
  errors: [{ domain: "StoreKit.StoreKitError", code: 2 }, { domain: "NSURLErrorDomain", code: -1009 }],
  appVersion: "1.2.12", build: "40", osVersion: "26.6.2",
  environment: "sandbox", storefront: "GBR", currency: "USD",
};

test("unknown Apple failures retain the operation and safe native codes without claiming a cause or payment result", () => {
  const error = { message: "Unable to Complete Request", purchaseDiagnostics: diagnosticFixture };
  const diagnostic = appleErrorDiagnostic(error)!;
  assert.deepEqual(diagnostic, diagnosticFixture);
  assert.match(appleActionErrorMessage(error, "purchase"), /could not complete the purchase/);
  assert.match(appleActionErrorMessage(error, "restore"), /could not complete the restore/);
  assert.doesNotMatch(appleActionErrorMessage(error, "purchase"), /not been charged|wrong password|outage/);
  const text = formatAppleErrorDiagnostic(diagnostic);
  assert.match(text, /confirmation/);
  assert.match(text, /StoreKit\.StoreKitError:2 > NSURLErrorDomain:-1009/);
  assert.match(text, /Storefront: GBR; price currency: USD/);
});

test("support details exclude arbitrary error data, account fields, URLs and untrusted domains", () => {
  const diagnostic = appleErrorDiagnostic({
    userInfo: { email: "private@example.test" },
    purchaseDiagnostics: {
      ...diagnosticFixture, receipt: "secret-receipt", email: "private@example.test",
      stage: "https://private.test/token", appVersion: "private@example.test",
      build: "invalid", storefront: "private@example.test", currency: "<script>",
      errors: [...diagnosticFixture.errors, { domain: "private@example.test", code: 1 }, { domain: "SKErrorDomain", code: Infinity }],
    },
  })!;
  assert.equal(diagnostic.errors.length, 2);
  assert.equal(diagnostic.stage, "unknown");
  assert.equal(diagnostic.appVersion, "unknown");
  assert.equal(diagnostic.build, "unknown");
  assert.equal(diagnostic.storefront, "unknown");
  assert.equal(diagnostic.currency, "unknown");
  assert.doesNotMatch(formatAppleErrorDiagnostic(diagnostic), /private|secret|receipt|script/);
});

test("malformed and old bridge errors have no fabricated diagnostics", () => {
  for (const value of [null, "failure", {}, { purchaseDiagnostics: {} }, { purchaseDiagnostics: { ...diagnosticFixture, operation: "delete" } }, { purchaseDiagnostics: { ...diagnosticFixture, errors: [{ domain: "SKErrorDomain", code: "2" }] } }]) {
    assert.equal(appleErrorDiagnostic(value), null);
  }
  assert.doesNotMatch(appleActionErrorMessage({ message: "Unable to Complete Request" }, "purchase"), /details below/);
  const bounded = appleErrorDiagnostic({ purchaseDiagnostics: { ...diagnosticFixture, errors: Array(20).fill({ domain: "ASDErrorDomain", code: 500 }) } })!;
  assert.equal(bounded.errors.length, 4);
});
