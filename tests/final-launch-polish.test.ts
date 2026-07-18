import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const publicRoutes = [
  "about",
  "contact",
  "help",
  "pricing",
  "privacy",
  "risk-disclaimer",
  "terms",
  "waitlist",
] as const;

test("public routes declare page-specific canonical URLs", async () => {
  for (const route of publicRoutes) {
    const source = await readFile(new URL(`../app/${route}/page.tsx`, import.meta.url), "utf8");
    assert.match(source, new RegExp(`alternates:\\s*\\{\\s*canonical:\\s*"\\/${route}"\\s*\\}`));
  }
});

test("robots advertises the canonical sitemap", async () => {
  const source = await readFile(new URL("../app/robots.ts", import.meta.url), "utf8");
  assert.match(source, /sitemap:\s*"https:\/\/www\.nashaimarkets\.com\/sitemap\.xml"/);
});

test("remaining compact public links retain usable touch targets", async () => {
  const [homepage, enhancements, missionControl] = await Promise.all([
    readFile(new URL("../app/homepage.css", import.meta.url), "utf8"),
    readFile(new URL("../app/enhancements.css", import.meta.url), "utf8"),
    readFile(new URL("../app/mission-control.css", import.meta.url), "utf8"),
  ]);

  assert.match(homepage, /\.mcFooterTop>div a\{[^}]*min-height:32px/);
  assert.match(enhancements, /\.commercialNav>a:last-child\{[^}]*min-height:44px/);
  assert.match(missionControl, /\.launchFooter a\{[^}]*min-height:44px/);
});
