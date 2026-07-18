import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { monthKey, statusLabel, validateComment, validateIdea } from "../app/ideas/lib.ts";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
test("idea inputs are trimmed and validated server-side", () => {
  assert.deepEqual(validateIdea({ title: "  Better risk notes  ", description: "  Add structured notes to every risk decision.  ", category: "Risk management" }), { title: "Better risk notes", description: "Add structured notes to every risk decision.", category: "Risk management" });
  assert.equal(validateIdea({ title: "No", description: "Too short", category: "Other" }), null);
  assert.equal(validateComment(" x "), null);
  assert.equal(validateComment(" Calm, useful feedback. "), "Calm, useful feedback.");
});
test("status and monthly vote keys are deterministic", () => {
  assert.equal(statusLabel("in_development"), "In development");
  assert.equal(statusLabel("unexpected"), "Under review");
  assert.equal(monthKey(new Date("2026-07-31T23:59:00Z")), "2026-07");
});
test("database prevents duplicate and monthly votes and protects moderation", () => {
  const sql = read("supabase/migrations/202607180009_member_ideas_hub.sql");
  assert.match(sql, /primary key \(idea_id,user_id\)/);
  assert.match(sql, /primary key \(month_key,user_id\)/);
  assert.match(sql, /revoke update\(status,is_shortlisted,released_at\)/);
  assert.match(sql, /members remove own vote/);
});
test("member navigation and safe unavailable state are present without emails", () => {
  const shell = read("app/components/MemberShell.tsx");
  const page = read("app/ideas/page.tsx");
  assert.match(shell, /href: "\/ideas", label: "Ideas"/);
  assert.match(page, /The Ideas Hub is being prepared/);
  assert.match(page, /aria-labelledby="ideas-title"/);
  assert.doesNotMatch(page, /user\.email|\.email\b/);
});
