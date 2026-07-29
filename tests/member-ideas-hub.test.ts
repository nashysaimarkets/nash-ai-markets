import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { monthKey, statusLabel, validateComment, validateIdea } from "../app/ideas/lib.ts";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("idea inputs are trimmed and validated server-side", () => {
  assert.deepEqual(
    validateIdea({
      title: "  Better risk notes  ",
      description: "  Add structured notes to every risk decision.  ",
      category: "Risk management",
    }),
    {
      title: "Better risk notes",
      description: "Add structured notes to every risk decision.",
      category: "Risk management",
    },
  );
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

test("Ideas hub restores content with fail-closed unavailable and empty states", () => {
  const shell = read("app/components/MemberShell.tsx");
  const page = read("app/ideas/page.tsx");
  const detail = read("app/ideas/[id]/page.tsx");
  const loading = read("app/ideas/loading.tsx");
  assert.match(shell, /href: "\/ideas", label: "Ideas"/);
  assert.doesNotMatch(page, /MemberEmptyCanvas/);
  assert.match(page, /redirect\("\/login"\)/);
  assert.match(page, /IdeasUnavailable|Ideas are not available right now/);
  assert.match(page, /No member ideas match this view yet/);
  assert.match(page, /Open Morning Brief/);
  assert.match(page, /Open Trading Desk/);
  assert.match(page, /member_ideas/);
  assert.doesNotMatch(page, /user\.email|\.email\b/);
  assert.match(detail, /IdeaActions/);
  assert.match(detail, /redirect\("\/login"\)/);
  assert.match(loading, /Loading member ideas/);
  assert.match(loading, /aria-busy="true"/);
  assert.doesNotMatch(loading, /MemberEmptyCanvas/);
});

test("Ideas loading state is bounded and never logo-only canvas", () => {
  const loading = read("app/ideas/loading.tsx");
  const emptyCanvas = read("app/components/MemberEmptyCanvas.tsx");
  const errorPage = read("app/ideas/error.tsx");
  assert.match(loading, /role="status"/);
  assert.match(loading, /Fetching verified member submissions/);
  assert.match(emptyCanvas, /BrandLogo/);
  assert.doesNotMatch(loading, /MemberEmptyCanvas/);
  assert.match(errorPage, /role="alert"/);
  assert.match(errorPage, /Retry Ideas/);
  assert.match(errorPage, /Open Morning Brief/);
  assert.doesNotMatch(errorPage, /error\.message|error\.stack/);
});
