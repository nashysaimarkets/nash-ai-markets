import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { readPrecisionReceipt, signPrecisionReceipt } from "../app/api/pocket/precision-receipt";

function expression(path: string, match: (node: ts.Node) => boolean) {
  const source = fs.readFileSync(new URL(path, import.meta.url), "utf8");
  const ast = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let found: ts.Node | undefined;
  const walk = (node: ts.Node) => { if (match(node)) found = node; else ts.forEachChild(node, walk); };
  walk(ast); assert.ok(found);
  return ts.transpileModule(`var action = ${found.getText(ast)}`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
}

test("the actual precision path accepts signed reuse before reserving provider capacity", async () => {
  const source = expression("../app/api/pocket/analyse/route.ts", (node) => ts.isArrowFunction(node) && ts.isVariableDeclaration(node.parent) && node.parent.name.getText() === "firstPrecision");
  const output = '{"levels":[]}';
  let reservations = 0;
  const context: any = { precisionImage: "", contextPrecisionImage: "", accuracyCorrection: null, receiptKey: () => "verified-key", readPrecisionReceipt, precisionReceipts: [signPrecisionReceipt("verified-key", output, "test-only")], process: { env: { OPENAI_API_KEY: "test-only" } }, precisionRescueReasons: () => [], parsePrecisionOutput: JSON.parse, console: { info: () => undefined }, precisionCallBudget: {}, POCKET_PRECISION_INITIAL_MIN_REMAINING_MS: 1, reservePrecisionProviderCall: () => { reservations++; return { allowed: false, reason: "CALL_BUDGET" }; } };
  vm.runInContext(source, vm.createContext(context));
  const reused = await context.action("exact-image", "primary", null);
  assert.equal(reused.output_text, output); assert.equal(reused.reused, true); assert.equal(reservations, 0);
  context.accuracyCorrection = { categories: ["CURRENT_PRICE"] };
  const correction = await context.action("exact-image", "primary", null);
  assert.equal(correction.firstFailure, "CALL_BUDGET"); assert.equal(reservations, 1);
});
