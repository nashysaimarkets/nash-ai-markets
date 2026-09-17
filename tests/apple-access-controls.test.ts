import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import AppleAccessControls from "../app/pocket/AppleAccessControls";
import { appleActionErrorMessage, appleErrorDiagnostic, appleInactiveMessage } from "../app/pocket/apple-purchase-flow";
import type { AppleAccessStatus } from "../app/pocket/apple-storekit";

const active: AppleAccessStatus = { isNative: true, entitled: true, freeUseConsumed: true, productId: "monthly", displayName: "Monthly", displayPrice: "£4.99" };
const text = readFileSync(new URL("../app/pocket/AppleAccessControls.tsx", import.meta.url), "utf8");
const tree = ts.createSourceFile("AppleAccessControls.tsx", text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let restoreSource = "";
function visit(node: ts.Node) { if (ts.isFunctionDeclaration(node) && node.name?.text === "restore") restoreSource = node.getText(tree); ts.forEachChild(node, visit); }
visit(tree);
assert.ok(restoreSource);

function harness(restore: () => Promise<AppleAccessStatus>) {
  const h: vm.Context = {
    Error, running: { current: false }, mounted: { current: true },
    calls: 0, access: active, events: [], restoring: false, message: "", diagnostic: null,
    restoreAppleSubscription: () => { h.calls++; return restore(); },
    onStatus: (status: AppleAccessStatus) => { h.access = status; },
    trackGrowth: (event: string) => h.events.push(event),
    appleActionErrorMessage, appleErrorDiagnostic, appleInactiveMessage,
  };
  for (const name of ["Restoring", "Message", "Diagnostic"]) h[`set${name}`] = (value: unknown) => { h[name[0].toLowerCase() + name.slice(1)] = value; };
  vm.runInContext(ts.transpile(restoreSource, { target: ts.ScriptTarget.ES2022 }), vm.createContext(h));
  return h;
}

test("Restore remains available with active access, an unused free analysis, spent allowance or unknown status", () => {
  for (const status of [active, { ...active, entitled: false, freeUseConsumed: false }, { ...active, entitled: false }, null]) {
    const html = renderToStaticMarkup(createElement(AppleAccessControls, { status, onStatus: () => undefined }));
    assert.match(html, /<button type="button">RESTORE PURCHASES<\/button>/);
    assert.doesNotMatch(html, /SUBSCRIBE FOR|onClick=/);
    if (status?.entitled) assert.match(html, /Subscription active/);
    if (status && !status.entitled && !status.freeUseConsumed) assert.match(html, /One free analysis available/);
    if (status && !status.entitled && status.freeUseConsumed) assert.match(html, /App updates do not renew it/);
  }
});

test("rapid Restore taps share one request and active access is reported only after Apple returns", async () => {
  let finish!: (value: AppleAccessStatus) => void;
  const h = harness(() => new Promise(resolve => { finish = resolve; }));
  const pending = h.restore();
  await h.restore();
  assert.equal(h.calls, 1); assert.equal(h.restoring, true); assert.equal(h.message, "");
  finish(active); await pending;
  assert.equal(h.message, "Restore complete. Your subscription is active.");
  assert.deepEqual(h.events, ["restore_completed"]); assert.equal(h.restoring, false);
});

test("an inactive restore updates access without claiming success or changing the free allowance", async () => {
  const inactive = { ...active, entitled: false };
  const h = harness(async () => inactive); await h.restore();
  assert.equal(h.access, inactive); assert.equal(h.access.freeUseConsumed, true);
  assert.match(h.message, /No active Pocket Bullseye subscription/); assert.deepEqual(h.events, []);
});

test("cancelling Restore preserves existing access and leaves the button usable", async () => {
  const h = harness(async () => { throw { code: "STORE_PURCHASE_CANCELLED", message: "User cancelled" }; });
  await h.restore();
  assert.equal(h.access, active); assert.match(h.message, /Restore cancelled/);
  assert.equal(h.restoring, false); assert.equal(h.running.current, false); assert.deepEqual(h.events, []);
});

test("leaving the screen during Restore never updates the unmounted control", async () => {
  let finish!: (value: AppleAccessStatus) => void;
  const h = harness(() => new Promise(resolve => { finish = resolve; }));
  const pending = h.restore(); h.mounted.current = false;
  finish({ ...active, entitled: false }); await pending;
  assert.equal(h.access, active); assert.equal(h.message, ""); assert.deepEqual(h.events, []);
});
