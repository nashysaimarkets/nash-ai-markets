import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path: string) => readFile(new URL(path, import.meta.url), "utf8");

test("member navigation hides unfinished More and Present controls", async () => {
  const shell = await read("../app/components/MemberShell.tsx");
  assert.doesNotMatch(shell, /memberMoreMenu/);
  assert.doesNotMatch(shell, />More</);
  assert.doesNotMatch(shell, /PresentationModeToggle/);
  assert.doesNotMatch(shell, />Present</);
  assert.doesNotMatch(shell, /Exit present/);
  assert.match(shell, /unfinishedWorkspaceLinks/);
  assert.match(shell, /href: "\/journal"/);
  assert.match(shell, /aria-label="Member navigation"/);
  assert.match(shell, /aria-label="Mobile member navigation"/);
});

test("primary signed-in destinations remain in desktop and mobile navigation", async () => {
  const shell = await read("../app/components/MemberShell.tsx");
  for (const href of [
    "/dashboard",
    "/brief",
    "/terminal",
    "/ideas",
    "/profile",
    "/preferences",
  ]) {
    assert.match(shell, new RegExp(`href: "${href}"`));
  }
  assert.match(shell, /href="\/auth\/signout"/);
});
