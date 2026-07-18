import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const appRoot = new URL("../app/", import.meta.url);

async function collectPages(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await collectPages(target));
    if (entry.isFile() && entry.name === "page.tsx") files.push(target);
  }
  return files;
}

test("shared BrandLogo exposes consistent destinations, context, and mobile treatment", async () => {
  const source = await readFile(new URL("../app/components/BrandLogo.tsx", import.meta.url), "utf8");
  assert.match(source, /audience === "member" \? "\/dashboard" : "\/"/);
  assert.match(source, /context\?: "markets" \| "bullseye" \| "launch"/);
  assert.match(source, /data-mobile-compact=\{compactOnMobile\}/);
  assert.match(source, /aria-label=/);
  assert.match(source, /brandLogoMark/);
});

test("every rendered application page includes the shared brand or authenticated MemberShell", async () => {
  const pages = await collectPages(appRoot.pathname);
  const missing: string[] = [];
  for (const file of pages) {
    const source = await readFile(file, "utf8");
    if (!source.includes("BrandLogo") && !source.includes("MemberShell")) {
      missing.push(path.relative(appRoot.pathname, file));
    }
  }
  assert.deepEqual(missing, []);
});

test("legacy page-level logo implementations are no longer rendered", async () => {
  const pages = await collectPages(appRoot.pathname);
  for (const file of pages) {
    const source = await readFile(file, "utf8");
    assert.doesNotMatch(source, /mcBrandMark|className="ftBrand"|className="mcBrand"|className="brand"/);
  }
});

test("authentication, system-state, error, loading, and 404 surfaces retain identity", async () => {
  const files = [
    "../app/login/page.tsx",
    "../app/auth/implicit/page.tsx",
    "../app/cancelled/page.tsx",
    "../app/welcome/page.tsx",
    "../app/not-found.tsx",
    "../app/terminal/error.tsx",
    "../app/dashboard/error.tsx",
    "../app/terminal/loading.tsx",
    "../app/components/BrandLoader.tsx",
  ];
  for (const file of files) {
    const source = await readFile(new URL(file, import.meta.url), "utf8");
    assert.match(source, /BrandLogo/);
  }
});

test("brand styling provides focus visibility and compact mobile wordmark behavior", async () => {
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(css, /\.brandLogo:focus-visible/);
  assert.match(css, /\.brandLogo\[data-mobile-compact=true\] \.brandLogoWordmark/);
  assert.match(css, /\.brandLogoMark/);
});
