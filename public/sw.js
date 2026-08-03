/* NASH AI Markets application-shell service worker.
 * Account, billing, API, market and personalised routes are always network-only.
 */
const VERSION = "nash-shell-v2";
const SHELL_CACHE = `${VERSION}-shell`;
const STATIC_CACHE = `${VERSION}-static`;
const SHELL_ASSETS = [
  "/offline.html",
  "/manifest.webmanifest",
  "/favicon.svg",
  "/icons/app-icon-192.png",
  "/icons/app-icon-512.png",
];
const PRIVATE_PREFIXES = [
  "/api/",
  "/auth/",
  "/admin/",
  "/brief",
  "/dashboard",
  "/founding-member",
  "/onboarding",
  "/profile",
  "/terminal",
  "/membership-required",
];

function isPrivatePath(pathname) {
  return PRIVATE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(prefix));
}

function isSafeStaticRequest(request, url) {
  if (url.origin !== self.location.origin || request.method !== "GET" || isPrivatePath(url.pathname)) return false;
  return ["style", "script", "font", "image"].includes(request.destination)
    || url.pathname.startsWith("/_next/static/")
    || url.pathname.startsWith("/assets/")
    || url.pathname.startsWith("/icons/")
    || url.pathname.startsWith("/splash/");
}

function canStore(response) {
  if (!response || !response.ok || response.type === "opaque") return false;
  const cacheControl = response.headers.get("cache-control") || "";
  return !/no-store|private/i.test(cacheControl) && !response.headers.has("set-cookie");
}

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_ASSETS)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => ![SHELL_CACHE, STATIC_CACHE].includes(key)).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || isPrivatePath(url.pathname)) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => {
        const offline = await caches.match("/offline.html");
        return offline || new Response("NASH AI Markets is offline.", { status: 503, headers: { "content-type": "text/plain; charset=utf-8" } });
      }),
    );
    return;
  }

  if (!isSafeStaticRequest(request, url)) return;

  // Executable UI assets must prefer the current deployment. Vinext can keep
  // an asset URL stable while build-time public configuration changes, so
  // stale-first delivery can otherwise run an obsolete Auth bundle.
  if (request.destination === "script" || request.destination === "style") {
    event.respondWith(
      fetch(request)
        .then(async (response) => {
          if (canStore(response)) {
            const cache = await caches.open(STATIC_CACHE);
            await cache.put(request, response.clone());
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          return cached || new Response("Required application asset is unavailable.", { status: 503 });
        }),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      const refresh = fetch(request).then(async (response) => {
        if (canStore(response)) {
          const cache = await caches.open(STATIC_CACHE);
          await cache.put(request, response.clone());
        }
        return response;
      });
      return cached || refresh;
    }),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});
