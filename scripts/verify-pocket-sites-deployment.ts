import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const POCKET_SITES_ORIGIN = "https://pocket.nashaimarkets.com";

type Fetcher = typeof fetch;

function stop(reason: string): never {
  throw new Error("Pocket Sites cutover HOLD: " + reason);
}

/**
 * Read-only post-deployment check. Never signs in, sends images, buys anything,
 * consumes the provider, or trusts the DNS alone as evidence of deployment.
 */
export async function verifyPocketSitesDeployment(expectedRevision: string, requester: Fetcher = fetch) {
  if (!/^[a-f0-9]{40}$/i.test(expectedRevision)) stop("expected immutable 40-character Git revision is required");
  async function request(path: string) {
    const response = await requester(POCKET_SITES_ORIGIN + path, {
      method: "GET",
      credentials: "omit",
      redirect: "manual",
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (response.status >= 300 && response.status < 400) stop(path + " redirected unexpectedly");
    if (response.url) {
      const actual = new URL(response.url);
      if (actual.origin !== POCKET_SITES_ORIGIN || actual.pathname !== path) stop(path + " resolved to a different route or origin");
    }
    return response;
  }

  const manifest = await request("/api/pocket/build-manifest");
  if (manifest.status !== 200 || !/no-store/i.test(manifest.headers.get("cache-control") ?? "")) {
    stop("build manifest missing, cached or unavailable");
  }
  const manifestBody: unknown = await manifest.json();
  if (!manifestBody || typeof manifestBody !== "object" || !("revision" in manifestBody)
    || typeof manifestBody.revision !== "string" || manifestBody.revision.toLowerCase() !== expectedRevision.toLowerCase()) {
    stop("live Sites build revision differs from approved candidate");
  }

  const access = await request("/api/pocket/subscription-access");
  if (access.status !== 401 || !/no-store/i.test(access.headers.get("cache-control") ?? "")
    || !/cookie/i.test(access.headers.get("vary") ?? "")) {
    stop("unsigned subscription-access request was not privately denied");
  }
  const accessBody: unknown = await access.json();
  if (!accessBody || typeof accessBody !== "object"
    || !("entitled" in accessBody) || accessBody.entitled !== false
    || !("code" in accessBody) || accessBody.code !== "POCKET_LOGIN_REQUIRED") {
    stop("unsigned subscription-access response did not fail closed");
  }

  const login = await request("/pocket/login");
  if (login.status !== 200 || !/text\/html/i.test(login.headers.get("content-type") ?? "")) {
    stop("Pocket-specific existing-account sign-in is unavailable");
  }
  const loginHtml = await login.text();
  if (!loginHtml.includes("Sign in to Pocket Bullseye")) stop("the Pocket path serves the wrong membership login");

  return { verified: true, revision: expectedRevision.toLowerCase(), unsignedAccessDenied: true, pocketSignIn: true };
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  verifyPocketSitesDeployment(process.argv[2] ?? "")
    .then(result => process.stdout.write(JSON.stringify(result) + "\n"))
    .catch(error => {
      process.stderr.write((error instanceof Error ? error.message : "Pocket Sites cutover HOLD") + "\n");
      process.exitCode = 1;
    });
}
