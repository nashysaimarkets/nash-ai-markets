import test from "node:test";
import assert from "node:assert/strict";
import OpenAI from "openai";
import { completedPocketReportOutput, PocketReportCompletionError } from "../app/api/pocket/report-completion";
for (const status of ["completed", "incomplete"] as const) {
  test(`the installed SDK retains strict report validation for a ${status} stream`, async () => {
    let body: any;
    const output = [{ type: "message", id: "test-message", role: "assistant", status: "completed", content: [{ type: "output_text", text: status === "completed" ? '{"ok":true}' : '{"ok":', annotations: [] }] }];
    const base = { id: "test-response", object: "response", created_at: 1, model: "test", output: [], status: "in_progress" };
    const final = { ...base, status, output, incomplete_details: status === "incomplete" ? { reason: "max_output_tokens" } : null };
    const events = [{ type: "response.created", response: base, sequence_number: 0 }, { type: `response.${status}`, response: final, sequence_number: 1 }];
    const client = new OpenAI({ apiKey: "test-only", maxRetries: 0, fetch: async (_url, init) => {
      body = JSON.parse(String(init?.body));
      return new Response(events.map(event => `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`).join("")+"data: [DONE]\n\n", { headers: { "content-type": "text/event-stream" } });
    } });
    const result = await client.responses.stream({ model: "test", input: "test", store: false, text: { format: { type: "json_schema", name: "test", strict: true, schema: { type: "object", properties: { ok: { type: "boolean" } }, required: ["ok"], additionalProperties: false } } } }).finalResponse();
    assert.equal(body.stream, true); assert.equal(body.store, false); assert.equal(body.text.format.strict, true);
    if (status === "completed") assert.equal(completedPocketReportOutput(result), '{"ok":true}');
    else assert.throws(() => completedPocketReportOutput(result), PocketReportCompletionError);
  });
}
