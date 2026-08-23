/**
 * One-time owner helper: open a browser, sign in manually, save Playwright storage.
 * Never prints tokens. Never emails magic links. Never bypasses auth.
 *
 * Usage:
 *   npm run staging:export-storage
 *   npm run staging:export-storage -- https://your-staging-origin/login
 *
 * Pause / continue:
 *   - If a TTY is available: press Enter after sign-in.
 *   - Otherwise create the sentinel file (empty): audit-output/.auth/READY_TO_SAVE
 */

import { createInterface } from "node:readline/promises";
import { existsSync, mkdirSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { stdin as input, stdout as output } from "node:process";
import { chromium } from "@playwright/test";
import { STORAGE_STATE_PATH } from "../audit/src/config.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_ORIGIN =
  "https://nash-ai-markets-bullseye-staging.nashysinners.chatgpt.site";
const READY_SENTINEL = resolve(ROOT, "audit-output/.auth/READY_TO_SAVE");

function resolveStartUrl(): string {
  const arg = process.argv.slice(2).find((a) => !a.startsWith("-"));
  const raw =
    arg?.trim() ||
    process.env.AUDIT_BASE_URL?.trim() ||
    process.env.STAGING_AUTH_BASE_URL?.trim() ||
    DEFAULT_ORIGIN;
  const base = raw.replace(/\/$/, "");
  return base.endsWith("/login") ? base : `${base}/login`;
}

async function waitForOwnerContinue(): Promise<void> {
  try {
    if (existsSync(READY_SENTINEL)) unlinkSync(READY_SENTINEL);
  } catch {
    // ignore
  }

  if (input.isTTY) {
    const rl = createInterface({ input, output });
    await rl.question("Press Enter after you are signed in… ");
    rl.close();
    return;
  }

  console.log("No TTY — after sign-in, create this empty file to continue:");
  console.log("  audit-output/.auth/READY_TO_SAVE");
  const deadline = Date.now() + 25 * 60_000;
  while (Date.now() < deadline) {
    if (existsSync(READY_SENTINEL)) {
      try {
        unlinkSync(READY_SENTINEL);
      } catch {
        // ignore
      }
      return;
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error("Timed out waiting for owner sign-in confirmation (25 minutes).");
}

async function main(): Promise<void> {
  const startUrl = resolveStartUrl();
  const outPath = resolve(ROOT, STORAGE_STATE_PATH);
  mkdirSync(dirname(outPath), { recursive: true });

  console.log("Export Playwright storage state (owner sign-in; no secrets logged).");
  console.log(`Start URL: ${startUrl}`);
  console.log(`Will write: ${STORAGE_STATE_PATH}`);
  console.log("");
  console.log("1. Complete magic-link / OTP sign-in in the opened browser.");
  console.log("2. Confirm you can open /dashboard as a member.");
  console.log("3. Return here and press Enter (or create READY_TO_SAVE) to save.");

  // Prefer installed Google Chrome when available — more stable on macOS than
  // a freshly downloaded Chromium build for long interactive magic-link flows.
  let browser;
  try {
    browser = await chromium.launch({ headless: false, channel: "chrome" });
    console.log("Browser: system Google Chrome");
  } catch {
    browser = await chromium.launch({ headless: false });
    console.log("Browser: Playwright Chromium");
  }
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(startUrl, { waitUntil: "domcontentloaded", timeout: 90_000 });

  await waitForOwnerContinue();

  await context.storageState({ path: outPath });
  // Presence-only marker with no cookie payload.
  writeFileSync(
    resolve(dirname(outPath), ".export-complete"),
    `${new Date().toISOString()}\n`,
    "utf8",
  );
  await browser.close();

  console.log(`Saved storage state → ${STORAGE_STATE_PATH}`);
  console.log("Next: npm run staging:auth-evidence");
  console.log("(Use the same origin via AUDIT_BASE_URL / STAGING_AUTH_BASE_URL.)");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
