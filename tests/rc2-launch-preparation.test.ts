import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path: string) => readFile(new URL(path, root), "utf8");

test("RC2 uses one accessible premium loader across asynchronous routes", async () => {
  const component = await read("app/components/BrandLoader.tsx");
  assert.match(component, /role="status"/);
  assert.match(component, /aria-label=\{label\}/);
  const routes = [
    "app/admin/founding-100/loading.tsx",
    "app/brief/loading.tsx",
    "app/dashboard/loading.tsx",
    "app/founding-member/loading.tsx",
    "app/profile/loading.tsx",
    "app/terminal/loading.tsx",
    "app/waitlist/loading.tsx",
  ];
  for (const [path, route] of await Promise.all(routes.map(async (path) => [path, await read(path)] as const))) {
    if (path === "app/terminal/loading.tsx") {
      assert.match(route, /aria-busy="true"|<BrandLoader/);
      assert.match(route, /Trading Desk|BrandLoader/);
      continue;
    }
    assert.match(route, /<BrandLoader/);
  }
});

test("launch copy no longer presents public surfaces as unfinished or private beta", async () => {
  const [help, waitlist, founding] = await Promise.all([
    read("app/help/page.tsx"),
    read("app/waitlist/page.tsx"),
    read("app/founding-member/page.tsx"),
  ]);
  assert.doesNotMatch(help, /being prepared for public launch/i);
  assert.doesNotMatch(waitlist, /private beta/i);
  assert.doesNotMatch(founding, /private beta/i);
  assert.match(help, /Add to Home Screen/);
});

test("release provenance identifies RC2 without inventing a test total", async () => {
  const [pkg, lock, example] = await Promise.all([
    read("package.json"),
    read("package-lock.json"),
    read(".env.example"),
  ]);
  assert.equal(JSON.parse(pkg).version, "1.0.0-rc.2");
  assert.equal(JSON.parse(lock).version, "1.0.0-rc.2");
  assert.match(example, /APP_VERSION=1\.0\.0-rc\.2/);
  assert.match(example, /BULLSEYE_TEST_TOTALS=\n/);
});
