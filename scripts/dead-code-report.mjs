/**
 * Builds an evidence-backed "Candidate for Removal" report.
 *
 * This script is READ-ONLY. It never deletes anything. For every source file it
 * records who imports it, which of its exports are referenced elsewhere, and the
 * git history, so a human can judge whether removal is safe.
 *
 * Usage: node scripts/dead-code-report.mjs [--json]
 */
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, statSync, writeFileSync, mkdirSync } from "node:fs";
import { extname, join, relative, basename } from "node:path";

const ROOT = process.cwd();
const SKIP_DIRS = new Set([
  "node_modules", ".next", ".git", "dist", ".wrangler", "audit-output", ".vercel", ".sites-runtime",
]);

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

const rel = (file) => relative(ROOT, file);
const allFiles = walk(ROOT);
const sourceFiles = allFiles.filter((f) => [".ts", ".tsx"].includes(extname(f)));
const textFiles = allFiles.filter((f) =>
  [".ts", ".tsx", ".mjs", ".js", ".json", ".css", ".md", ".sh"].includes(extname(f)),
);

const contents = new Map(textFiles.map((f) => [f, readFileSync(f, "utf8")]));

/** Entry points are reachable by the framework even with zero importers. */
function isFrameworkEntry(path) {
  return (
    /^app\/.*\/(page|layout|loading|error|not-found|global-error|route|template|default)\.tsx?$/.test(path) ||
    /^app\/(page|layout|loading|error|not-found|global-error|template)\.tsx?$/.test(path) ||
    path === "middleware.ts" ||
    path === "proxy.ts" ||
    // Next.js metadata file conventions — the framework loads these by path.
    /^app\/(sitemap|robots|manifest|opengraph-image|twitter-image|icon|apple-icon)\.tsx?$/.test(path) ||
    // Cloudflare Worker entry — referenced by deploy config, not by imports.
    path.startsWith("worker/") ||
    path.startsWith("tests/") ||
    path.startsWith("scripts/") ||
    path.startsWith("audit/") ||
    path.startsWith("tools/") ||
    // Vendor scaffolding shipped with the starter, not part of the product.
    path.startsWith("examples/") ||
    path.endsWith(".d.ts") ||
    /^(next|vite|eslint|drizzle|postcss|tailwind)\.config\./.test(path)
  );
}

const isTestFile = (path) => path.startsWith("tests/");

/**
 * A name appearing only inside a negative assertion ("assert this is NOT
 * rendered") is evidence the component is retired, not evidence it is live.
 */
function isNegativeAssertionOnly(name, text) {
  const mentions = text.split("\n").filter((line) => new RegExp(`\\b${name}\\b`).test(line));
  return (
    mentions.length > 0 &&
    mentions.every((line) => /doesNotMatch|doesNotInclude|notOk|\.not\./.test(line))
  );
}

function gitInfo(path) {
  try {
    const out = execFileSync(
      "git",
      ["log", "-1", "--format=%ad|%an|%s", "--date=short", "--", path],
      { cwd: ROOT, encoding: "utf8" },
    ).trim();
    if (!out) return { lastChange: "untracked", author: "-", subject: "-", tracked: false };
    const [lastChange, author, subject] = out.split("|");
    return { lastChange, author, subject, tracked: true };
  } catch {
    return { lastChange: "unknown", author: "-", subject: "-", tracked: false };
  }
}

/**
 * Files that reference the given module as a module specifier. Covers static
 * imports, re-exports, require(), and lazy `import("./X")` inside next/dynamic —
 * missing the dynamic form would wrongly mark live components as unreferenced.
 */
function importers(file) {
  const stem = basename(file).replace(/\.tsx?$/, "");
  const specifier = new RegExp(
    `(?:from\\s*|import\\s*\\(\\s*|require\\s*\\(\\s*)["'\`][^"'\`]*?[/]${stem}(?:\\.tsx?)?["'\`]`,
  );
  const bareSpecifier = new RegExp(
    `(?:from\\s*|import\\s*\\(\\s*|require\\s*\\(\\s*)["'\`]${stem}(?:\\.tsx?)?["'\`]`,
  );
  const found = [];
  for (const [other, text] of contents) {
    if (other === file) continue;
    if (specifier.test(text) || bareSpecifier.test(text)) found.push(rel(other));
  }
  return found;
}

const exportPattern =
  /^export\s+(?:default\s+)?(?:async\s+)?(?:function|const|let|class|type|interface|enum)\s+([A-Za-z0-9_]+)/gm;
/** `export { a, b } from "./x"` and `export { a }` re-export forms. */
const exportListPattern = /^export\s*\{([^}]+)\}/gm;

/** Exported names referenced anywhere outside their own file. */
function exportUsage(file, text) {
  const names = new Set();
  for (const match of text.matchAll(exportPattern)) names.add(match[1]);
  for (const match of text.matchAll(exportListPattern)) {
    for (const part of match[1].split(",")) {
      const name = part.trim().split(/\s+as\s+/).pop()?.trim();
      if (name) names.add(name.replace(/^type\s+/, ""));
    }
  }

  const results = [];
  for (const name of names) {
    const productionUsers = [];
    const testUsers = [];
    const negativeAssertionOnly = [];
    for (const [other, otherText] of contents) {
      if (other === file) continue;
      if (!new RegExp(`\\b${name}\\b`).test(otherText)) continue;
      const otherPath = rel(other);
      if (isTestFile(otherPath)) {
        if (isNegativeAssertionOnly(name, otherText)) negativeAssertionOnly.push(otherPath);
        else testUsers.push(otherPath);
      } else {
        productionUsers.push(otherPath);
      }
    }
    results.push({ name, productionUsers, testUsers, negativeAssertionOnly });
  }
  return results;
}

/** CSS class names referenced by a component, and whether any other file uses them. */
function cssClassOverlap(text) {
  const classes = new Set();
  for (const match of text.matchAll(/className=["'`]([^"'`{]+)["'`]/g)) {
    for (const cls of match[1].split(/\s+/)) if (cls) classes.add(cls);
  }
  return [...classes];
}

const report = [];
for (const file of sourceFiles) {
  const path = rel(file);
  if (isFrameworkEntry(path)) continue;
  const text = contents.get(file) ?? "";
  const users = importers(file);
  if (users.length > 0) continue;

  const exports = exportUsage(file, text);
  const usedInProduction = exports.filter((e) => e.productionUsers.length > 0);
  const usedInTests = exports.filter((e) => e.testUsers.length > 0);
  const retiredByTest = exports.filter(
    (e) =>
      e.productionUsers.length === 0 &&
      e.testUsers.length === 0 &&
      e.negativeAssertionOnly.length > 0,
  );
  const classes = cssClassOverlap(text);
  const sharedClasses = classes.filter((cls) =>
    [...contents].some(([other, otherText]) => other !== file && otherText.includes(cls)),
  );

  let verdict;
  if (usedInProduction.length > 0) {
    verdict = "KEEP — exported names are referenced by production code";
  } else if (retiredByTest.length > 0) {
    verdict = "SAFE — no importers; tests assert it is NOT rendered";
  } else if (usedInTests.length > 0) {
    verdict = "SAFE (update tests) — no importers; only tests reference it";
  } else {
    verdict = "SAFE — no importers, no references anywhere";
  }

  report.push({
    path,
    lines: text.split("\n").length,
    bytes: Buffer.byteLength(text),
    importers: users,
    exports: exports.map((e) => e.name),
    productionReferences: usedInProduction.map((e) => ({ name: e.name, usedBy: e.productionUsers })),
    testReferences: usedInTests.map((e) => ({ name: e.name, usedBy: e.testUsers })),
    retiredByNegativeAssertion: retiredByTest.map((e) => ({
      name: e.name,
      assertedAbsentIn: e.negativeAssertionOnly,
    })),
    cssClasses: classes.length,
    cssClassesAlsoUsedElsewhere: sharedClasses,
    git: gitInfo(path),
    verdict,
  });
}

report.sort((a, b) => b.lines - a.lines);

if (process.argv.includes("--json")) {
  mkdirSync(join(ROOT, "audit-output"), { recursive: true });
  const out = join(ROOT, "audit-output", "candidate-for-removal.json");
  writeFileSync(out, `${JSON.stringify({ generatedAt: new Date().toISOString(), report }, null, 2)}\n`);
  console.log(`Wrote ${out}`);
}

const groups = [
  ["TIER 1 — no references anywhere", report.filter((r) => r.verdict === "SAFE — no importers, no references anywhere")],
  ["TIER 2 — tests assert it is NOT rendered (already retired)", report.filter((r) => r.verdict.includes("NOT rendered"))],
  ["TIER 3 — only tests reference it (test update required first)", report.filter((r) => r.verdict.startsWith("SAFE (update tests)"))],
  ["KEEP — still referenced by production code", report.filter((r) => r.verdict.startsWith("KEEP"))],
];

console.log("=".repeat(78));
console.log("CANDIDATE FOR REMOVAL — evidence report (read-only, nothing deleted)");
console.log("=".repeat(78));
console.log(`scanned source files : ${sourceFiles.length}`);
console.log(`zero-importer files  : ${report.length}\n`);
for (const [label, rows] of groups) {
  console.log(`${String(rows.length).padStart(3)} files, ${String(rows.reduce((s, r) => s + r.lines, 0)).padStart(5)} lines  ${label}`);
}

for (const [label, rows] of groups) {
  if (!rows.length) continue;
  console.log(`\n${"-".repeat(78)}\n${label}\n${"-".repeat(78)}`);
  for (const row of rows) {
    console.log(`\n${row.path}  (${row.lines} lines)`);
    console.log(`  exports        : ${row.exports.join(", ") || "(none)"}`);
    console.log(`  imported by    : none`);
    console.log(`  last change    : ${row.git.lastChange} by ${row.git.author} — ${row.git.subject}`);
    for (const e of row.productionReferences) {
      console.log(`  PRODUCTION use of "${e.name}": ${e.usedBy.slice(0, 4).join(", ")}`);
    }
    for (const e of row.retiredByNegativeAssertion) {
      console.log(`  "${e.name}" asserted ABSENT in: ${e.assertedAbsentIn.join(", ")}`);
    }
    for (const e of row.testReferences) {
      console.log(`  test-only use of "${e.name}": ${e.usedBy.slice(0, 4).join(", ")}`);
    }
    if (row.cssClassesAlsoUsedElsewhere.length) {
      console.log(
        `  KEEP THESE STYLES (shared with live code): ${row.cssClassesAlsoUsedElsewhere.slice(0, 6).join(", ")}`,
      );
    }
  }
}

console.log("\nNo files were modified or deleted by this report.");
