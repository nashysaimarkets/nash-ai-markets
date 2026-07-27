import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path: string) =>
  readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("desktop workspace menu stays above page content and accepts pointer input", async () => {
  const [css, todayCss] = await Promise.all([
    read("app/mission-control.css"),
    read("app/today-live.css"),
  ]);

  assert.match(css, /\.memberDashboardNav\{overflow:visible;isolation:isolate\}/);
  assert.match(css, /\.memberMoreMenu\[open\]\{z-index:100\}/);
  assert.match(css, /\.memberMorePanel\{[^}]*z-index:1000;[^}]*pointer-events:auto/);
  assert.match(css, /\.memberMorePanel a\{[^}]*pointer-events:auto/);
  assert.match(todayCss, /\.todayMemberPage \.memberDashboardNav\{[^}]*z-index:1000/);
  assert.match(todayCss, /\.todayMemberPage #member-content\{position:relative;z-index:0\}/);
});

test("every workspace menu destination has a page", async () => {
  const shell = await read("app/components/MemberShell.tsx");
  const menu = shell.slice(shell.indexOf("const moreLinks"), shell.indexOf("const moreActive"));
  const destinations = [...menu.matchAll(/href: "\/([^"]+)"/g)].map((match) => match[1]);

  assert.deepEqual(destinations, [
    "archive",
    "journal",
    "performance",
    "results",
    "replay",
    "methodology",
    "ideas",
    "onboarding",
    "dashboard",
  ]);

  await Promise.all(destinations.map((destination) => read(`app/${destination}/page.tsx`)));
});
