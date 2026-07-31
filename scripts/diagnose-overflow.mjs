/**
 * Finds the descendants whose intrinsic width forces a grid/flex track wider
 * than its container. Reports the narrowest ancestor chain responsible so a fix
 * can target the real cause rather than the outermost symptom.
 */
import { readFileSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "@playwright/test";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const file = join(ROOT, "audit-output", "preview", `${process.argv[2] ?? "command-centre"}.html`);
const width = Number(process.argv[3] ?? 390);
const patchFile = process.argv[4];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width, height: 900 } });
await page.goto(pathToFileURL(file).href, { waitUntil: "load" });
if (patchFile) {
  await page.addStyleTag({ content: readFileSync(resolve(patchFile), "utf8") });
  await page.waitForTimeout(150);
}

const report = await page.evaluate(() => {
  const out = [];
  for (const el of document.querySelectorAll("*")) {
    // scrollWidth beyond clientWidth means this box's own content does not fit,
    // which is what propagates a min-content floor up to the grid track.
    const over = el.scrollWidth - el.clientWidth;
    if (over <= 1) continue;
    const style = getComputedStyle(el);
    const path = [];
    for (let node = el; node && node !== document.body; node = node.parentElement) {
      path.unshift(`${node.tagName.toLowerCase()}${node.className ? `.${String(node.className).split(" ")[0]}` : ""}`);
    }
    out.push({
      tag: el.tagName.toLowerCase(),
      cls: String(el.className || "").slice(0, 70),
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
      over,
      display: style.display,
      gridCols: style.gridTemplateColumns.slice(0, 90),
      minWidth: style.minWidth,
      whiteSpace: style.whiteSpace,
      childCount: el.children.length,
      text: (el.textContent || "").trim().slice(0, 70),
      path: path.slice(-4).join(" > "),
    });
  }
  return out.sort((a, b) => b.over - a.over).slice(0, 25);
});

console.log(`viewport=${width}px  file=${file}\n`);
for (const row of report) {
  console.log(
    `+${row.over}px  ${row.path}\n` +
      `        scroll=${row.scrollWidth} client=${row.clientWidth} display=${row.display} minWidth=${row.minWidth} ws=${row.whiteSpace}\n` +
      `        cols=${row.gridCols}\n` +
      `        text="${row.text}"`,
  );
}

await browser.close();
