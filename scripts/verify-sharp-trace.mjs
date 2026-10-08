import assert from "node:assert/strict";
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const tracePath = path.resolve(".next/server/app/api/pocket/torture/route.js.nft.json");
const trace = JSON.parse(await readFile(tracePath, "utf8"));
const files = trace.files.map(file => path.resolve(path.dirname(tracePath), file));
const root = path.resolve("node_modules");
const nativeFiles = files.filter(file => file.startsWith(root + path.sep));
assert.ok(nativeFiles.some(file => file.includes("@img/sharp-linux-x64/") && file.endsWith(".node")), "trace omitted Sharp Linux binding");
assert.ok(nativeFiles.some(file => file.includes("@img/sharp-libvips-linux-x64/") && file.includes("libvips-cpp.so")), "trace omitted libvips shared library");

// Outside the checkout: the smoke test cannot resolve untraced dependencies
// from the original node_modules, even when those happen to exist in CI.
const isolated = await mkdtemp(path.join(tmpdir(), "bullseye-sharp-trace-"));
try {
  for (const source of nativeFiles) {
    const target = path.join(isolated, "node_modules", path.relative(root, source));
    await mkdir(path.dirname(target), { recursive: true });
    await copyFile(source, target);
  }
  await writeFile(path.join(isolated, "smoke.cjs"), `
    const assert = require('node:assert/strict');
    const sharp = require('sharp');
    (async () => {
      const png = await sharp(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="900" height="600"><rect width="900" height="600" fill="white"/></svg>')).png().toBuffer();
      assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
      const metadata = await sharp(png).metadata();
      assert.equal(metadata.width, 900);
      assert.equal(metadata.height, 600);
      console.log('Isolated production trace: Sharp/libvips SVG rasterization passed');
    })().catch(error => { console.error(error); process.exitCode = 1; });
  `);
  const child = spawnSync(process.execPath, [path.join(isolated, "smoke.cjs")], {
    cwd: isolated, encoding: "utf8", env: { ...process.env, NODE_PATH: "" }, timeout: 30000,
  });
  process.stdout.write(child.stdout ?? "");
  process.stderr.write(child.stderr ?? "");
  assert.equal(child.status, 0, child.error?.message ?? "isolated traced Sharp failed");
} finally {
  await rm(isolated, { recursive: true, force: true });
}
