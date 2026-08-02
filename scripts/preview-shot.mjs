/**
 * Screenshots one preview surface at one viewport, optionally with a candidate
 * CSS patch injected, so a styling change can be eyeballed before it is applied.
 *
 * Usage: node scripts/preview-shot.mjs <surface> <width> <out.png> [patch.css]
 */
import { readFileSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "@playwright/test";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const [surface = "command-centre", widthArg = "1440", out = "preview.png", patch] = process.argv.slice(2);
const file = join(ROOT, "audit-output", "preview", `${surface}.html`);
const width = Number(widthArg);

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width, height: Math.round(width * 0.62) },
  reducedMotion: "reduce",
});
await page.goto(pathToFileURL(file).href, { waitUntil: "load" });
if (patch) await page.addStyleTag({ content: readFileSync(resolve(patch), "utf8") });
await page.waitForTimeout(200);
await page.screenshot({ path: resolve(out) });
await browser.close();
console.log(`wrote ${out}`);
