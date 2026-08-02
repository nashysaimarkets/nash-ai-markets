/**
 * Detects layout regressions across routes and viewports: horizontal overflow,
 * elements wider than the viewport, and text below a readable floor.
 *
 * Read-only. Run before and after CSS changes and diff the JSON.
 *
 * Usage: AUDIT_BASE_URL=http://localhost:3000 node scripts/layout-check.mjs [outfile]
 */
import { chromium } from "@playwright/test";
import { writeFileSync } from "node:fs";

const BASE = process.env.AUDIT_BASE_URL ?? "http://localhost:3000";
const OUT = process.argv[2] ?? "/tmp/layout-check.json";
const FLOOR = 11;

const ROUTES = [
  "/", "/methodology", "/login", "/founding-member", "/pricing",
  "/privacy", "/terms", "/help", "/contact", "/about", "/waitlist", "/risk-disclaimer",
];
const VIEWPORTS = [
  { id: "desktop-1440", width: 1440, height: 900 },
  { id: "tablet-1024", width: 1024, height: 800 },
  { id: "mobile-375", width: 375, height: 780 },
];

const browser = await chromium.launch();
const results = [];

for (const viewport of VIEWPORTS) {
  const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height } });
  for (const route of ROUTES) {
    try {
      await page.goto(`${BASE}${route}`, { waitUntil: "networkidle", timeout: 20_000 });
    } catch {
      results.push({ route, viewport: viewport.id, error: "navigation failed" });
      continue;
    }
    const measured = await page.evaluate((floor) => {
      const doc = document.documentElement;
      const overflowing = [];
      for (const el of document.querySelectorAll("body *")) {
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) continue;
        if (rect.right > doc.clientWidth + 1 || rect.left < -1) {
          overflowing.push({
            selector: `${el.tagName.toLowerCase()}${[...el.classList].map((c) => `.${c}`).join("")}`,
            right: Math.round(rect.right),
            left: Math.round(rect.left),
          });
        }
      }
      let tiny = 0;
      const tinySelectors = new Set();
      for (const el of document.querySelectorAll("*")) {
        const size = parseFloat(getComputedStyle(el).fontSize);
        if (Number.isFinite(size) && size < floor && el.textContent?.trim()) {
          tiny += 1;
          tinySelectors.add(`${el.tagName.toLowerCase()} @ ${size}px`);
        }
      }
      return {
        horizontalScroll: doc.scrollWidth > doc.clientWidth + 1,
        scrollWidth: doc.scrollWidth,
        clientWidth: doc.clientWidth,
        overflowCount: overflowing.length,
        overflowSamples: overflowing.slice(0, 5),
        tinyTextCount: tiny,
        tinyTextSelectors: [...tinySelectors].slice(0, 12),
      };
    }, FLOOR);
    results.push({ route, viewport: viewport.id, ...measured });
  }
  await page.close();
}

await browser.close();

const totals = {
  routesChecked: ROUTES.length,
  viewports: VIEWPORTS.length,
  withHorizontalScroll: results.filter((r) => r.horizontalScroll).length,
  totalOverflowingElements: results.reduce((s, r) => s + (r.overflowCount ?? 0), 0),
  totalTinyText: results.reduce((s, r) => s + (r.tinyTextCount ?? 0), 0),
  navigationFailures: results.filter((r) => r.error).length,
};

writeFileSync(OUT, `${JSON.stringify({ floor: FLOOR, totals, results }, null, 2)}\n`);

console.log(`floor: ${FLOOR}px   output: ${OUT}`);
console.log(JSON.stringify(totals, null, 2));
console.log("\nper-route (route | viewport | hScroll | overflowing | tinyText)");
for (const r of results) {
  if (r.error) {
    console.log(`  ${r.route.padEnd(18)} ${r.viewport.padEnd(14)} ERROR ${r.error}`);
    continue;
  }
  const flag = r.horizontalScroll || r.overflowCount > 0 ? " <-- CHECK" : "";
  console.log(
    `  ${r.route.padEnd(18)} ${r.viewport.padEnd(14)} ${String(r.horizontalScroll).padEnd(6)} ${String(
      r.overflowCount,
    ).padStart(4)} ${String(r.tinyTextCount).padStart(6)}${flag}`,
  );
}
