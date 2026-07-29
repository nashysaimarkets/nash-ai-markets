import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path: string) => readFile(new URL(path, import.meta.url), "utf8");

test("preferences route aliases the existing onboarding workspace preferences", async () => {
  const [prefs, shell, onboarding] = await Promise.all([
    read("../app/preferences/page.tsx"),
    read("../app/components/MemberShell.tsx"),
    read("../app/onboarding/page.tsx"),
  ]);
  assert.match(prefs, /redirect\("\/onboarding"\)/);
  assert.doesNotMatch(prefs, /createClient|from\("memberships"\)|stripe/i);
  assert.match(shell, /href: "\/preferences"/);
  assert.match(shell, /label: "Preferences"/);
  assert.match(onboarding, /MemberShell active="onboarding"/);
  assert.match(onboarding, /WORKSPACE PREFERENCES|Refine your market workspace|Set up your market workspace/);
});

test("desktop and mobile member navigation both expose Preferences", async () => {
  const shell = await read("../app/components/MemberShell.tsx");
  assert.match(shell, /aria-label="Member navigation"/);
  assert.match(shell, /aria-label="Mobile member navigation"/);
  assert.equal((shell.match(/href: "\/preferences"/g) ?? []).length, 1);
  assert.match(shell, /links\.map/);
});
