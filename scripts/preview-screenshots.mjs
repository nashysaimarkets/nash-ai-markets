/**
 * Screenshots the static member-surface previews produced by
 * preview-member-surfaces.tsx, so authenticated layouts can be reviewed
 * without audit credentials.
 */
import { mkdirSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "@playwright/test";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PREVIEW_DIR = join(ROOT, "audit-output", "preview");
const SHOT_DIR = join(PREVIEW_DIR, "screenshots");

const SURFACES = process.argv.slice(2).length
  ? process.argv.slice(2)
  : ["command-centre", "command-centre-nodata"];

const VIEWPORTS = [
  { id: "desktop-1440", width: 1440, height: 1000 },
  { id: "mobile-390", width: 390, height: 844 },
];

async function main() {
  mkdirSync(SHOT_DIR, { recursive: true });
  const browser = await chromium.launch();
  try {
    for (const surface of SURFACES) {
      const file = join(PREVIEW_DIR, `${surface}.html`);
      if (!existsSync(file)) {
        console.error(`missing preview: ${file}`);
        continue;
      }
      for (const viewport of VIEWPORTS) {
        const page = await browser.newPage({
          viewport: { width: viewport.width, height: viewport.height },
          deviceScaleFactor: 1,
          reducedMotion: "reduce",
        });
        await page.goto(pathToFileURL(file).href, { waitUntil: "load" });
        await page.waitForTimeout(250);

        const height = await page.evaluate(() => document.body.scrollHeight);
        // Name the offending nodes; "there is overflow" alone is not actionable.
        const offenders = await page.evaluate(() => {
          const limit = document.documentElement.clientWidth;
          const out = [];
          for (const el of document.querySelectorAll("*")) {
            const rect = el.getBoundingClientRect();
            if (rect.width === 0 || rect.height === 0) continue;
            if (rect.right <= limit + 1) continue;
            const parent = el.parentElement;
            // Report the outermost offender only, so one wide child is not
            // listed once for every ancestor it drags over the edge.
            if (parent && parent.getBoundingClientRect().right > limit + 1) continue;
            out.push({
              tag: el.tagName.toLowerCase(),
              cls: (el.className && String(el.className).slice(0, 60)) || "",
              right: Math.round(rect.right),
              width: Math.round(rect.width),
            });
          }
          return out.slice(0, 12);
        });
        const overflow = offenders.length > 0;

        const fold = join(SHOT_DIR, `${surface}-${viewport.id}-fold.png`);
        await page.screenshot({ path: fold });
        const full = join(SHOT_DIR, `${surface}-${viewport.id}-full.png`);
        await page.screenshot({ path: full, fullPage: true });

        console.log(
          `${surface} ${viewport.id}: height=${height}px overflow=${overflow ? "YES" : "no"}`,
        );
        for (const item of offenders) {
          console.log(`    overflows to ${item.right}px (w=${item.width}) ${item.tag}.${item.cls}`);
        }
        await page.close();
      }
    }
  } finally {
    await browser.close();
  }
}

await main();
