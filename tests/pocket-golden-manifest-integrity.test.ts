import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { validatePocketGoldenCase, type PocketGoldenCase } from "./support/pocket-golden-regression.ts";

type Manifest = { schemaVersion: number; cases: PocketGoldenCase[] };

const here = dirname(fileURLToPath(import.meta.url));
const fixtureRoot = join(here, "fixtures", "pocket-golden");

async function loadManifest(): Promise<Manifest> {
  return JSON.parse(await readFile(join(fixtureRoot, "manifest.json"), "utf8")) as Manifest;
}

test("golden benchmark manifest cannot silently be empty", async () => {
  const manifest = await loadManifest();
  assert.equal(manifest.schemaVersion, 1);
  assert.ok(manifest.cases.length > 0, "golden benchmark has zero registered image cases");
});

test("registered golden cases are valid and unique", async () => {
  const manifest = await loadManifest();
  const ids = new Set<string>();
  const files = new Set<string>();
  for (const item of manifest.cases) {
    validatePocketGoldenCase(item);
    assert.ok(!ids.has(item.id), "duplicate golden case id");
    assert.ok(!files.has(item.imageFile), "duplicate golden image file");
    ids.add(item.id);
    files.add(item.imageFile);
  }
});
