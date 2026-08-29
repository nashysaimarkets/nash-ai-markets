const rawUrl = process.env.CAPACITOR_SERVER_URL?.trim() ?? "";
const expectedRevision = process.env.CAPACITOR_SERVER_REVISION?.trim() ?? "";

function fail(message) {
  console.error(`Capacitor server verification failed: ${message}`);
  process.exit(1);
}

if (!rawUrl) fail("CAPACITOR_SERVER_URL is required.");
if (!/^[a-f0-9]{40}$/i.test(expectedRevision)) fail("CAPACITOR_SERVER_REVISION must be an exact 40-character Git revision.");

let serverUrl;
try {
  serverUrl = new URL(rawUrl);
} catch {
  fail("CAPACITOR_SERVER_URL is not a valid URL.");
}

if (serverUrl.protocol !== "https:" || serverUrl.username || serverUrl.password || serverUrl.search || serverUrl.hash) {
  fail("CAPACITOR_SERVER_URL must be a credential-free HTTPS URL without a query or fragment.");
}
if (serverUrl.pathname.replace(/\/$/, "") !== "/pocket") fail("CAPACITOR_SERVER_URL must point to /pocket.");
if (serverUrl.hostname === "pocket.nashaimarkets.com" || serverUrl.hostname.includes("-git-")) {
  fail("Use the immutable deployment URL, not production or a mutable branch alias.");
}

const manifestUrl = new URL("/api/pocket/build-manifest", serverUrl.origin);
let response;
try {
  response = await fetch(manifestUrl, { headers: { accept: "application/json" }, redirect: "error" });
} catch (error) {
  fail(`could not reach ${manifestUrl}: ${error instanceof Error ? error.message : "network error"}`);
}
if (!response.ok) fail(`build manifest returned HTTP ${response.status}.`);

let payload;
try {
  payload = await response.json();
} catch {
  fail("build manifest did not return JSON.");
}
if (payload?.revision !== expectedRevision) {
  fail(`preview revision ${String(payload?.revision ?? "missing")} does not match ${expectedRevision}.`);
}

console.log(`Verified immutable Pocket web revision ${expectedRevision.slice(0, 12)} at ${serverUrl.origin}.`);
