import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path: string) => readFile(new URL(path, import.meta.url), "utf8");

test("preferences route hosts local workspace controls and links to onboarding", async () => {
  const [prefs, client, shell, onboarding] = await Promise.all([
    read("../app/preferences/page.tsx"),
    read("../app/preferences/PreferencesClient.tsx"),
    read("../app/components/MemberShell.tsx"),
    read("../app/onboarding/page.tsx"),
  ]);
  assert.match(prefs, /Personal workspace/);
  assert.match(prefs, /PreferencesClient/);
  assert.match(prefs, /href="\/onboarding"/);
  assert.match(client, /DashboardWorkspaceControls/);
  assert.doesNotMatch(prefs, /from\("memberships"\)|stripe|service_role/i);
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
  assert.equal((shell.match(/links\.filter\([\s\S]*?\.map\(/g) ?? []).length, 2);
});

test("Profile routes members to Preferences without inventing a second membership system", async () => {
  const [profile, prefs, onboarding] = await Promise.all([
    read("../app/profile/page.tsx"),
    read("../app/preferences/page.tsx"),
    read("../app/onboarding/page.tsx"),
  ]);
  assert.match(profile, /href="\/preferences"/);
  assert.match(profile, /Update workspace preferences|Complete workspace setup/);
  assert.match(prefs, /Personal workspace/);
  assert.match(prefs, /href="\/onboarding"/);
  assert.match(onboarding, /WORKSPACE PREFERENCES/);
  assert.match(onboarding, /Refine your market workspace/);
  assert.match(onboarding, /Set up your market workspace/);
  assert.doesNotMatch(prefs, /stripe|memberships|service_role/i);
});
