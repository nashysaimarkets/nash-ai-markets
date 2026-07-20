import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("locked premium cards use decorative blur without embedding premium output", async () => {
  const source = await readFile(new URL("../app/terminal/components/LockedPremiumCard.tsx", import.meta.url), "utf8");
  assert.match(source, /premiumBlurPreview/);
  assert.match(source, /aria-hidden="true"/);
  assert.doesNotMatch(source, /children/);
  assert.match(source, /improves your workflow/);
});

test("terminal gates Pro and Elite panels through feature entitlements", async () => {
  const source = await readFile(new URL("../app/terminal/page.tsx", import.meta.url), "utf8");
  for (const feature of ["decision-engine", "trade-planner"]) {
    assert.match(source, new RegExp(`features\\[\"${feature}\"\\]`));
  }
  assert.match(source, /features\.intelligence/);
  assert.match(source, /LockedPremiumCard/);
  assert.doesNotMatch(source, /launch-diagnostics/);
});

test("preview endpoint validates tier progression and persists a unique claim", async () => {
  const [route, migration] = await Promise.all([
    readFile(new URL("../app/api/membership/preview/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../supabase/migrations/202607170001_progressive_access_previews.sql", import.meta.url), "utf8"),
  ]);
  assert.match(route, /canClaimPreview/);
  assert.match(route, /PREVIEW_NOT_ELIGIBLE/);
  assert.match(route, /INVALID_ORIGIN/);
  assert.match(route, /createAdminClient/);
  assert.match(migration, /unique \(user_id, target_tier, period_start\)/);
  assert.match(migration, /enable row level security/);
});

test("locked cards provide value language, upgrade paths and preview recovery", async () => {
  const source = await readFile(new URL("../app/terminal/components/LockedPremiumCard.tsx", import.meta.url), "utf8");
  assert.match(source, /benefits/);
  assert.match(source, /Use \$\{previewCadence/);
  assert.match(source, /Preview access is temporarily unavailable/);
  assert.match(source, /href="\/#membership"/);
});
