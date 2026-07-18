import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("dashboard-only brand interaction is isolated and time bounded", async () => {
  const [brand, shell] = await Promise.all([
    readFile(new URL("../app/dashboard/components/DashboardBrand.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/MemberShell.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(brand, /DISCOVERY_WINDOW_MS = 3_000/);
  assert.match(brand, /DISCOVERY_CLICK_COUNT = 5/);
  assert.match(brand, /SMILE_DURATION_MS = 1_000/);
  assert.match(brand, /onPointerEnter=\{revealSmile\}/);
  assert.match(brand, /role="dialog"/);
  assert.match(brand, /aria-modal="true"/);
  assert.match(brand, /event\.key === "Escape"/);
  assert.match(shell, /active === "dashboard" \? <DashboardBrand \/>/);
});

test("hidden message remains confined to its dashboard component", async () => {
  const [brand, page, shell] = await Promise.all([
    readFile(new URL("../app/dashboard/components/DashboardBrand.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/dashboard/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/MemberShell.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(brand, /Project BULLSEYE/);
  assert.match(brand, /Every successful project begins with someone refusing to quit/);
  assert.doesNotMatch(page, /Every successful project begins/);
  assert.doesNotMatch(shell, /Every successful project begins/);
});

test("Founding Member presentation uses verified numbering or an honest placeholder", async () => {
  const [badge, dashboard] = await Promise.all([
    readFile(new URL("../app/components/FoundingMemberBadge.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/dashboard/page.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(badge, /Member #\{confirmed \? position : "—"\}/);
  assert.match(badge, /Number assigned after eligibility confirmation/);
  assert.match(dashboard, /foundingRecord\?\.position/);
  assert.match(dashboard, /access\.tier === "pro" \|\| access\.tier === "elite"/);
});

test("Sprint Bravo polish respects mobile, loading, focus, and reduced-motion users", async () => {
  const [loading, css] = await Promise.all([
    readFile(new URL("../app/dashboard/loading.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/mission-control.css", import.meta.url), "utf8"),
  ]);
  assert.match(loading, /dashboardAccessMapSkeleton/);
  assert.match(loading, /aria-busy="true"/);
  assert.match(css, /\.bullseyeDiscovery button:focus-visible/);
  assert.match(css, /\.dashboardAccessMapSkeleton\{grid-template-columns:1fr/);
  assert.match(css, /@media\(prefers-reduced-motion:reduce\)/);
});
