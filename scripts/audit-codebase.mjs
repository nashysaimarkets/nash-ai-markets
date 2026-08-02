/**
 * Static codebase audit: file sizes, exported-symbol usage, duplicate copy,
 * CSS token spread and common React/Next hazards.
 *
 * Usage: node scripts/audit-codebase.mjs
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, extname } from "node:path";

const ROOT = process.cwd();
const SKIP_DIRS = new Set([
  "node_modules", ".next", ".git", "dist", ".wrangler", "audit-output", ".vercel",
]);

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    const stats = statSync(full);
    if (stats.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

const files = walk(ROOT);
const source = files.filter((file) => [".ts", ".tsx"].includes(extname(file)));
const css = files.filter((file) => extname(file) === ".css");
const appSource = source.filter((file) => relative(ROOT, file).startsWith("app/"));

const read = (file) => readFileSync(file, "utf8");
const lines = (file) => read(file).split("\n").length;
const rel = (file) => relative(ROOT, file);

function section(title) {
  console.log(`\n${"=".repeat(72)}\n${title}\n${"=".repeat(72)}`);
}

section("SCALE");
console.log(`source files (.ts/.tsx) : ${source.length}`);
console.log(`  under app/            : ${appSource.length}`);
console.log(`css files               : ${css.length}`);
console.log(`total source lines      : ${source.reduce((sum, file) => sum + lines(file), 0)}`);
console.log(`total css lines         : ${css.reduce((sum, file) => sum + lines(file), 0)}`);

section("LARGEST SOURCE FILES (candidates for splitting)");
source
  .map((file) => ({ file: rel(file), count: lines(file) }))
  .sort((a, b) => b.count - a.count)
  .slice(0, 25)
  .forEach(({ file, count }) => console.log(`${String(count).padStart(6)}  ${file}`));

section("CSS FILES BY SIZE");
css
  .map((file) => ({ file: rel(file), count: lines(file) }))
  .sort((a, b) => b.count - a.count)
  .forEach(({ file, count }) => console.log(`${String(count).padStart(6)}  ${file}`));

// ---- unused exported symbols -------------------------------------------------
section("POSSIBLY UNUSED EXPORTS (declared once, referenced nowhere else)");
const allText = new Map(source.map((file) => [file, read(file)]));
const exportPattern = /^export\s+(?:async\s+)?(?:function|const|class|type|interface)\s+([A-Za-z0-9_]+)/gm;
const unused = [];
for (const [file, text] of allText) {
  if (rel(file).startsWith("tests/") || rel(file).startsWith("scripts/")) continue;
  for (const match of text.matchAll(exportPattern)) {
    const name = match[1];
    let referenced = false;
    for (const [other, otherText] of allText) {
      if (other === file) continue;
      if (new RegExp(`\\b${name}\\b`).test(otherText)) { referenced = true; break; }
    }
    if (!referenced) unused.push(`${rel(file)} :: ${name}`);
  }
}
unused.sort().forEach((entry) => console.log(`  ${entry}`));
console.log(`  (${unused.length} total)`);

// ---- react / next hazards ----------------------------------------------------
section("REACT / NEXT HAZARDS");
const hazards = {
  "useEffect without cleanup returning a subscription/interval/listener": [],
  "setInterval or setTimeout in a client component": [],
  "addEventListener without matching removeEventListener": [],
  "array index used as React key": [],
  "dangerouslySetInnerHTML": [],
  "raw <img> instead of next/image": [],
  "<a href=\"/...\"> instead of next/link": [],
  "console.log left in app code": [],
  "TODO / FIXME / HACK / XXX marker": [],
  "hardcoded http:// url": [],
};
for (const [file, text] of allText) {
  const name = rel(file);
  if (name.startsWith("tests/") || name.startsWith("scripts/") || name.startsWith("audit/")) continue;
  if (/setInterval\(|setTimeout\(/.test(text) && text.includes('"use client"')) {
    hazards["setInterval or setTimeout in a client component"].push(name);
  }
  if (text.includes("addEventListener") && !text.includes("removeEventListener")) {
    hazards["addEventListener without matching removeEventListener"].push(name);
  }
  if (/key=\{(?:[A-Za-z0-9_]*index|i)\}/.test(text)) hazards["array index used as React key"].push(name);
  if (text.includes("dangerouslySetInnerHTML")) hazards["dangerouslySetInnerHTML"].push(name);
  if (/<img\s/.test(text)) hazards["raw <img> instead of next/image"].push(name);
  if (/<a\s+href="\//.test(text)) hazards['<a href="/...\"> instead of next/link'].push(name);
  if (/^\s*console\.log\(/m.test(text)) hazards["console.log left in app code"].push(name);
  if (/\b(TODO|FIXME|HACK|XXX)\b/.test(text)) hazards["TODO / FIXME / HACK / XXX marker"].push(name);
  if (/["'`]http:\/\/(?!localhost|127\.0\.0\.1)/.test(text)) hazards["hardcoded http:// url"].push(name);
}
for (const [label, list] of Object.entries(hazards)) {
  if (!list.length) continue;
  console.log(`\n${label} (${list.length}):`);
  list.slice(0, 20).forEach((name) => console.log(`  ${name}`));
  if (list.length > 20) console.log(`  ... and ${list.length - 20} more`);
}

// ---- accessibility smells ----------------------------------------------------
section("ACCESSIBILITY SMELLS");
const a11y = {
  "<button> without accessible text or aria-label": [],
  "onClick on a non-interactive element": [],
  "image without alt attribute": [],
  "form input without id/name binding": [],
  "positive tabIndex": [],
};
for (const [file, text] of allText) {
  const name = rel(file);
  if (!name.startsWith("app/") || extname(file) !== ".tsx") continue;
  if (/<img(?![^>]*\salt=)/.test(text)) a11y["image without alt attribute"].push(name);
  if (/tabIndex=\{[1-9]/.test(text)) a11y["positive tabIndex"].push(name);
  if (/<(div|span|li)[^>]*onClick=/.test(text)) a11y["onClick on a non-interactive element"].push(name);
}
for (const [label, list] of Object.entries(a11y)) {
  if (!list.length) continue;
  console.log(`\n${label} (${list.length}):`);
  list.forEach((name) => console.log(`  ${name}`));
}

// ---- css consistency ---------------------------------------------------------
section("CSS CONSISTENCY");
const cssText = css.map((file) => ({ file: rel(file), text: read(file) }));
const collect = (pattern) => {
  const counts = new Map();
  for (const { text } of cssText) {
    for (const match of text.matchAll(pattern)) {
      const value = match[1].trim();
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
};
const radius = collect(/border-radius:\s*([^;}]+)/g);
const shadow = collect(/box-shadow:\s*([^;}]+)/g);
const transition = collect(/transition:\s*([^;}]+)/g);
const hexes = collect(/(#[0-9a-fA-F]{3,8})\b/g);
console.log(`distinct border-radius values : ${radius.length}`);
radius.slice(0, 12).forEach(([value, count]) => console.log(`   ${String(count).padStart(3)}x  ${value}`));
console.log(`\ndistinct box-shadow values    : ${shadow.length}`);
console.log(`distinct transition values    : ${transition.length}`);
transition.slice(0, 12).forEach(([value, count]) => console.log(`   ${String(count).padStart(3)}x  ${value}`));
console.log(`\ndistinct raw hex colours      : ${hexes.length}`);
hexes.slice(0, 15).forEach(([value, count]) => console.log(`   ${String(count).padStart(3)}x  ${value}`));

const varDefs = new Set();
for (const { text } of cssText) {
  for (const match of text.matchAll(/(--[a-z0-9-]+)\s*:/gi)) varDefs.add(match[1]);
}
console.log(`\ncss custom properties defined : ${varDefs.size}`);

// ---- routes ------------------------------------------------------------------
section("ROUTES AND THEIR STATE FILES");
const pages = source.filter((file) => /app\/.*\/page\.tsx$/.test(rel(file)) || rel(file) === "app/page.tsx");
const routes = pages
  .map((file) => {
    const dir = rel(file).replace(/\/page\.tsx$/, "").replace(/^app$/, "");
    const route = `/${dir.replace(/^app\//, "")}`.replace(/\/$/, "") || "/";
    const folder = join(ROOT, dir === "" ? "app" : dir);
    const siblings = readdirSync(folder);
    return {
      route,
      loading: siblings.includes("loading.tsx"),
      error: siblings.includes("error.tsx"),
      lines: lines(file),
    };
  })
  .sort((a, b) => a.route.localeCompare(b.route));
console.log("route".padEnd(34) + "loading  error   lines");
for (const entry of routes) {
  console.log(
    entry.route.padEnd(34) +
      (entry.loading ? "  yes  " : "  NO   ") +
      (entry.error ? "  yes  " : "  NO   ") +
      String(entry.lines).padStart(6),
  );
}
console.log(`\nroutes: ${routes.length}`);
console.log(`missing loading.tsx: ${routes.filter((entry) => !entry.loading).length}`);
console.log(`missing error.tsx  : ${routes.filter((entry) => !entry.error).length}`);
