import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, existsSync } from "node:fs";
import { MEMBER_ROUTES, PUBLIC_ROUTES, VIEWPORTS, resolveBaseUrl } from "../audit/src/config.ts";
import { sanitizeText, sanitizeUrl } from "../audit/src/sanitize.ts";

test("audit inventory covers required public and member routes", () => {
  const publicPaths = PUBLIC_ROUTES.map((item) => item.path);
  const memberPaths = MEMBER_ROUTES.map((item) => item.path);
  for (const path of ["/", "/login", "/privacy", "/terms", "/risk-disclaimer", "/contact", "/pricing"]) {
    assert.ok(publicPaths.includes(path), path);
  }
  for (const path of ["/dashboard", "/brief", "/terminal", "/ideas", "/profile", "/preferences"]) {
    assert.ok(memberPaths.includes(path), path);
  }
  assert.equal(VIEWPORTS.length, 5);
  assert.match(resolveBaseUrl(), /^https?:\/\//);
});

test("audit sanitizer redacts tokens and emails", () => {
  assert.match(
    sanitizeUrl("https://example.com/auth/callback#access_token=secret&refresh_token=secret2"),
    /redacted/i,
  );
  assert.doesNotMatch(sanitizeText("user@example.com Bearer abc.def.ghi"), /user@example\.com|abc\.def\.ghi/);
});

test("package scripts expose audit commands and gitignore excludes artifacts", () => {
  const pkg = JSON.parse(readFileSync("package.json", "utf8")) as { scripts: Record<string, string> };
  assert.match(pkg.scripts["audit:all"] ?? "", /run-audit/);
  assert.match(pkg.scripts["audit:setup"] ?? "", /mode=setup/);
  const ignore = readFileSync(".gitignore", "utf8");
  assert.match(ignore, /audit-output/);
  assert.match(ignore, /storage-state\.json/);
  assert.match(ignore, /project-bullseye-audit\.zip/);
  assert.ok(existsSync("audit/README.md"));
});
