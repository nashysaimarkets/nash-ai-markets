import assert from "node:assert/strict";
import test from "node:test";
import { isOwnerOnlyStagingRequest } from "../app/lib/server/staging-owner-preview.ts";

test("owner preview is limited to the exact private Sites host", () => {
  assert.equal(
    isOwnerOnlyStagingRequest(new Headers({
      host: "nash-ai-markets-bullseye-staging.nashysinners.chatgpt.site",
    })),
    true,
  );
  assert.equal(
    isOwnerOnlyStagingRequest(new Headers({ host: "www.nashaimarkets.com" })),
    false,
  );
  assert.equal(
    isOwnerOnlyStagingRequest(new Headers({ host: "localhost:3000" })),
    false,
  );
});

test("forwarded host must also match exactly", () => {
  assert.equal(
    isOwnerOnlyStagingRequest(new Headers({
      host: "www.nashaimarkets.com",
      "x-forwarded-host": "nash-ai-markets-bullseye-staging.nashysinners.chatgpt.site",
    })),
    true,
  );
  assert.equal(
    isOwnerOnlyStagingRequest(new Headers({
      host: "nash-ai-markets-bullseye-staging.nashysinners.chatgpt.site",
      "x-forwarded-host": "attacker.example",
    })),
    false,
  );
});
