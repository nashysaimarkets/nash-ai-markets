/**
 * Injects a candidate CSS patch into a rendered preview and re-measures
 * overflow, so a fix can be validated before it is committed to a stylesheet.
 *
 * Usage: node scripts/try-css-fix.mjs <surface> <width> <patch.css>
 */
import { readFileSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "@playwright/test";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const surface = process.argv[2] ?? "command-centre";
const width = Number(process.argv[3] ?? 390);
const patchFile = process.argv[4];
const file = join(ROOT, "audit-output", "preview", `${surface}.html`);

async function measure(page) {
  return page.evaluate(() => {
    const limit = document.documentElement.clientWidth;
    const offenders = [];
    for (const el of document.querySelectorAll("*")) {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      if (rect.right <= limit + 1) continue;
      const parent = el.parentElement;
      if (parent && parent.getBoundingClientRect().right > limit + 1) continue;
      offenders.push(`${el.tagName.toLowerCase()}.${String(el.className || "").slice(0, 50)}`);
    }
    return {
      docScroll: document.documentElement.scrollWidth,
      client: limit,
      height: document.body.scrollHeight,
      offenders: offenders.slice(0, 10),
    };
  });
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width, height: 900 } });
await page.goto(pathToFileURL(file).href, { waitUntil: "load" });

const before = await measure(page);
console.log(`BEFORE  scrollWidth=${before.docScroll} client=${before.client} height=${before.height}`);
for (const o of before.offenders) console.log(`   ${o}`);

if (patchFile) {
  await page.addStyleTag({ content: readFileSync(resolve(patchFile), "utf8") });
  await page.waitForTimeout(150);
  const after = await measure(page);
  console.log(`\nAFTER   scrollWidth=${after.docScroll} client=${after.client} height=${after.height}`);
  for (const o of after.offenders) console.log(`   ${o}`);
  console.log(
    `\n=> horizontal overflow ${after.docScroll <= after.client + 1 ? "RESOLVED" : "STILL PRESENT"}`,
  );
}

await browser.close();
