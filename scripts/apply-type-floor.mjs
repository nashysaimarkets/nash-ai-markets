/**
 * Raises every statically-resolvable font-size below the readable floor to
 * `var(--type-floor)`, giving micro-labels one consistent smallest tier
 * instead of an ad-hoc 5px-10px spread.
 *
 * Only rewrites simple single-value px/rem declarations. Anything using calc(),
 * clamp(), min(), max(), em, or a custom property is reported and left alone,
 * because those cannot be resolved without layout context.
 *
 * Dry run by default. Pass --apply to write files.
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { extname, join, relative } from "node:path";

const ROOT = process.cwd();
const APPLY = process.argv.includes("--apply");
const FLOOR_PX = 11;
const ROOT_FONT_PX = 16;
const TOKEN = "var(--type-floor)";

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (["node_modules", ".next", ".git", "dist", "audit-output", ".wrangler"].includes(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (extname(full) === ".css") out.push(full);
  }
  return out;
}

function resolvePx(raw) {
  let value = raw.trim();
  let important = "";
  const bang = value.match(/^(.*?)\s*(!important)$/);
  if (bang) {
    value = bang[1].trim();
    important = " !important";
  }
  if (/var\(|calc\(|clamp\(|min\(|max\(/.test(value)) return { skipped: "dynamic" };
  const px = value.match(/^(-?[\d.]+)px$/);
  if (px) return { px: parseFloat(px[1]), important };
  const rem = value.match(/^(-?[\d.]+)rem$/);
  if (rem) return { px: parseFloat(rem[1]) * ROOT_FONT_PX, important };
  if (/em$/.test(value)) return { skipped: "em (relative)" };
  return { skipped: "unrecognised" };
}

const changes = [];
const skipped = [];

for (const file of walk(ROOT)) {
  const original = readFileSync(file, "utf8");
  let changedInFile = 0;

  /*
   * `font` shorthand: leave it untouched and override with a following
   * `font-size`. Substituting var() inside the shorthand would make the whole
   * declaration invalid-at-computed-value-time if the token ever went missing,
   * taking font-family down with it.
   */
  let updated = original.replace(
    /(^|[;{\s])font:\s*([^;}]+)([;}])/g,
    (match, lead, rawValue, terminator, offset, source) => {
    const sizeToken = rawValue.match(/(^|\s)(-?[\d.]+)(px|rem)(\/[\d.]+\w*)?(?=\s)/);
    if (!sizeToken) return match;
    // Already floored on a previous run — the override follows the shorthand.
    if (source.slice(offset + match.length).startsWith(`font-size:${TOKEN}`)) return match;
    const px = sizeToken[3] === "rem" ? parseFloat(sizeToken[2]) * ROOT_FONT_PX : parseFloat(sizeToken[2]);
    if (!(px < FLOOR_PX)) return match;
    changedInFile += 1;
    changes.push({ file: relative(ROOT, file), from: `font shorthand ${sizeToken[2]}${sizeToken[3]}`, px });
      return `${lead}font:${rawValue};font-size:${TOKEN}${terminator}`;
    },
  );

  updated = updated.replace(/font-size:\s*([^;}]+)([;}])/g, (match, rawValue, terminator) => {
    const resolved = resolvePx(rawValue);
    if (resolved.skipped) {
      if (/^\s*[\d.]/.test(rawValue)) skipped.push({ file: relative(ROOT, file), value: rawValue.trim(), reason: resolved.skipped });
      return match;
    }
    if (!(resolved.px < FLOOR_PX)) return match;
    changedInFile += 1;
    changes.push({ file: relative(ROOT, file), from: rawValue.trim(), px: resolved.px });
    return `font-size: ${TOKEN}${resolved.important ?? ""}${terminator}`;
  });

  if (changedInFile > 0 && APPLY) writeFileSync(file, updated);
}

const byFile = new Map();
for (const change of changes) byFile.set(change.file, (byFile.get(change.file) ?? 0) + 1);
const bySize = new Map();
for (const change of changes) bySize.set(`${change.px}px`, (bySize.get(`${change.px}px`) ?? 0) + 1);

console.log(`${APPLY ? "APPLIED" : "DRY RUN"} — floor ${FLOOR_PX}px -> ${TOKEN}`);
console.log(`declarations rewritten: ${changes.length}\n`);
console.log("by file:");
[...byFile.entries()].sort((a, b) => b[1] - a[1]).forEach(([f, n]) => console.log(`  ${String(n).padStart(3)}  ${f}`));
console.log("\nby original size:");
[...bySize.entries()]
  .sort((a, b) => parseFloat(a[0]) - parseFloat(b[0]))
  .forEach(([s, n]) => console.log(`  ${String(n).padStart(3)}  ${s}`));

if (skipped.length) {
  console.log(`\nleft alone (need manual review): ${skipped.length}`);
  const uniq = new Map();
  for (const s of skipped) uniq.set(`${s.value} (${s.reason})`, (uniq.get(`${s.value} (${s.reason})`) ?? 0) + 1);
  [...uniq.entries()].slice(0, 15).forEach(([v, n]) => console.log(`  ${String(n).padStart(3)}  ${v}`));
}

if (!APPLY) console.log("\nNo files written. Re-run with --apply.");
