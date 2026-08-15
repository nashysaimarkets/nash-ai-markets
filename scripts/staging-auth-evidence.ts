/**
 * Staging auth evidence: tablet/mobile member routes + sign-out return-path.
 * Requires gitignored Playwright storage state. Never emails magic links.
 *
 * Usage:
 *   AUDIT_BASE_URL=https://<same-origin-as-storage> npm run staging:auth-evidence
 *
 * Auth sources (first hit wins):
 *   audit-output/.auth/storage-state.json
 *   playwright/.auth/user.json
 */

import {
  existsSync,
  mkdirSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, type Browser, type Page } from "@playwright/test";
import { STORAGE_STATE_PATH as AUDIT_STORAGE_STATE } from "../audit/src/config.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PLAYWRIGHT_AUTH = join(ROOT, "playwright", ".auth", "user.json");
const OUT_DIR = join(ROOT, "audit-output");
const OUT_JSON = join(OUT_DIR, "staging-auth-evidence.json");
const DEFAULT_ORIGIN =
  "https://nash-ai-markets-bullseye-staging.nashysinners.chatgpt.site";

const VIEWPORTS = [
  { id: "desktop", label: "Desktop", width: 1440, height: 900 },
  { id: "tablet", label: "Tablet", width: 768, height: 1024 },
  { id: "mobile", label: "Mobile", width: 390, height: 844 },
] as const;

const MEMBER_PATHS = [
  "/dashboard",
  "/brief",
  "/terminal",
  "/ideas",
  "/journal",
  "/reviews",
  "/profile",
  "/preferences",
] as const;

type CheckStatus = "pass" | "fail" | "blocked";

type PathCheck = {
  path: string;
  viewport: string;
  status: CheckStatus;
  finalPath: string;
  redirectedToLogin: boolean;
  horizontalOverflow: boolean;
  detail: string;
};

type EvidenceReport = {
  generatedAt: string;
  baseUrl: string;
  storageState: string | null;
  verdict: "PASS" | "FAIL" | "INCOMPLETE";
  pathChecks: PathCheck[];
  signOut: {
    status: CheckStatus;
    afterSignOutPath: string;
    protectedAfterSignOut: CheckStatus;
    protectedFinalPath: string;
    historyBackStatus: CheckStatus;
    historyBackPath: string;
    historyForwardStatus: CheckStatus;
    historyForwardPath: string;
    detail: string;
  };
};

function resolveBaseUrl(): string {
  const raw =
    process.env.AUDIT_BASE_URL?.trim() ||
    process.env.STAGING_AUTH_BASE_URL?.trim() ||
    process.env.VISUAL_REVIEW_BASE_URL?.trim() ||
    DEFAULT_ORIGIN;
  return raw.replace(/\/$/, "");
}

function resolveStorageState(): string | null {
  const candidates = [
    resolve(ROOT, AUDIT_STORAGE_STATE),
    PLAYWRIGHT_AUTH,
  ];
  for (const path of candidates) {
    if (existsSync(path)) return path;
  }
  return null;
}

function pathOnly(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}

function isLoginPath(path: string): boolean {
  return path === "/login" || path.startsWith("/login?");
}

function isProtectedMemberPath(path: string): boolean {
  return MEMBER_PATHS.some((memberPath) => path === memberPath || path.startsWith(`${memberPath}/`));
}

async function hasHorizontalOverflow(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const root = document.documentElement;
    return root.scrollWidth > root.clientWidth + 1;
  });
}

async function openPath(page: Page, baseUrl: string, path: string): Promise<{
  finalPath: string;
  redirectedToLogin: boolean;
}> {
  const response = await page.goto(`${baseUrl}${path}`, {
    waitUntil: "domcontentloaded",
    timeout: 45_000,
  });
  // Allow client redirects / middleware settles.
  await page.waitForTimeout(800);
  const finalPath = pathOnly(page.url());
  const redirectedToLogin =
    isLoginPath(finalPath) ||
    Boolean(response?.request().redirectedFrom() && isLoginPath(finalPath));
  return { finalPath, redirectedToLogin: isLoginPath(finalPath) || redirectedToLogin };
}

async function run(): Promise<EvidenceReport> {
  const baseUrl = resolveBaseUrl();
  const storageState = resolveStorageState();
  const pathChecks: PathCheck[] = [];

  if (!storageState) {
    return {
      generatedAt: new Date().toISOString(),
      baseUrl,
      storageState: null,
      verdict: "INCOMPLETE",
      pathChecks: [],
      signOut: {
        status: "blocked",
        afterSignOutPath: "",
        protectedAfterSignOut: "blocked",
        protectedFinalPath: "",
        historyBackStatus: "blocked",
        historyBackPath: "",
        historyForwardStatus: "blocked",
        historyForwardPath: "",
        detail:
          "Missing storage state. Run: npm run staging:export-storage (same origin), then re-run.",
      },
    };
  }

  let browser: Browser | null = null;
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ storageState });
    const page = await context.newPage();

    for (const vp of VIEWPORTS) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      for (const path of MEMBER_PATHS) {
        try {
          const { finalPath, redirectedToLogin } = await openPath(page, baseUrl, path);
          const horizontalOverflow = await hasHorizontalOverflow(page);
          const ok = !redirectedToLogin && !isLoginPath(finalPath) && !horizontalOverflow;
          pathChecks.push({
            path,
            viewport: vp.id,
            status: ok ? "pass" : "fail",
            finalPath,
            redirectedToLogin,
            horizontalOverflow,
            detail: ok
              ? "Member route stayed authenticated with no horizontal overflow"
              : redirectedToLogin || isLoginPath(finalPath)
                ? `Expected member session; landed on ${finalPath}`
                : `Horizontal overflow detected at ${vp.width}px`,
          });
        } catch (error) {
          pathChecks.push({
            path,
            viewport: vp.id,
            status: "fail",
            finalPath: "",
            redirectedToLogin: false,
            horizontalOverflow: false,
            detail: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }

    // Sign-out + return-path (desktop width is fine; session is cookie-bound).
    await page.setViewportSize({ width: 1280, height: 800 });
    let afterSignOutPath = "";
    let protectedFinalPath = "";
    let historyBackPath = "";
    let historyForwardPath = "";
    let signOutStatus: CheckStatus = "fail";
    let protectedStatus: CheckStatus = "fail";
    let historyBackStatus: CheckStatus = "fail";
    let historyForwardStatus: CheckStatus = "fail";
    let signOutDetail = "";

    try {
      // Seed history with a protected page before signing out so browser history
      // cannot accidentally restore authenticated content from bfcache/cache.
      await openPath(page, baseUrl, "/dashboard");
      await page.goto(`${baseUrl}/auth/signout`, {
        waitUntil: "domcontentloaded",
        timeout: 45_000,
      });
      await page.waitForTimeout(800);
      afterSignOutPath = pathOnly(page.url());
      const signedOutLandingOk =
        afterSignOutPath === "/" ||
        afterSignOutPath === "/login" ||
        isLoginPath(afterSignOutPath);
      signOutStatus = signedOutLandingOk ? "pass" : "fail";

      await page.goBack({ waitUntil: "domcontentloaded", timeout: 45_000 }).catch(() => null);
      await page.waitForTimeout(800);
      historyBackPath = pathOnly(page.url());
      historyBackStatus = isProtectedMemberPath(historyBackPath) && !isLoginPath(historyBackPath)
        ? "fail"
        : "pass";

      await page.goForward({ waitUntil: "domcontentloaded", timeout: 45_000 }).catch(() => null);
      await page.waitForTimeout(800);
      historyForwardPath = pathOnly(page.url());
      historyForwardStatus = isProtectedMemberPath(historyForwardPath) && !isLoginPath(historyForwardPath)
        ? "fail"
        : "pass";

      const protectedVisit = await openPath(page, baseUrl, "/dashboard");
      protectedFinalPath = protectedVisit.finalPath;
      protectedStatus = protectedVisit.redirectedToLogin || isLoginPath(protectedFinalPath)
        ? "pass"
        : "fail";
      signOutDetail =
        signOutStatus === "pass" &&
        protectedStatus === "pass" &&
        historyBackStatus === "pass" &&
        historyForwardStatus === "pass"
          ? "Sign-out ended session; history navigation did not restore member access; /dashboard returned to login"
          : `After sign-out path=${afterSignOutPath}; back=${historyBackPath}; forward=${historyForwardPath}; /dashboard → ${protectedFinalPath}`;
    } catch (error) {
      signOutStatus = "fail";
      protectedStatus = "fail";
      historyBackStatus = "fail";
      historyForwardStatus = "fail";
      signOutDetail = error instanceof Error ? error.message : String(error);
    }

    await context.close();

    const pathsOk = pathChecks.every((c) => c.status === "pass");
    const signOutOk =
      signOutStatus === "pass" &&
      protectedStatus === "pass" &&
      historyBackStatus === "pass" &&
      historyForwardStatus === "pass";
    const verdict: EvidenceReport["verdict"] =
      pathsOk && signOutOk ? "PASS" : "FAIL";

    return {
      generatedAt: new Date().toISOString(),
      baseUrl,
      storageState: storageState.replace(ROOT + "/", ""),
      verdict,
      pathChecks,
      signOut: {
        status: signOutStatus,
        afterSignOutPath,
        protectedAfterSignOut: protectedStatus,
        protectedFinalPath,
        historyBackStatus,
        historyBackPath,
        historyForwardStatus,
        historyForwardPath,
        detail: signOutDetail,
      },
    };
  } finally {
    await browser?.close();
  }
}

function printSummary(report: EvidenceReport): void {
  console.log(`Staging auth evidence: ${report.verdict}`);
  console.log(`Base URL: ${report.baseUrl}`);
  console.log(`Storage: ${report.storageState ?? "(missing)"}`);
  const passed = report.pathChecks.filter((c) => c.status === "pass").length;
  const failed = report.pathChecks.filter((c) => c.status === "fail").length;
  console.log(`Member routes: ${passed} pass / ${failed} fail / ${report.pathChecks.length} total`);
  console.log(
    `Sign-out: ${report.signOut.status}; back=${report.signOut.historyBackStatus}; forward=${report.signOut.historyForwardStatus}; protected-after=${report.signOut.protectedAfterSignOut}`,
  );
  console.log(`Detail: ${report.signOut.detail}`);
  if (report.verdict !== "PASS") {
    for (const c of report.pathChecks.filter((x) => x.status !== "pass")) {
      console.log(`  FAIL ${c.viewport} ${c.path} → ${c.finalPath || "?"} (${c.detail})`);
    }
  }
}

async function main(): Promise<void> {
  const report = await run();
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(OUT_JSON, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  printSummary(report);
  console.log(`Wrote ${OUT_JSON.replace(`${ROOT}/`, "")}`);
  if (report.verdict !== "PASS") process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
