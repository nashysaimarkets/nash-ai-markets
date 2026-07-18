import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import test from "node:test";

const read = (path: string) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("public launch routes expose canonical metadata without inventing market content", async () => {
  const [home, about, blog, contact, pricing, membership] = await Promise.all([
    read("app/page.tsx"),
    read("app/about/page.tsx"),
    read("app/blog/page.tsx"),
    read("app/contact/page.tsx"),
    read("app/pricing/page.tsx"),
    read("app/membership/page.tsx"),
  ]);
  assert.match(home, /canonical: "\/"/);
  assert.match(about, /canonical: "\/about"/);
  assert.match(blog, /canonical: "\/blog"/);
  assert.match(blog, /images: \[/);
  assert.match(blog, /url: "\/og-image\.png"/);
  assert.match(contact, /canonical: "\/contact"/);
  assert.match(pricing, /canonical: "\/pricing"/);
  assert.match(membership, /redirect\("\/pricing"\)/);
  assert.match(blog, /NO LIVE MARKET DATA/);
  assert.doesNotMatch(blog, /guaranteed performance|[0-9,]+ members|live (buy|sell) signal/i);
});

test("search discovery includes public journal and excludes protected product routes", async () => {
  const [robots, sitemap] = await Promise.all([read("app/robots.ts"), read("app/sitemap.ts")]);
  assert.match(robots, /sitemap: "https:\/\/www\.nashaimarkets\.com\/sitemap\.xml"/);
  assert.match(robots, /"\/blog"/);
  assert.match(robots, /"\/ideas"/);
  assert.match(robots, /"\/preferences"/);
  assert.match(sitemap, /"\/blog"/);
  assert.doesNotMatch(sitemap, /"\/dashboard"|"\/terminal"|"\/profile"/);
});

test("social, structured-data and icon assets are production-ready", async () => {
  const [layout, manifest, og, maskable] = await Promise.all([
    read("app/layout.tsx"),
    read("app/manifest.ts"),
    stat(new URL("../public/og-image.png", import.meta.url)),
    stat(new URL("../public/icons/app-icon-maskable-512.png", import.meta.url)),
  ]);
  assert.match(layout, /og-image\.png/);
  assert.match(layout, /application\/ld\+json/);
  assert.match(layout, /https:\/\/schema\.org/);
  assert.match(layout, /SoftwareApplication/);
  assert.match(manifest, /app-icon-maskable-512\.png/);
  assert.ok(og.size > 10_000);
  assert.ok(maskable.size > 10_000);
});

test("final audit fixes remain scoped to public launch surfaces", async () => {
  const css = await read("app/launch-candidate.css");
  assert.match(css, /@media\(min-width:1101px\)/);
  assert.match(css, /\.mcHero h1/);
  assert.match(css, /\.journalPage/);
  assert.match(css, /\.legalPrinciples/);
  assert.doesNotMatch(css, /\.memberDashboard|\.foxtrotTerminal|\.accessPage/);
});
