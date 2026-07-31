/**
 * Repairs platform-specific native packages that npm installed as empty
 * directories (npm/cli#4828 — optional dependencies are recorded in the lock
 * file but their tarballs are not always extracted).
 *
 * Symptom: builds fail with "Cannot find native binding" even though the
 * package directory exists under node_modules.
 *
 * Usage: node scripts/repair-native-bindings.mjs
 */
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const ROOT = process.cwd();
const MODULES = join(ROOT, "node_modules");

function packageDirs(root = MODULES, out = []) {
  if (!existsSync(root)) return out;
  for (const entry of readdirSync(root)) {
    if (entry === ".bin" || entry === ".cache") continue;
    const full = join(root, entry);
    if (entry.startsWith("@")) {
      for (const inner of readdirSync(full)) {
        const pkg = join(full, inner);
        out.push(pkg);
        const nested = join(pkg, "node_modules");
        if (existsSync(nested)) packageDirs(nested, out);
      }
      continue;
    }
    out.push(full);
    const nested = join(full, "node_modules");
    if (existsSync(nested)) packageDirs(nested, out);
  }
  return out;
}

/** A native package is broken when it declares a .node main that is absent. */
function brokenNativePackages() {
  const broken = [];
  for (const dir of packageDirs()) {
    const manifestPath = join(dir, "package.json");
    if (!existsSync(manifestPath)) continue;
    let manifest;
    try {
      manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    } catch {
      continue;
    }
    const main = typeof manifest.main === "string" ? manifest.main : "";
    const files = Array.isArray(manifest.files) ? manifest.files.map(String) : [];
    const nodeFile = main.endsWith(".node")
      ? main
      : // Skip negations ("!dist/*.node") and globs — only literal paths are resolvable.
        files.find((f) => f.endsWith(".node") && !f.startsWith("!") && !f.includes("*"));
    if (!nodeFile) continue;
    if (existsSync(join(dir, nodeFile))) continue;
    broken.push({ dir, name: manifest.name, version: manifest.version, nodeFile });
  }
  return broken;
}

const broken = brokenNativePackages();
if (!broken.length) {
  console.log("All native bindings present. Nothing to repair.");
  process.exit(0);
}

console.log(`Repairing ${broken.length} native package(s):`);
let repaired = 0;
for (const pkg of broken) {
  const staging = mkdtempSync(join(tmpdir(), "native-binding-"));
  try {
    execFileSync("npm", ["pack", `${pkg.name}@${pkg.version}`, "--pack-destination", staging], {
      stdio: "pipe",
    });
    const tarball = readdirSync(staging).find((f) => f.endsWith(".tgz"));
    if (!tarball) throw new Error("npm pack produced no tarball");
    execFileSync("tar", ["-xzf", join(staging, tarball), "-C", staging]);
    const source = join(staging, "package", pkg.nodeFile);
    if (!existsSync(source)) throw new Error(`tarball has no ${pkg.nodeFile}`);
    cpSync(source, join(pkg.dir, pkg.nodeFile));
    console.log(`  repaired ${pkg.name}@${pkg.version}`);
    repaired += 1;
  } catch (error) {
    console.error(`  FAILED  ${pkg.name}@${pkg.version}: ${error.message}`);
  } finally {
    rmSync(staging, { recursive: true, force: true });
  }
}

console.log(`\nRepaired ${repaired}/${broken.length}.`);
process.exit(repaired === broken.length ? 0 : 1);
