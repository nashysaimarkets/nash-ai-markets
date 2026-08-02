/**
 * Authenticate the dedicated audit account without printing credentials.
 * Product UI is passwordless OTP; automation uses password grant when the
 * dedicated test user has a password configured in Supabase, then completes
 * session via the existing /auth/callback hash handler.
 */

import { mkdirSync, existsSync } from "node:fs";
import { dirname } from "node:path";
import type { Browser, BrowserContext, Page } from "@playwright/test";
import { STORAGE_STATE_PATH, auditCredentialsPresent, resolveBaseUrl } from "./config.ts";
import { sanitizeText } from "./sanitize.ts";

export type AuthResult = {
  attempted: boolean;
  succeeded: boolean;
  method: string;
  detail: string;
  storageStatePath: string | null;
};

function supabasePublicConfigFromEnv(): { url: string; key: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    "";
  if (!url || !key) return null;
  return { url, key };
}

async function passwordGrant(): Promise<{ access_token: string; refresh_token: string } | null> {
  const creds = auditCredentialsPresent();
  if (!creds.email || !creds.password) return null;
  const config = supabasePublicConfigFromEnv();
  if (!config) return null;

  const email = process.env.AUDIT_USER_EMAIL!.trim();
  const password = process.env.AUDIT_USER_PASSWORD!.trim();
  const response = await fetch(`${config.url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      apikey: config.key,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    // Never include response body text that might echo email.
    throw new Error(`Password grant failed with HTTP ${response.status}`);
  }
  const json = (await response.json()) as { access_token?: string; refresh_token?: string };
  if (!json.access_token || !json.refresh_token) {
    throw new Error("Password grant response missing tokens");
  }
  return { access_token: json.access_token, refresh_token: json.refresh_token };
}

async function waitForAuthenticatedLanding(page: Page, baseUrl: string): Promise<boolean> {
  const deadline = Date.now() + 45_000;
  while (Date.now() < deadline) {
    const url = page.url();
    if (/\/(dashboard|brief|terminal|onboarding|welcome|profile|ideas|preferences)/i.test(url)) {
      return true;
    }
    if (/\/login/i.test(url) && !/auth\/callback/i.test(url)) {
      // Settled back on login — auth failed.
      return false;
    }
    await page.waitForTimeout(500);
  }
  // Soft success if cookies exist and we left the callback page.
  return !page.url().includes("/login") && page.url().startsWith(baseUrl);
}

export async function ensureAuthenticatedStorage(
  browser: Browser,
  options: { force?: boolean } = {},
): Promise<AuthResult> {
  mkdirSync(dirname(STORAGE_STATE_PATH), { recursive: true });

  if (!options.force && existsSync(STORAGE_STATE_PATH)) {
    return {
      attempted: true,
      succeeded: true,
      method: "reuse-storage-state",
      detail: "Reused existing local storage state (gitignored).",
      storageStatePath: STORAGE_STATE_PATH,
    };
  }

  const creds = auditCredentialsPresent();
  if (!creds.email || !creds.password) {
    return {
      attempted: false,
      succeeded: false,
      method: "none",
      detail:
        "AUDIT_USER_EMAIL and AUDIT_USER_PASSWORD are required for authenticated audits. Public routes can still run.",
      storageStatePath: null,
    };
  }

  if (!supabasePublicConfigFromEnv()) {
    return {
      attempted: true,
      succeeded: false,
      method: "password-grant",
      detail:
        "Supabase public URL/key missing locally. Set NEXT_PUBLIC_SUPABASE_URL and publishable/anon key for password grant.",
      storageStatePath: null,
    };
  }

  const baseUrl = resolveBaseUrl();
  let context: BrowserContext | null = null;
  try {
    const tokens = await passwordGrant();
    if (!tokens) {
      return {
        attempted: true,
        succeeded: false,
        method: "password-grant",
        detail: "Unable to obtain session tokens for the audit account.",
        storageStatePath: null,
      };
    }

    context = await browser.newContext();
    const page = await context.newPage();
    // Use hash fragments so tokens are not sent to the server in the request URL.
    const callback =
      `${baseUrl}/auth/callback#access_token=${encodeURIComponent(tokens.access_token)}` +
      `&refresh_token=${encodeURIComponent(tokens.refresh_token)}` +
      `&type=recovery`;
    await page.goto(callback, { waitUntil: "domcontentloaded", timeout: 60_000 });
    const ok = await waitForAuthenticatedLanding(page, baseUrl);
    if (!ok) {
      return {
        attempted: true,
        succeeded: false,
        method: "password-grant+callback",
        detail: sanitizeText(
          `Authentication did not reach a member destination. Final URL host/path only: ${new URL(page.url()).pathname}`,
        ),
        storageStatePath: null,
      };
    }

    await context.storageState({ path: STORAGE_STATE_PATH });
    return {
      attempted: true,
      succeeded: true,
      method: "password-grant+callback",
      detail: "Authenticated via dedicated audit account password grant and saved storage state locally.",
      storageStatePath: STORAGE_STATE_PATH,
    };
  } catch (error) {
    return {
      attempted: true,
      succeeded: false,
      method: "password-grant+callback",
      detail: sanitizeText(error instanceof Error ? error.message : "Authentication failed"),
      storageStatePath: null,
    };
  } finally {
    await context?.close().catch(() => undefined);
  }
}
