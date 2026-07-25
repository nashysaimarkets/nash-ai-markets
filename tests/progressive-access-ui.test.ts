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

test("terminal keeps membership entitlement gates while the canvas is cleared", async () => {
  const [page, entitlement, locked] = await Promise.all([
    readFile(new URL("../app/terminal/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/terminal/lib/membership-entitlement.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/terminal/components/LockedPremiumCard.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(page, /resolveMembershipTier/);
  assert.match(page, /createProgressiveAccess/);
  assert.match(page, /loadPreviewClaims/);
  assert.match(page, /TradingDeskOS/);
  assert.doesNotMatch(page, /launch-diagnostics|MarketsBrowser/);
  assert.match(entitlement, /decision-engine/);
  assert.match(entitlement, /trade-planner/);
  assert.match(entitlement, /intelligence/);
  assert.match(locked, /LockedPremiumCard|export function LockedPremiumCard/);
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
