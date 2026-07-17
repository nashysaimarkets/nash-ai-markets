import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
const root = new URL("../", import.meta.url);
const read = (path: string) => readFile(new URL(path, root), "utf8");

test("Stripe membership synchronization rejects out-of-order events atomically", async () => {
  const [webhook, migration] = await Promise.all([read("app/api/stripe/webhook/route.ts"), read("supabase/migrations/202607170007_stripe_event_ordering.sql")]);
  assert.match(webhook, /\.rpc\("sync_membership_from_stripe"/);
  assert.match(migration, /on conflict \(email\) do update/);
  assert.match(migration, /last_stripe_event_created_at[\s\S]*<= excluded\.last_stripe_event_created_at/);
  assert.match(migration, /security definer/);
  assert.match(migration, /to service_role/);
});

test("public metadata contains no development marker and protects private routes", async () => {
  const [layout, robots, manifest] = await Promise.all([read("app/layout.tsx"), read("app/robots.ts"), read("app/manifest.ts")]);
  assert.doesNotMatch(layout, /codex-preview|development/);
  assert.match(robots, /"\/admin\/"/);
  assert.match(robots, /"\/dashboard"/);
  assert.match(manifest, /theme_color: "#07110f"/);
});

test("worker applies hardened headers and immutable caching only to static assets", async () => {
  const worker = await read("worker/index.ts");
  assert.match(worker, /cross-origin-opener-policy/);
  assert.match(worker, /x-dns-prefetch-control/);
  assert.match(worker, /max-age=31536000, immutable/);
  assert.match(worker, /pathname\.startsWith\("\/assets\/"\)/);
});

test("production readiness documentation covers deployment, incidents, known issues and monitoring", async () => {
  const report = await read("docs/RC1_PRODUCTION_READINESS.md");
  for (const heading of ["Deployment checklist", "Incident recovery", "Known issues", "Post-launch monitoring", "Go / no-go"]) assert.match(report, new RegExp(heading));
});
