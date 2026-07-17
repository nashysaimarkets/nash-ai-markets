import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path: string) => readFile(new URL(path, root), "utf8");

test("manifest exposes installable platform icons and standalone scope", async () => {
  const manifest = await read("app/manifest.ts");
  assert.match(manifest, /display: "standalone"/);
  assert.match(manifest, /scope: "\/"/);
  assert.match(manifest, /app-icon-192\.png/);
  assert.match(manifest, /app-icon-512\.png/);
  assert.match(manifest, /app-icon-maskable-512\.png[\s\S]*purpose: "maskable"/);
  await Promise.all([
    access(new URL("public/icons/app-icon-192.png", root)),
    access(new URL("public/icons/app-icon-512.png", root)),
    access(new URL("public/icons/app-icon-maskable-512.png", root)),
    access(new URL("public/icons/apple-touch-icon.png", root)),
  ]);
});

test("iOS configuration provides touch icon, standalone metadata and launch images", async () => {
  const layout = await read("app/layout.tsx");
  assert.match(layout, /appleWebApp/);
  assert.match(layout, /apple-touch-icon\.png/);
  assert.match(layout, /apple-touch-startup-image/);
  assert.match(layout, /apple-splash-1290x2796\.png/);
});

test("service worker caches only the application shell and safe static assets", async () => {
  const [worker, edgeWorker] = await Promise.all([read("public/sw.js"), read("worker/index.ts")]);
  assert.match(worker, /PRIVATE_PREFIXES/);
  for (const path of ["/api/", "/auth/", "/dashboard", "/brief", "/terminal"]) assert.match(worker, new RegExp(path.replaceAll("/", "\\/")));
  assert.match(worker, /request\.mode === "navigate"/);
  assert.match(worker, /no-store\|private/);
  assert.match(worker, /set-cookie/);
  assert.doesNotMatch(worker, /cache\.put\(request[\s\S]*isPrivatePath/);
  assert.match(edgeWorker, /url\.pathname === "\/sw\.js"/);
  assert.match(edgeWorker, /headers\.delete\("cache-control"\)/);
  assert.match(edgeWorker, /cache-control", "no-cache"/);
  assert.match(edgeWorker, /service-worker-allowed", "\/"/);
});

test("offline state fails closed and install guidance is platform appropriate", async () => {
  const [offline, controller] = await Promise.all([
    read("public/offline.html"),
    read("app/components/PwaController.tsx"),
  ]);
  assert.match(offline, /VERIFIED DATA UNAVAILABLE/);
  assert.match(offline, /No trading guidance is available/);
  assert.match(controller, /beforeinstallprompt/);
  assert.match(controller, /Add to Home Screen/);
  assert.match(controller, /window\.isSecureContext/);
  assert.match(controller, /registration\.update\(\)/);
  assert.match(controller, /SKIP_WAITING/);
  assert.match(controller, /reloads only after you choose Update/);
  assert.doesNotMatch(controller, /OPENAI_API_KEY|STRIPE_SECRET|SUPABASE_SERVICE/);
});
