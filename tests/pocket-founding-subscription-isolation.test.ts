import assert from "node:assert/strict";
import test from "node:test";
import { readdir, readFile } from "node:fs/promises";

test("Pocket founding updates isolate subscriptions sharing an email", async () => {
  const directory = new URL("../supabase/migrations/", import.meta.url);
  const files = (await readdir(directory)).filter(file => file.endsWith(".sql")).sort();
  const sql = (await Promise.all(files.map(file => readFile(new URL(file, directory), "utf8")))).join("\n");
  const marker = "create or replace function public.sync_pocket_founding_650";
  const latest = sql.slice(sql.lastIndexOf(marker));

  assert.match(latest, /where stripe_subscription_id\s*=\s*p_stripe_subscription_id[\s\S]*where email\s*=\s*normalized_email/i);
  assert.match(latest, /unrelated_cancellation_ignored/i);
  assert.doesNotMatch(latest, /where email\s*=\s*normalized_email\s+or\s+stripe_subscription_id/i);
});
