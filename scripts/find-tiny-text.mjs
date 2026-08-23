/**
 * Lists every rendered element below a readable font size, grouped by the CSS
 * selector that would target it. Read-only diagnostic for typography work.
 *
 * Usage: AUDIT_BASE_URL=http://localhost:3000 node scripts/find-tiny-text.mjs
 */
import { chromium } from "@playwright/test";

const BASE = process.env.AUDIT_BASE_URL ?? "http://localhost:3000";
const ROUTES = process.argv.slice(2).length
  ? process.argv.slice(2)
  : ["/", "/methodology", "/login", "/founding-member", "/pricing", "/privacy"];
const FLOOR = 10;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const totals = new Map();

for (const route of ROUTES) {
  await page.goto(`${BASE}${route}`, { waitUntil: "networkidle" });
  const found = await page.evaluate((floor) => {
    const rows = [];
    for (const el of document.querySelectorAll("*")) {
      const style = getComputedStyle(el);
      const size = parseFloat(style.fontSize);
      if (!Number.isFinite(size) || size >= floor) continue;
      if (!el.textContent?.trim()) continue;
      const classes = [...el.classList].map((c) => `.${c}`).join("");
      rows.push({
        selector: `${el.tagName.toLowerCase()}${classes}`,
        size,
        sample: el.textContent.trim().slice(0, 40),
      });
    }
    return rows;
  }, FLOOR);

  console.log(`\n${route} — ${found.length} elements under ${FLOOR}px`);
  const grouped = new Map();
  for (const row of found) {
    const key = `${row.selector} @ ${row.size}px`;
    grouped.set(key, (grouped.get(key) ?? 0) + 1);
    totals.set(key, (totals.get(key) ?? 0) + 1);
  }
  [...grouped.entries()]
    .sort((a, b) => b[1] - a[1])
    .forEach(([key, count]) => console.log(`  ${String(count).padStart(3)}x  ${key}`));
}

console.log(`\n${"=".repeat(70)}\nAGGREGATE across ${ROUTES.length} routes\n${"=".repeat(70)}`);
[...totals.entries()]
  .sort((a, b) => b[1] - a[1])
  .forEach(([key, count]) => console.log(`  ${String(count).padStart(3)}x  ${key}`));

await browser.close();
