import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const pocketAiPosts = [
  "analyse",
  "preflight",
  "levels",
  "follow-up",
  "review",
] as const;

for (const route of pocketAiPosts) {
  test(`${route} rejects cross-origin requests before body or provider work`, async () => {
    const source = await readFile(new URL(`../app/api/pocket/${route}/route.ts`, import.meta.url), "utf8");
    const handlerStart = source.indexOf("export async function POST(request: Request)");
    const originCheck = source.indexOf("const crossOrigin = rejectCrossOrigin(request)", handlerStart);
    const boundedBodyRead = source.indexOf("readBoundedJsonBody(request", handlerStart);
    const budgetUse = source.indexOf("takePocketBudget(request", handlerStart);
    const providerUse = source.indexOf("createOpenAIClient(", handlerStart);

    assert.match(source, /import \{ rejectCrossOrigin \} from "\.\.\/\.\.\/\.\.\/lib\/server\/same-origin"/);
    assert.match(source, /import \{ readBoundedJsonBody, RequestBodyTooLargeError \} from "\.\.\/\.\.\/\.\.\/lib\/server\/bounded-json-body"/);
    assert.ok(handlerStart >= 0 && originCheck > handlerStart, "origin guard must be inside POST");
    assert.ok(boundedBodyRead > originCheck, "bounded body reader must run after the origin guard");
    assert.doesNotMatch(source.slice(handlerStart), /request\.json\(\)/);
    for (const boundary of [boundedBodyRead, budgetUse, providerUse].filter((index) => index >= 0)) {
      assert.ok(originCheck < boundary, "origin guard must run before body, budget and provider work");
    }
    assert.match(source.slice(originCheck, originCheck + 120), /if \(crossOrigin\) return crossOrigin/);
  });
}
