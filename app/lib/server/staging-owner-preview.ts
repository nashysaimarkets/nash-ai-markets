const OWNER_ONLY_STAGING_HOST =
  "nash-ai-markets-bullseye-staging.nashysinners.chatgpt.site";

/**
 * The Sites access policy is the primary gate for this private owner preview.
 * This additional exact-host check prevents the bypass being active on Vercel,
 * production domains or local development if the branch is reused later.
 */
export function isOwnerOnlyStagingRequest(headers: Headers): boolean {
  const forwardedHost = headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = (forwardedHost || headers.get("host") || "")
    .toLowerCase()
    .replace(/:\d+$/, "");
  return host === OWNER_ONLY_STAGING_HOST;
}
