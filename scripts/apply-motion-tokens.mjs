/**
 * Normalises interaction transition timings onto the shared motion token so
 * hover/focus feedback feels identical across every page.
 *
 * Only durations at or below INTERACTION_CEILING are touched. Longer values are
 * entrance and ambient animations, where the specific timing is the design.
 *
 * Dry run by default. Pass --apply to write files.
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { extname, join, relative } from "node:path";

const ROOT = process.cwd();
const APPLY = process.argv.includes("--apply");
const INTERACTION_CEILING_MS = 300;
const TOKEN = "var(--vx-fast)";

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (["node_modules", ".next", ".git", "dist", "audit-output", ".wrangler"].includes(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (extname(full) === ".css") out.push(full);
  }
  return out;
}

const toMs = (value, unit) => (unit === "ms" ? parseFloat(value) : parseFloat(value) * 1000);

const changes = [];
const untouched = [];

for (const file of walk(join(ROOT, "app"))) {
  const original = readFileSync(file, "utf8");
  let changedInFile = 0;

  const updated = original.replace(/transition:\s*([^;}]+)([;}])/g, (match, rawValue, terminator) => {
    if (rawValue.includes("--vx-")) return match;
    const rewritten = rawValue.replace(/(-?[\d.]+)(ms|s)\b/g, (dur, value, unit) => {
      const ms = toMs(value, unit);
      if (ms > INTERACTION_CEILING_MS) {
        untouched.push({ file: relative(ROOT, file), duration: dur, ms });
        return dur;
      }
      changedInFile += 1;
      changes.push({ file: relative(ROOT, file), from: dur, ms });
      return TOKEN;
    });
    return `transition: ${rewritten}${terminator}`;
  });

  if (changedInFile > 0 && APPLY) writeFileSync(file, updated);
}

const byFile = new Map();
for (const c of changes) byFile.set(c.file, (byFile.get(c.file) ?? 0) + 1);
const byDuration = new Map();
for (const c of changes) byDuration.set(c.from, (byDuration.get(c.from) ?? 0) + 1);

console.log(`${APPLY ? "APPLIED" : "DRY RUN"} — interaction transitions <=${INTERACTION_CEILING_MS}ms -> ${TOKEN}`);
console.log(`durations rewritten: ${changes.length}\n`);
console.log("by file:");
[...byFile.entries()].sort((a, b) => b[1] - a[1]).forEach(([f, n]) => console.log(`  ${String(n).padStart(3)}  ${f}`));
console.log("\nby original duration:");
[...byDuration.entries()]
  .sort((a, b) => a[1] - b[1])
  .forEach(([d, n]) => console.log(`  ${String(n).padStart(3)}  ${d}`));

if (untouched.length) {
  const uniq = new Map();
  for (const u of untouched) uniq.set(u.duration, (uniq.get(u.duration) ?? 0) + 1);
  console.log(`\nleft alone (entrance/ambient, >${INTERACTION_CEILING_MS}ms): ${untouched.length}`);
  [...uniq.entries()].sort((a, b) => b[1] - a[1]).forEach(([d, n]) => console.log(`  ${String(n).padStart(3)}  ${d}`));
}

if (!APPLY) console.log("\nNo files written. Re-run with --apply.");
