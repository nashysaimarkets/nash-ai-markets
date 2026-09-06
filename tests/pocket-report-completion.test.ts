import assert from "node:assert/strict";
import test from "node:test";
import { completedPocketReportOutput, PocketReportCompletionError } from "../app/api/pocket/report-completion.ts";

test("an incomplete report is rejected for every provider reason", () => {
  for (const reason of ["max_output_tokens", "content_filter", "provider_deadline"]) {
    assert.throws(
      () => completedPocketReportOutput({ status: "incomplete", output_text: '{"partial":true}', incomplete_details: { reason } }),
      (error: unknown) => error instanceof PocketReportCompletionError && error.reason === reason,
    );
  }
});

test("the live token-limit failure remains identifiable without exposing partial chart data", () => {
  assert.throws(
    () => completedPocketReportOutput({ status: "incomplete", output_text: '{"currentPrice":"7708.49"', incomplete_details: { reason: "max_output_tokens" } }),
    (error: unknown) => error instanceof PocketReportCompletionError
      && error.reason === "max_output_tokens"
      && !error.message.includes("7708.49"),
  );
});

test("completed reports must contain one valid JSON object", () => {
  assert.throws(() => completedPocketReportOutput({ status: "completed", output_text: "" }), /empty/);
  assert.throws(() => completedPocketReportOutput({ status: "completed", output_text: '{"broken"' }), /invalid JSON/);
  assert.throws(() => completedPocketReportOutput({ status: "completed", output_text: "[]" }), /JSON object/);
  assert.equal(completedPocketReportOutput({ status: "completed", output_text: ' {"valid":true} ' }), '{"valid":true}');
});
