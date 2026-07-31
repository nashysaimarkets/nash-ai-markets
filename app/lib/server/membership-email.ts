/**
 * Membership emails are stored lowercased (`email = lower(trim(email))`).
 * Prefer `.eq` over `.ilike` so underscore characters in local parts are not
 * treated as single-character SQL wildcards.
 */
export function membershipEmailKey(email: string): string {
  return email.trim().toLowerCase();
}
