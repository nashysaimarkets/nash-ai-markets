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

test("scheduled Stripe cancellations remain server-controlled and ordered", async () => {
  const migration = await read("supabase/migrations/20260804091107_track_stripe_cancellation_schedule.sql");
  assert.match(migration, /cancel_at_period_end boolean not null default false/);
  assert.match(migration, /pg_advisory_xact_lock/);
  assert.match(migration, /last_stripe_event_created_at[\s\S]*<= p_event_created_at/);
  assert.match(migration, /sync_membership_cancellation_from_stripe[\s\S]*from public, anon, authenticated/);
  assert.match(migration, /sync_membership_cancellation_from_stripe[\s\S]*to service_role/);
});

test("staging hardening removes default API grants from server-only functions", async () => {
  const migration = await read("supabase/migrations/202608020011_harden_function_grants.sql");
  assert.match(migration, /save_member_onboarding[\s\S]*security invoker/);
  assert.match(migration, /sync_founding_100[\s\S]*from public, anon, authenticated, service_role/);
  assert.match(migration, /sync_founding_100[\s\S]*to service_role/);
  assert.match(migration, /sync_membership_from_stripe[\s\S]*from public, anon, authenticated, service_role/);
  assert.match(migration, /sync_membership_from_stripe[\s\S]*to service_role/);
  assert.doesNotMatch(migration, /sync_(?:founding_100|membership_from_stripe)[\s\S]*to (?:anon|authenticated)/);
});

test("onboarding invoker receives only RLS-protected table operations", async () => {
  const [grants, contract] = await Promise.all([
    read("supabase/migrations/202608020012_restore_onboarding_table_grants.sql"),
    read("supabase/migrations/202608020013_align_onboarding_interests.sql"),
  ]);
  assert.match(grants, /revoke all on table public\.member_onboarding from anon, authenticated/);
  assert.match(grants, /grant select, insert, update on table public\.member_onboarding to authenticated/);
  assert.doesNotMatch(grants, /grant (?:all|delete)/);
  assert.match(contract, /security invoker/);
  assert.match(contract, /'futures', 'equities', 'macro', 'volatility'/);
  assert.doesNotMatch(contract, /'futures', 'options', 'macro', 'volatility'/);
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

test("launch evidence distinguishes completed readiness from external acceptance", async () => {
  const [ownership, restore, accessibility, legal, storage, retention, retentionExercise, icoFee, vendors, vendorEvidence, openaiHealth, morningBrief, marketBrief] = await Promise.all([
    read("docs/OPERATIONAL_OWNERSHIP.md"),
    read("docs/RESTORE_EVIDENCE_2026-08-16.md"),
    read("docs/ACCESSIBILITY_PHYSICAL_ACCEPTANCE.md"),
    read("docs/UK_LEGAL_PRIVACY_APPROVAL_PACK.md"),
    read("docs/COOKIE_AND_DEVICE_STORAGE_INVENTORY.md"),
    read("docs/DATA_RETENTION_AND_RIGHTS_SCHEDULE.md"),
    read("docs/RETENTION_RIGHTS_EXERCISE_2026-08-16.md"),
    read("docs/ICO_FEE_SELF_ASSESSMENT_2026-08-16.md"),
    read("docs/PROCESSOR_AND_VENDOR_REGISTER.md"),
    read("docs/VENDOR_PRIVACY_EVIDENCE_2026-08-16.md"),
    read("app/lib/server/openai.ts"),
    read("app/lib/server/ai-morning-brief.ts"),
    read("app/lib/server/ai-market-brief.ts"),
  ]);

  assert.match(ownership, /Chris Nash/);
  assert.match(ownership, /Richard Nash accepted the operational backup[\s\S]*16 August 2026/i);
  assert.match(ownership, /named-owner and backup-briefing[\s\S]*CLEARED/i);
  assert.match(restore, /RESTORE READINESS: PASS\. FULL DISPOSABLE RESTORE: PENDING/);
  assert.match(restore, /production-linked project[\s\S]*explicitly excluded/i);
  assert.match(accessibility, /physical iPhone VoiceOver passed/i);
  assert.match(accessibility, /Android TalkBack remains[\s\S]*pending/i);
  assert.match(legal, /QUALIFIED APPROVAL: OUTSTANDING/);
  assert.match(legal, /not legal[\s\S]*advice, FCA authorisation or Section 21 approval/i);
  assert.match(legal, /OWNER APPROVAL: Chris Nash approved[\s\S]*16 August 2026/i);
  assert.match(storage, /nash_desk_workspace_v1/);
  assert.match(storage, /no marketing analytics, advertising pixel, behavioural tracker/i);
  assert.match(retention, /OWNER-APPROVED FOR OPERATIONS/);
  assert.match(retention, /APPROVED — 16 August 2026/);
  assert.match(retention, /target completion within \*\*28 days\*\*/i);
  assert.match(retention, /DATABASE PASS — 16 August 2026/);
  assert.match(retentionExercise, /ISOLATED STAGING DATABASE EXERCISE: PASS/);
  assert.match(retentionExercise, /REAL SIGNED-SESSION BROWSER REPLAY: PENDING/);
  assert.match(retentionExercise, /original staging user\/session counts/i);
  assert.doesNotMatch(retentionExercise, /example\.invalid|00000000-0000-4000-8000-/i);
  assert.match(icoFee, /NO FEE REQUIRED YET/);
  assert.match(icoFee, /Retake the checker immediately[\s\S]*first paid subscription/i);
  assert.match(vendors, /OFFICIAL-SOURCE EVIDENCE AUDIT: COMPLETE/);
  assert.match(vendors, /Vercel[\s\S]*Pro Plan[\s\S]*continuity blocker/i);
  assert.match(vendors, /Automatic Vercel Agent[\s\S]*disabled[\s\S]*billing adjustment/i);
  assert.match(vendors, /free ImprovMX[\s\S]*consumer Gmail/i);
  assert.match(vendorEvidence, /PUBLIC PAID LAUNCH: HOLD/);
  assert.match(vendorEvidence, /Organisation plan is Free[\s\S]*London `eu-west-2`/i);
  assert.match(vendorEvidence, /Every current OpenAI Responses call explicitly sets `store: false`/i);
  assert.match(vendorEvidence, /automatic Agent features were switched off[\s\S]*remaining unpaid balance/i);
  assert.doesNotMatch(`${vendors}\n${vendorEvidence}`, /nashysinners@gmail\.com/i);
  const openaiSources = `${openaiHealth}\n${morningBrief}\n${marketBrief}`;
  assert.equal(openaiSources.match(/responses\.create\(/g)?.length, 3);
  assert.equal(openaiSources.match(/responses\.create\(\{\s*model,\s*store:\s*false,/g)?.length, 3);
  assert.doesNotMatch(`${vendors}\n${vendorEvidence}`, /89\.34|9169|inv_[A-Za-z0-9]/i);
});
