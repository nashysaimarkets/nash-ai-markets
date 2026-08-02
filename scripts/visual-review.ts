/**
 * Automated Visual Review Pack — inspection tooling only.
 *
 * Captures primary customer pages at desktop/laptop/tablet/mobile sizes and
 * writes a single HTML report under visual-review/latest/.
 *
 * Fail-closed: a capture is never PASS when required assets, shell, chart,
 * route integrity, or console health fail. Skipped auth pages make the run
 * INCOMPLETE — never a false PASS.
 *
 * Auth (in order, never magic-link, never bypass):
 *   1. Reuse audit-output/.auth/storage-state.json if present
 *   2. Reuse playwright/.auth/user.json if present
 *   3. Existing audit password-grant only when AUDIT_USER_* already configured
 *   4. Otherwise stop as INCOMPLETE with one-time owner instructions
 *
 * Usage:
 *   npm run visual-review
 *   VISUAL_REVIEW_BASE_URL=http://127.0.0.1:3000 npm run visual-review
 *   VISUAL_REVIEW_PORT=3010 npm run visual-review   # start on alternate port if needed
 *   npm run visual-review -- --compare
 *
 * Never prints credentials or session tokens into the report.
 */

import { spawn, execFileSync, type ChildProcess } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, type Browser, type BrowserContext, type Page, type Response } from "@playwright/test";
import { ensureAuthenticatedStorage, type AuthResult } from "../audit/src/auth.ts";
import { STORAGE_STATE_PATH as AUDIT_STORAGE_STATE } from "../audit/src/config.ts";
import { sanitizeText, sanitizeUrl } from "../audit/src/sanitize.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_ROOT = join(ROOT, "visual-review");
const LATEST_DIR = join(OUT_ROOT, "latest");
const RUNS_DIR = join(OUT_ROOT, "runs");
const PLAYWRIGHT_AUTH = join(ROOT, "playwright", ".auth", "user.json");

/**
 * Narrow console allow-list: messages that do not indicate a broken product UI.
 * Do not broaden this to silence load failures.
 */
const CONSOLE_ALLOWLIST: RegExp[] = [
  /^Download the React DevTools/i,
  /^\[HMR\]/i,
  /^\[vite\]/i,
];

type ViewportSpec = {
  id: string;
  label: string;
  width: number;
  height: number;
  captureFold: boolean;
};

type PageSpec = {
  id: string;
  path: string;
  label: string;
  auth: boolean;
  chart?: boolean;
};

type AssetFailure = {
  url: string;
  kind: "script" | "stylesheet" | "other";
  status: number | null;
  error: string | null;
};

type CaptureStatus = "pass" | "fail" | "skipped";

type CaptureResult = {
  pageId: string;
  label: string;
  path: string;
  viewport: string;
  viewportLabel: string;
  width: number;
  height: number;
  status: CaptureStatus;
  ok: boolean;
  redirectedToLogin: boolean;
  finalPath: string;
  shellPresent: boolean;
  errorBoundary: boolean;
  chartOk: { ok: boolean; selector: string | null; reason?: string } | null;
  overflow: boolean | null;
  offenders: string[];
  consoleErrors: string[];
  consoleWarnings: string[];
  assetFailures: AssetFailure[];
  foldEqualsFull: boolean;
  files: { fold?: string; full?: string };
  error: string | null;
  reasons: string[];
};

type RunVerdict = "PASS" | "FAIL" | "INCOMPLETE — AUTHENTICATION REQUIRED";

type Manifest = {
  ok: boolean;
  verdict: RunVerdict;
  tool: string;
  capturedAt: string;
  baseUrl: string;
  environment: string;
  git: { branch: string; commit: string };
  auth: {
    method: string;
    succeeded: boolean;
    detail: string;
    storageState: string | null;
  };
  server: {
    startedByRunner: boolean;
    ready: boolean;
    readinessDetail: string;
    exitedDuringCapture: boolean;
  };
  viewports: ViewportSpec[];
  pages: PageSpec[];
  captures: CaptureResult[];
  summary: {
    requested: number;
    captured: number;
    passed: number;
    failed: number;
    skipped: number;
    overflows: number;
    consoleErrorPages: number;
    assetFailurePages: number;
  };
  compareAgainst: string | null;
  compare: Array<{ label: string; current: string | null; previous: string | null }>;
};

const VIEWPORTS: ViewportSpec[] = [
  { id: "desktop", label: "Desktop large", width: 1440, height: 1000, captureFold: true },
  { id: "laptop", label: "Laptop", width: 1280, height: 900, captureFold: true },
  { id: "tablet", label: "Tablet", width: 768, height: 1024, captureFold: true },
  { id: "mobile", label: "Mobile", width: 390, height: 844, captureFold: true },
];

const PAGES: PageSpec[] = [
  { id: "dashboard", path: "/dashboard", label: "Dashboard", auth: true, chart: true },
  { id: "brief", path: "/brief", label: "Morning Brief", auth: true },
  { id: "terminal", path: "/terminal", label: "Trading Desk", auth: true, chart: true },
  { id: "ideas", path: "/ideas", label: "Ideas", auth: true },
  { id: "profile", path: "/profile", label: "Profile", auth: true },
  { id: "preferences", path: "/preferences", label: "Preferences", auth: true },
  { id: "reviews", path: "/reviews", label: "Market Reviews", auth: true },
  { id: "journal", path: "/journal", label: "Risk & Journal", auth: true },
  { id: "login", path: "/login", label: "Login", auth: false },
  { id: "pricing", path: "/pricing", label: "Membership / Pricing", auth: false },
];

const AUTH_SHELL_SELECTORS = [
  ".marketCommandCentre",
  ".memberDashboard",
  ".morningMarketBrief",
  ".deskShell",
  ".tradingDesk",
  "[data-page]",
  "main .memberShell",
  "main nav",
  "main",
];

const PUBLIC_SHELL_SELECTORS = ["main", "form", "nav", "[data-page]", ".loginShell", "body"];

const ERROR_BOUNDARY_SELECTORS = [
  "[data-error-boundary]",
  ".errorBoundary",
  "text=Something went wrong",
  "text=Application error",
];

function resolvePreferredBaseUrl(): string {
  const raw =
    process.env.VISUAL_REVIEW_BASE_URL?.trim() ||
    process.env.AUDIT_BASE_URL?.trim() ||
    process.env.PLAYWRIGHT_BASE_URL?.trim() ||
    "http://127.0.0.1:3000";
  return raw.replace(/\/$/, "");
}

function argFlag(name: string): boolean {
  return process.argv.includes(name);
}

function stamp(): string {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function runGit(args: string[]): string {
  try {
    return execFileSync("git", args, { cwd: ROOT, encoding: "utf8" }).trim();
  } catch {
    return "";
  }
}

function ensureDirs(): void {
  mkdirSync(join(LATEST_DIR, "screenshots"), { recursive: true });
  mkdirSync(RUNS_DIR, { recursive: true });
}

function redactAssetUrl(raw: string, baseUrl: string): string {
  try {
    const url = new URL(raw, baseUrl);
    return sanitizeUrl(`${url.origin}${url.pathname}`);
  } catch {
    return sanitizeText(raw).replace(/[?#].*$/, "");
  }
}

function isConsoleAllowed(message: string): boolean {
  return CONSOLE_ALLOWLIST.some((re) => re.test(message));
}

function authInstructions(): string[] {
  return [
    "Member pages need a local Playwright storage state. One-time owner setup (no magic-link is sent by this tool):",
    "",
    "1. Sign in once in a browser to the local app as a dedicated test member (passwordless OTP is fine).",
    "2. Or, if a dedicated audit password is already configured in Supabase Auth for the test user,",
    "   set AUDIT_USER_EMAIL and AUDIT_USER_PASSWORD in `.env` (never commit them), then run:",
    "     npm run audit:setup",
    "3. Confirm a gitignored state file exists at one of:",
    "     audit-output/.auth/storage-state.json",
    "     playwright/.auth/user.json",
    "4. Ensure the local production server is healthy (fresh `npm run build && npm start`).",
    "5. Re-run: npm run visual-review",
    "",
    "This tool never bypasses authentication, never hard-codes credentials, and never emails magic links.",
  ];
}

async function fetchText(url: string, timeoutMs = 8_000): Promise<{ ok: boolean; status: number; body: string; error?: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { redirect: "manual", signal: controller.signal });
    const body = await res.text();
    return { ok: res.status > 0 && res.status < 500, status: res.status, body };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      body: "",
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    clearTimeout(timer);
  }
}

async function probeAppReadiness(baseUrl: string): Promise<{ ready: boolean; detail: string; primaryJs: string | null; primaryCss: string | null }> {
  const login = await fetchText(`${baseUrl}/login`);
  if (!login.ok || login.status >= 500) {
    return {
      ready: false,
      detail: `HTML readiness failed for /login (status ${login.status}${login.error ? `: ${login.error}` : ""})`,
      primaryJs: null,
      primaryCss: null,
    };
  }

  const jsMatch = login.body.match(/\/assets\/index-[A-Za-z0-9_-]+\.js/);
  const cssMatch = login.body.match(/\/assets\/index-[A-Za-z0-9_-]+\.css/);
  const primaryJs = jsMatch?.[0] ?? null;
  const primaryCss = cssMatch?.[0] ?? null;
  if (!primaryJs || !primaryCss) {
    return {
      ready: false,
      detail: "Login HTML did not reference expected /assets/index-*.js and /assets/index-*.css",
      primaryJs,
      primaryCss,
    };
  }

  const js = await fetchText(`${baseUrl}${primaryJs}`);
  const css = await fetchText(`${baseUrl}${primaryCss}`);
  const jsBytes = Buffer.byteLength(js.body, "utf8");
  const cssBytes = Buffer.byteLength(css.body, "utf8");

  if (!js.ok || js.status !== 200 || jsBytes < 500) {
    return {
      ready: false,
      detail: `Primary JS asset failed (${primaryJs}: status ${js.status}, bytes ${jsBytes}${js.error ? `, ${js.error}` : ""}). HTML alone is not readiness evidence.`,
      primaryJs,
      primaryCss,
    };
  }
  if (!css.ok || css.status !== 200 || cssBytes < 200) {
    return {
      ready: false,
      detail: `Primary CSS asset failed (${primaryCss}: status ${css.status}, bytes ${cssBytes}${css.error ? `, ${css.error}` : ""}).`,
      primaryJs,
      primaryCss,
    };
  }

  return {
    ready: true,
    detail: `Ready: /login + ${primaryJs} (${jsBytes}b) + ${primaryCss} (${cssBytes}b)`,
    primaryJs,
    primaryCss,
  };
}

function withPort(baseUrl: string, port: number): string {
  const url = new URL(baseUrl);
  url.port = String(port);
  return url.toString().replace(/\/$/, "");
}

async function waitForReadiness(baseUrl: string, timeoutMs: number): Promise<{ ready: boolean; detail: string }> {
  const deadline = Date.now() + timeoutMs;
  let last = "not probed";
  while (Date.now() < deadline) {
    const probe = await probeAppReadiness(baseUrl);
    last = probe.detail;
    if (probe.ready) return { ready: true, detail: probe.detail };
    await new Promise((r) => setTimeout(r, 1000));
  }
  return { ready: false, detail: last };
}

async function maybeStartApp(preferredBaseUrl: string): Promise<{
  baseUrl: string;
  started: boolean;
  ready: boolean;
  detail: string;
  child?: ChildProcess;
}> {
  const preferred = await probeAppReadiness(preferredBaseUrl);
  if (preferred.ready) {
    return { baseUrl: preferredBaseUrl, started: false, ready: true, detail: preferred.detail };
  }

  if (process.env.VISUAL_REVIEW_NO_START === "1") {
    return {
      baseUrl: preferredBaseUrl,
      started: false,
      ready: false,
      detail: `${preferred.detail} (VISUAL_REVIEW_NO_START=1; not starting a server)`,
    };
  }

  // If preferred answers HTML but assets are broken, do not kill that process —
  // start a runner-owned server on an alternate port instead.
  const startPort = Number(process.env.VISUAL_REVIEW_PORT?.trim() || "3010");
  const baseUrl = withPort(preferredBaseUrl, startPort);
  console.log(`[visual-review] preferred server not asset-ready: ${preferred.detail}`);
  console.log(`[visual-review] starting npm run start on PORT=${startPort} …`);

  const child = spawn("npm", ["run", "start"], {
    cwd: ROOT,
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      PORT: String(startPort),
      WRANGLER_LOG_PATH: ".wrangler/wrangler-visual-review.log",
    },
  });
  let log = "";
  child.stdout?.on("data", (d: Buffer) => {
    log += d.toString();
  });
  child.stderr?.on("data", (d: Buffer) => {
    log += d.toString();
  });

  const waited = await waitForReadiness(baseUrl, 120_000);
  if (!waited.ready) {
    child.kill("SIGTERM");
    writeFileSync(join(LATEST_DIR, "server-start.log"), log.slice(-12_000), "utf8");
    return {
      baseUrl,
      started: true,
      ready: false,
      detail: `${waited.detail}. Also saw preferred failure: ${preferred.detail}`,
      child: undefined,
    };
  }
  return { baseUrl, started: true, ready: true, detail: waited.detail, child };
}

function resolveStorageStatePath(): string | null {
  const auditPath = resolve(ROOT, AUDIT_STORAGE_STATE);
  if (existsSync(auditPath)) return auditPath;
  if (existsSync(PLAYWRIGHT_AUTH)) return PLAYWRIGHT_AUTH;
  return null;
}

async function prepareAuth(browser: Browser, baseUrl: string): Promise<AuthResult> {
  const existing = resolveStorageStatePath();
  if (existing) {
    return {
      attempted: true,
      succeeded: true,
      method: "reuse-storage-state",
      detail: `Reused gitignored storage state at ${existing.replace(`${ROOT}/`, "")}`,
      storageStatePath: existing,
    };
  }

  const hasPassword = Boolean(process.env.AUDIT_USER_EMAIL?.trim() && process.env.AUDIT_USER_PASSWORD?.trim());
  if (!hasPassword) {
    return {
      attempted: false,
      succeeded: false,
      method: "none",
      detail:
        "No storage state and no AUDIT_USER_* password pair. Stopping without sending any email/magic link.",
      storageStatePath: null,
    };
  }

  // Point existing audit auth helper at the same local base URL we are capturing.
  process.env.AUDIT_BASE_URL = baseUrl;
  process.env.PLAYWRIGHT_BASE_URL = baseUrl;
  return ensureAuthenticatedStorage(browser, { force: false });
}

async function waitForChart(page: Page): Promise<{ ok: boolean; selector: string | null; reason?: string }> {
  const selectors = [
    ".dashboardChartCanvas",
    ".dashboardChartFrame",
    ".companionHeroChart",
    "[data-chart]",
    "canvas",
    "[class*='Chart'] canvas",
  ];
  const deadline = Date.now() + 12_000;
  while (Date.now() < deadline) {
    for (const sel of selectors) {
      const el = await page.$(sel);
      if (!el) continue;
      const box = await el.boundingBox();
      if (!box || box.width <= 40 || box.height <= 40) continue;
      const hasInk = await page.evaluate((selector) => {
        const node = document.querySelector(selector);
        if (!node) return false;
        if (node.tagName === "CANVAS") {
          const canvas = node as HTMLCanvasElement;
          if (canvas.width < 8 || canvas.height < 8) return false;
          const ctx = canvas.getContext?.("2d");
          if (!ctx) return true;
          try {
            const sample = ctx.getImageData(0, 0, Math.min(16, canvas.width), Math.min(16, canvas.height));
            return sample.data.some((v, i) => i % 4 !== 3 && v > 0);
          } catch {
            return true;
          }
        }
        if (node instanceof SVGElement) {
          return node.querySelectorAll("path,line,rect,circle").length > 0;
        }
        return node.querySelector("canvas,svg") != null;
      }, sel);
      if (hasInk) return { ok: true, selector: sel };
    }
    await page.waitForTimeout(400);
  }
  return { ok: false, selector: null, reason: "Chart container missing, zero-size, or without rendered content" };
}

async function settlePage(page: Page, pageSpec: PageSpec): Promise<{
  shellPresent: boolean;
  errorBoundary: boolean;
  chartOk: CaptureResult["chartOk"];
}> {
  await page.waitForLoadState("domcontentloaded", { timeout: 45_000 }).catch(() => undefined);
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => undefined);

  const selectors = pageSpec.auth ? AUTH_SHELL_SELECTORS : PUBLIC_SHELL_SELECTORS;
  let shellPresent = false;
  for (const sel of selectors) {
    if (await page.$(sel)) {
      shellPresent = true;
      break;
    }
  }

  let errorBoundary = false;
  for (const sel of ERROR_BOUNDARY_SELECTORS) {
    if (await page.$(sel)) {
      errorBoundary = true;
      break;
    }
  }

  await page.evaluate(() => document.fonts?.ready?.catch?.(() => undefined));
  await page.waitForTimeout(400);

  let chartOk: CaptureResult["chartOk"] = null;
  if (pageSpec.chart) {
    chartOk = await waitForChart(page);
  }
  return { shellPresent, errorBoundary, chartOk };
}

async function detectOverflow(page: Page): Promise<{ overflow: boolean; offenders: string[] }> {
  return page.evaluate(() => {
    const limit = document.documentElement.clientWidth;
    const docOver = document.documentElement.scrollWidth > limit + 1;
    if (!docOver) return { overflow: false, offenders: [] as string[] };
    const offenders = [...document.querySelectorAll("*")]
      .filter((el) => {
        const r = el.getBoundingClientRect();
        return r.right > limit + 2 && r.width > 24;
      })
      .slice(0, 6)
      .map((el) => {
        const cls = typeof el.className === "string" ? el.className.split(/\s+/).slice(0, 2).join(".") : "";
        return `${el.tagName.toLowerCase()}${cls ? `.${cls}` : ""}`;
      });
    return { overflow: true, offenders };
  });
}

function collectPageSignals(page: Page, baseUrl: string) {
  const errors: string[] = [];
  const warnings: string[] = [];
  const assetFailures: AssetFailure[] = [];

  page.on("pageerror", (err) => {
    const msg = sanitizeText(err.message).slice(0, 240);
    if (!isConsoleAllowed(msg)) errors.push(msg);
  });
  page.on("console", (msg) => {
    const text = sanitizeText(msg.text()).slice(0, 240);
    if (isConsoleAllowed(text)) return;
    if (msg.type() === "error") errors.push(text);
    if (msg.type() === "warning") warnings.push(text);
  });
  page.on("requestfailed", (req) => {
    const type = req.resourceType();
    if (type !== "script" && type !== "stylesheet") return;
    const failure = req.failure()?.errorText ?? "requestfailed";
    assetFailures.push({
      url: redactAssetUrl(req.url(), baseUrl),
      kind: type === "stylesheet" ? "stylesheet" : "script",
      status: null,
      error: sanitizeText(failure).slice(0, 160),
    });
  });
  page.on("response", (res: Response) => {
    const req = res.request();
    const type = req.resourceType();
    if (type !== "script" && type !== "stylesheet") return;
    if (res.status() >= 400 || res.status() === 0) {
      assetFailures.push({
        url: redactAssetUrl(res.url(), baseUrl),
        kind: type === "stylesheet" ? "stylesheet" : "script",
        status: res.status(),
        error: `HTTP ${res.status()}`,
      });
    }
  });

  return { errors, warnings, assetFailures };
}

function skippedCapture(pageSpec: PageSpec, viewport: ViewportSpec, reason: string): CaptureResult {
  return {
    pageId: pageSpec.id,
    label: pageSpec.label,
    path: pageSpec.path,
    viewport: viewport.id,
    viewportLabel: viewport.label,
    width: viewport.width,
    height: viewport.height,
    status: "skipped",
    ok: false,
    redirectedToLogin: false,
    finalPath: "",
    shellPresent: false,
    errorBoundary: false,
    chartOk: null,
    overflow: null,
    offenders: [],
    consoleErrors: [],
    consoleWarnings: [],
    assetFailures: [],
    foldEqualsFull: false,
    files: {},
    error: reason,
    reasons: [reason],
  };
}

async function capturePage(
  context: BrowserContext,
  baseUrl: string,
  pageSpec: PageSpec,
  viewport: ViewportSpec,
  serverAlive: () => boolean,
): Promise<CaptureResult> {
  const page = await context.newPage();
  const signals = collectPageSignals(page, baseUrl);
  const result: CaptureResult = {
    pageId: pageSpec.id,
    label: pageSpec.label,
    path: pageSpec.path,
    viewport: viewport.id,
    viewportLabel: viewport.label,
    width: viewport.width,
    height: viewport.height,
    status: "fail",
    ok: false,
    redirectedToLogin: false,
    finalPath: "",
    shellPresent: false,
    errorBoundary: false,
    chartOk: null,
    overflow: null,
    offenders: [],
    consoleErrors: [],
    consoleWarnings: [],
    assetFailures: [],
    foldEqualsFull: false,
    files: {},
    error: null,
    reasons: [],
  };

  try {
    if (!serverAlive()) {
      result.reasons.push("Server exited during capture");
      result.error = "Server exited during capture";
      return result;
    }

    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.emulateMedia({ reducedMotion: "reduce" });

    const response = await page.goto(`${baseUrl}${pageSpec.path}`, {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
    const settled = await settlePage(page, pageSpec);
    result.shellPresent = settled.shellPresent;
    result.errorBoundary = settled.errorBoundary;
    result.chartOk = settled.chartOk;
    result.finalPath = sanitizeUrl(page.url()).replace(baseUrl, "") || "/";
    result.redirectedToLogin = /\/login/i.test(page.url()) && pageSpec.auth;

    const overflow = await detectOverflow(page);
    result.overflow = overflow.overflow;
    result.offenders = overflow.offenders;

    const shotDir = join(LATEST_DIR, "screenshots");
    const foldName = `${pageSpec.id}-${viewport.id}-fold.png`;
    const fullName = `${pageSpec.id}-${viewport.id}-full.png`;
    const foldPath = join(shotDir, foldName);
    const fullPath = join(shotDir, fullName);

    if (viewport.captureFold) {
      await page.screenshot({ path: foldPath, fullPage: false });
      result.files.fold = `screenshots/${foldName}`;
    }
    await page.screenshot({ path: fullPath, fullPage: true });
    result.files.full = `screenshots/${fullName}`;

    if (result.files.fold && result.files.full) {
      try {
        const a = readFileSync(foldPath);
        const b = readFileSync(fullPath);
        result.foldEqualsFull = a.equals(b);
      } catch {
        result.foldEqualsFull = false;
      }
    }

    const reasons: string[] = [];
    if (!response || response.status() >= 500) reasons.push(`HTTP ${response?.status() ?? "unknown"}`);
    if (result.redirectedToLogin) reasons.push("Protected route redirected to Login");
    if (!result.shellPresent) reasons.push("Expected product shell missing");
    if (result.errorBoundary) reasons.push("Visible error boundary present");
    if (pageSpec.chart && result.chartOk && !result.chartOk.ok) {
      reasons.push(result.chartOk.reason || "Required chart missing or empty");
    }
    if (!serverAlive()) reasons.push("Server exited during capture");

    // De-dupe asset failures by URL+status
    const assetKey = new Set<string>();
    result.assetFailures = signals.assetFailures.filter((f) => {
      const key = `${f.kind}:${f.url}:${f.status}:${f.error}`;
      if (assetKey.has(key)) return false;
      assetKey.add(key);
      return true;
    });
    if (result.assetFailures.length) {
      reasons.push(
        `${result.assetFailures.length} script/stylesheet asset failure(s) (e.g. ${result.assetFailures[0].url})`,
      );
    }

    result.consoleErrors = [...new Set(signals.errors)].slice(0, 12);
    result.consoleWarnings = [...new Set(signals.warnings)].slice(0, 8);
    if (result.consoleErrors.length) {
      reasons.push(`${result.consoleErrors.length} console error(s)`);
    }

    // Overflow is reported but does not alone fail a capture (layout finding).
    result.reasons = reasons;
    result.ok = reasons.length === 0;
    result.status = result.ok ? "pass" : "fail";
    result.error = reasons[0] ?? null;
  } catch (error) {
    result.ok = false;
    result.status = "fail";
    result.error = sanitizeText(error instanceof Error ? error.message : String(error));
    result.reasons = [result.error];
    result.consoleErrors = [...new Set(signals.errors)].slice(0, 12);
    result.consoleWarnings = [...new Set(signals.warnings)].slice(0, 8);
    result.assetFailures = signals.assetFailures.slice(0, 20);
  } finally {
    await page.close().catch(() => undefined);
  }

  return result;
}

function previousRunDir(): string | null {
  if (!existsSync(RUNS_DIR)) return null;
  const runs = readdirSync(RUNS_DIR)
    .filter((name) => existsSync(join(RUNS_DIR, name, "manifest.json")))
    .sort()
    .reverse();
  return runs[0] ? join(RUNS_DIR, runs[0]) : null;
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function buildCompare(
  manifest: Manifest,
  previousDir: string | null,
): { compareAgainst: string | null; compare: Manifest["compare"] } {
  if (!previousDir) return { compareAgainst: null, compare: [] };
  const prevManifestPath = join(previousDir, "manifest.json");
  if (!existsSync(prevManifestPath)) return { compareAgainst: null, compare: [] };
  const prev = JSON.parse(readFileSync(prevManifestPath, "utf8")) as Manifest;
  const compareAgainst = previousDir.split("/").pop() ?? null;
  if (!compareAgainst) return { compareAgainst: null, compare: [] };
  const compare: Manifest["compare"] = [];
  for (const page of PAGES) {
    const cur = manifest.captures.find((c) => c.pageId === page.id && c.viewport === "desktop" && c.files.fold);
    const old = prev.captures?.find((c) => c.pageId === page.id && c.viewport === "desktop" && c.files.fold);
    if (!cur && !old) continue;
    const prevRel = old?.files?.fold ? join("..", "runs", compareAgainst, old.files.fold) : null;
    compare.push({
      label: `${page.label} · desktop fold`,
      current: cur?.files?.fold ?? null,
      previous: prevRel,
    });
  }
  return { compareAgainst, compare };
}

function renderHtml(manifest: Manifest): string {
  const verdictClass =
    manifest.verdict === "PASS" ? "ok" : manifest.verdict.startsWith("INCOMPLETE") ? "incomplete" : "fail";

  const pageSections = PAGES.map((page) => {
    const rows = VIEWPORTS.map((vp) => {
      const c =
        manifest.captures.find((x) => x.pageId === page.id && x.viewport === vp.id) ??
        skippedCapture(page, vp, "Missing capture row");
      const status = c.status;
      const meta = [
        c.finalPath ? `final ${escapeHtml(c.finalPath)}` : "",
        c.overflow ? "horizontal overflow" : "",
        c.chartOk && !c.chartOk.ok ? "chart missing" : "",
        c.assetFailures.length ? `${c.assetFailures.length} asset failure(s)` : "",
        c.consoleErrors.length ? `${c.consoleErrors.length} console error(s)` : "",
        c.foldEqualsFull ? "fold ≡ full (short page)" : "",
        c.error ? escapeHtml(c.error) : "",
      ]
        .filter(Boolean)
        .join(" · ");

      const assetList = c.assetFailures.length
        ? `<ul class="fail-list">${c.assetFailures
            .slice(0, 6)
            .map((f) => `<li>${escapeHtml(f.kind)} ${escapeHtml(f.url)} — ${escapeHtml(f.error || `HTTP ${f.status}`)}</li>`)
            .join("")}</ul>`
        : "";
      const consoleList = c.consoleErrors.length
        ? `<ul class="fail-list">${c.consoleErrors.map((e) => `<li>${escapeHtml(e)}</li>`).join("")}</ul>`
        : "";

      let shots = "";
      if (c.files.fold || c.files.full) {
        if (c.foldEqualsFull && c.files.full) {
          shots = `<figure><figcaption>Page (fold ≡ full)</figcaption><a href="${c.files.full}" target="_blank" rel="noopener"><img src="${c.files.full}" alt="${escapeHtml(c.label)} ${vp.id}" loading="lazy"></a></figure>`;
        } else {
          shots = [
            c.files.fold
              ? `<figure><figcaption>Above the fold</figcaption><a href="${c.files.fold}" target="_blank" rel="noopener"><img src="${c.files.fold}" alt="${escapeHtml(c.label)} ${vp.id} fold" loading="lazy"></a></figure>`
              : "",
            c.files.full
              ? `<figure><figcaption>Full page</figcaption><a href="${c.files.full}" target="_blank" rel="noopener"><img src="${c.files.full}" alt="${escapeHtml(c.label)} ${vp.id} full" loading="lazy"></a></figure>`
              : "",
          ].join("");
        }
      } else {
        shots = `<p class="empty">No screenshot — ${escapeHtml(c.error || status)}</p>`;
      }

      return `<article class="card is-${status}" id="${page.id}-${vp.id}">
  <header>
    <h3>${escapeHtml(vp.label)} <small>${vp.width}×${vp.height}</small></h3>
    <span class="badge">${status}</span>
  </header>
  <p class="meta">${escapeHtml(page.path)} · ${meta || status}</p>
  ${assetList}
  ${consoleList}
  <div class="shots">${shots}</div>
</article>`;
    }).join("\n");

    const pageStatuses = VIEWPORTS.map((vp) => manifest.captures.find((c) => c.pageId === page.id && c.viewport === vp.id)?.status || "skipped");
    const pageBadge = pageStatuses.every((s) => s === "pass")
      ? "pass"
      : pageStatuses.every((s) => s === "skipped")
        ? "skipped"
        : "fail";

    return `<section class="page-block" id="${page.id}">
  <h2>${escapeHtml(page.label)} <span class="badge is-${pageBadge}">${pageBadge}</span></h2>
  <p class="meta">${escapeHtml(page.path)}${page.auth ? " · authenticated" : " · public"}${page.chart ? " · chart required" : ""}</p>
  <div class="grid">${rows}</div>
</section>`;
  }).join("\n");

  const failedAssetPages = manifest.captures.filter((c) => c.assetFailures.length);
  const skipped = manifest.captures.filter((c) => c.status === "skipped");

  return `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Visual Review Pack — ${escapeHtml(manifest.verdict)}</title>
<style>
  :root { color-scheme: dark; --bg:#070b0a; --card:#0f1614; --line:#243238; --text:#e8eef1; --muted:#8b989f; --ok:#62e6b1; --fail:#e08a8a; --skip:#e0c56a; }
  * { box-sizing: border-box; }
  body { margin:0; font:15px/1.5 system-ui,sans-serif; background:var(--bg); color:var(--text); }
  header.report { padding:28px 32px; border-bottom:1px solid var(--line); background:linear-gradient(160deg,#12201b,#0a1210); }
  header.report h1 { margin:0 0 8px; font-size:28px; letter-spacing:-.03em; }
  header.report p { margin:4px 0; color:var(--muted); }
  .verdict { display:inline-block; margin-top:10px; padding:6px 12px; border-radius:999px; font:700 12px/1 system-ui,sans-serif; letter-spacing:.06em; }
  .verdict.ok { background:#62e6b122; color:var(--ok); }
  .verdict.fail { background:#e08a8a22; color:var(--fail); }
  .verdict.incomplete { background:#e0c56a22; color:var(--skip); }
  .stats { display:flex; flex-wrap:wrap; gap:10px; margin-top:14px; }
  .stats span { padding:4px 10px; border-radius:999px; border:1px solid var(--line); font-size:12px; }
  nav.toc { padding:16px 32px; border-bottom:1px solid var(--line); display:flex; flex-wrap:wrap; gap:8px; }
  nav.toc a { color:var(--muted); text-decoration:none; font-size:13px; padding:4px 8px; border:1px solid var(--line); border-radius:8px; }
  main { padding:24px 32px 64px; display:grid; gap:36px; }
  h2 { margin:0 0 8px; font-size:22px; display:flex; gap:10px; align-items:center; flex-wrap:wrap; }
  h3 { margin:0; font-size:15px; }
  h3 small { color:var(--muted); font-weight:500; }
  .grid { display:grid; gap:18px; grid-template-columns:repeat(auto-fit,minmax(320px,1fr)); }
  .card { border:1px solid var(--line); border-radius:14px; background:var(--card); padding:14px; }
  .card.is-fail { border-color:#e08a8a55; }
  .card.is-skipped { border-color:#e0c56a55; }
  .card header { display:flex; justify-content:space-between; gap:12px; align-items:center; }
  .badge { text-transform:uppercase; font:700 11px/1 system-ui,sans-serif; letter-spacing:.08em; color:var(--muted); }
  .is-pass .badge, .badge.is-pass { color:var(--ok); }
  .is-fail .badge, .badge.is-fail { color:var(--fail); }
  .is-skipped .badge, .badge.is-skipped { color:var(--skip); }
  .meta { margin:8px 0 12px; color:var(--muted); font-size:13px; }
  .shots { display:grid; gap:12px; }
  figure { margin:0; }
  figcaption { color:var(--muted); font-size:12px; margin-bottom:6px; }
  img { width:100%; height:auto; border-radius:10px; border:1px solid var(--line); background:#050808; display:block; }
  .empty { color:var(--muted); font-size:13px; }
  .fail-list { margin:0 0 12px; padding-left:18px; color:var(--fail); font-size:12px; }
  code { color:#c5d0d6; }
  footer { padding:20px 32px 40px; color:var(--muted); font-size:12px; border-top:1px solid var(--line); }
  .banner { border:1px solid #e0c56a55; background:#e0c56a12; border-radius:12px; padding:14px 16px; }
</style>
</head>
<body>
<header class="report">
  <h1>Visual Review Pack</h1>
  <div class="verdict ${verdictClass}">${escapeHtml(manifest.verdict)}</div>
  <p>Captured ${escapeHtml(manifest.capturedAt)} · base ${escapeHtml(manifest.baseUrl)}</p>
  <p>Branch ${escapeHtml(manifest.git.branch)} · commit ${escapeHtml(manifest.git.commit)} · auth ${escapeHtml(manifest.auth.method)}</p>
  <p>Server: ${escapeHtml(manifest.server.readinessDetail)}${manifest.server.startedByRunner ? " · started by runner" : " · external process"}</p>
  <div class="stats">
    <span>requested ${manifest.summary.requested}</span>
    <span>captured ${manifest.summary.captured}</span>
    <span class="ok">passed ${manifest.summary.passed}</span>
    <span>failed ${manifest.summary.failed}</span>
    <span>skipped ${manifest.summary.skipped}</span>
    <span>overflow ${manifest.summary.overflows}</span>
    <span>asset-fail pages ${manifest.summary.assetFailurePages}</span>
    <span>console-error pages ${manifest.summary.consoleErrorPages}</span>
  </div>
</header>
<nav class="toc">
  ${PAGES.map((p) => `<a href="#${p.id}">${escapeHtml(p.label)}</a>`).join("")}
</nav>
<main>
  ${
    manifest.verdict.startsWith("INCOMPLETE")
      ? `<section class="banner"><h2>Incomplete — authentication required</h2><pre>${escapeHtml(authInstructions().join("\n"))}</pre></section>`
      : ""
  }
  ${
    failedAssetPages.length
      ? `<section><h2>Asset failures</h2><p class="meta">Captures with failed script/stylesheet loads cannot be treated as visual-acceptance evidence.</p><ul>${failedAssetPages
          .slice(0, 40)
          .map((c) => `<li><a href="#${c.pageId}-${c.viewport}">${escapeHtml(c.label)} @ ${c.viewport}</a> — ${c.assetFailures.length} failure(s)</li>`)
          .join("")}</ul></section>`
      : ""
  }
  ${
    skipped.length
      ? `<section><h2>Skipped</h2><ul>${[...new Set(skipped.map((s) => s.pageId))]
          .map((id) => {
            const row = skipped.find((s) => s.pageId === id)!;
            return `<li><a href="#${id}">${escapeHtml(row.label)}</a> — ${escapeHtml(row.error || "skipped")}</li>`;
          })
          .join("")}</ul></section>`
      : ""
  }
  ${pageSections}
</main>
<footer>
  Generated by <code>npm run visual-review</code>. Screenshots reflect the live verified/delayed/unavailable state — nothing was fabricated.
  Auth tokens are never embedded in this report. Console allow-list is limited to React DevTools / HMR / Vite noise.
</footer>
</body>
</html>`;
}

function writeSummaryMd(manifest: Manifest): string {
  const lines = [
    `# Visual Review Summary`,
    ``,
    `- Verdict: **${manifest.verdict}**`,
    `- Captured: ${manifest.capturedAt}`,
    `- Base URL: ${manifest.baseUrl}`,
    `- Environment: ${manifest.environment}`,
    `- Branch: ${manifest.git.branch}`,
    `- Commit: ${manifest.git.commit}`,
    `- Auth: ${manifest.auth.method} — ${manifest.auth.detail}`,
    `- Server: ${manifest.server.readinessDetail}`,
    `- Requested: ${manifest.summary.requested}`,
    `- Captured: ${manifest.summary.captured}`,
    `- Passed: ${manifest.summary.passed}`,
    `- Failed: ${manifest.summary.failed}`,
    `- Skipped: ${manifest.summary.skipped}`,
    `- Overflow flags: ${manifest.summary.overflows}`,
    `- Pages with asset failures: ${manifest.summary.assetFailurePages}`,
    `- Pages with console errors: ${manifest.summary.consoleErrorPages}`,
    ``,
    `## Pages`,
    ``,
  ];
  for (const page of PAGES) {
    const rows = manifest.captures.filter((c) => c.pageId === page.id);
    if (!rows.length) {
      lines.push(`- SKIP **${page.label}** (\`${page.path}\`)`);
      continue;
    }
    if (rows.every((r) => r.status === "pass")) lines.push(`- PASS **${page.label}** (\`${page.path}\`)`);
    else if (rows.every((r) => r.status === "skipped"))
      lines.push(`- SKIP **${page.label}** (\`${page.path}\`) — ${rows[0].error}`);
    else lines.push(`- FAIL **${page.label}** (\`${page.path}\`)`);
    for (const row of rows.filter((r) => r.status !== "pass" || r.overflow || r.assetFailures.length)) {
      const notes = [
        ...row.reasons,
        row.overflow ? `overflow: ${(row.offenders || []).join(", ")}` : "",
      ]
        .filter(Boolean)
        .join(" | ");
      if (notes) lines.push(`  - ${row.viewport}: ${notes}`);
    }
  }
  if (manifest.verdict.startsWith("INCOMPLETE")) {
    lines.push(``, `## Authentication required`, ``, ...authInstructions());
  }
  lines.push(``, `Open \`visual-review/latest/index.html\` in a browser.`);
  return lines.join("\n");
}

function writeIncompleteArtifacts(opts: {
  baseUrl: string;
  auth: AuthResult;
  server: Manifest["server"];
  captures?: CaptureResult[];
  reason: string;
}): void {
  const captures =
    opts.captures ??
    PAGES.flatMap((page) => VIEWPORTS.map((vp) => skippedCapture(page, vp, opts.reason)));
  const summary = {
    requested: PAGES.length * VIEWPORTS.length,
    captured: captures.filter((c) => c.status !== "skipped").length,
    passed: captures.filter((c) => c.status === "pass").length,
    failed: captures.filter((c) => c.status === "fail").length,
    skipped: captures.filter((c) => c.status === "skipped").length,
    overflows: captures.filter((c) => c.overflow).length,
    consoleErrorPages: new Set(captures.filter((c) => c.consoleErrors.length).map((c) => c.pageId)).size,
    assetFailurePages: new Set(captures.filter((c) => c.assetFailures.length).map((c) => c.pageId)).size,
  };
  const manifest: Manifest = {
    ok: false,
    verdict: "INCOMPLETE — AUTHENTICATION REQUIRED",
    tool: "visual-review",
    capturedAt: new Date().toISOString(),
    baseUrl: opts.baseUrl,
    environment: opts.baseUrl.includes("localhost") || opts.baseUrl.includes("127.0.0.1") ? "local" : "remote",
    git: {
      branch: runGit(["branch", "--show-current"]) || "unknown",
      commit: runGit(["rev-parse", "--short", "HEAD"]) || "unknown",
    },
    auth: {
      method: opts.auth.method,
      succeeded: opts.auth.succeeded,
      detail: opts.auth.detail,
      storageState: null,
    },
    server: opts.server,
    viewports: VIEWPORTS,
    pages: PAGES,
    captures,
    summary,
    compareAgainst: null,
    compare: [],
  };
  // If server itself was broken and we have zero public passes, escalate verdict to FAIL when auth isn't the only issue.
  if (!opts.server.ready || summary.failed > 0 && summary.passed === 0 && !opts.auth.succeeded) {
    if (!opts.server.ready) manifest.verdict = "FAIL";
  }
  persistManifest(manifest);
}

function persistManifest(manifest: Manifest): void {
  const screenshotIndex = {
    generatedAt: manifest.capturedAt,
    count: manifest.captures.filter((c) => c.files.full || c.files.fold).length,
    files: manifest.captures.flatMap((c) => {
      const entries: Array<{
        pageId: string;
        label: string;
        viewport: string;
        kind: "fold" | "full";
        path: string;
        status: CaptureStatus;
        foldEqualsFull?: boolean;
      }> = [];
      if (c.files.fold && !(c.foldEqualsFull && c.files.full)) {
        entries.push({
          pageId: c.pageId,
          label: c.label,
          viewport: c.viewport,
          kind: "fold",
          path: c.files.fold,
          status: c.status,
        });
      }
      if (c.files.full) {
        entries.push({
          pageId: c.pageId,
          label: c.label,
          viewport: c.viewport,
          kind: "full",
          path: c.files.full,
          status: c.status,
          foldEqualsFull: c.foldEqualsFull,
        });
      }
      return entries;
    }),
  };

  writeFileSync(join(LATEST_DIR, "manifest.json"), JSON.stringify(manifest, null, 2), "utf8");
  writeFileSync(join(LATEST_DIR, "screenshot-index.json"), JSON.stringify(screenshotIndex, null, 2), "utf8");
  writeFileSync(join(LATEST_DIR, "index.html"), renderHtml(manifest), "utf8");
  writeFileSync(join(LATEST_DIR, "summary.md"), writeSummaryMd(manifest), "utf8");

  const runId = stamp();
  const archive = join(RUNS_DIR, runId);
  mkdirSync(archive, { recursive: true });
  cpSync(LATEST_DIR, archive, { recursive: true });

  writeFileSync(
    join(OUT_ROOT, "index.html"),
    `<!doctype html><meta http-equiv="refresh" content="0; url=./latest/index.html"><p><a href="./latest/index.html">Open latest visual review</a></p>\n`,
    "utf8",
  );

  console.log(`[visual-review] wrote ${LATEST_DIR}/index.html`);
  console.log(`[visual-review] archived run ${runId}`);
  console.log(
    `[visual-review] verdict=${manifest.verdict} requested=${manifest.summary.requested} captured=${manifest.summary.captured} passed=${manifest.summary.passed} failed=${manifest.summary.failed} skipped=${manifest.summary.skipped}`,
  );
}

async function main(): Promise<void> {
  ensureDirs();
  const shotDir = join(LATEST_DIR, "screenshots");
  if (existsSync(shotDir)) rmSync(shotDir, { recursive: true, force: true });
  mkdirSync(shotDir, { recursive: true });

  const preferredBaseUrl = resolvePreferredBaseUrl();
  const wantCompare = argFlag("--compare");

  console.log(`[visual-review] preferred base=${preferredBaseUrl}`);
  const boot = await maybeStartApp(preferredBaseUrl);
  const baseUrl = boot.baseUrl;
  console.log(`[visual-review] using base=${baseUrl}`);
  console.log(`[visual-review] readiness: ${boot.detail}`);

  const serverMeta: Manifest["server"] = {
    startedByRunner: boot.started,
    ready: boot.ready,
    readinessDetail: boot.detail,
    exitedDuringCapture: false,
  };

  if (!boot.ready) {
    const auth: AuthResult = {
      attempted: false,
      succeeded: false,
      method: "none",
      detail: "Server not asset-ready; auth not attempted.",
      storageStatePath: null,
    };
    writeIncompleteArtifacts({
      baseUrl,
      auth,
      server: serverMeta,
      reason: `Server not asset-ready: ${boot.detail}`,
    });
    // Override verdict to FAIL for server issues
    const manifest = JSON.parse(readFileSync(join(LATEST_DIR, "manifest.json"), "utf8")) as Manifest;
    manifest.verdict = "FAIL";
    manifest.ok = false;
    persistManifest(manifest);
    process.exitCode = 1;
    return;
  }

  const browser = await chromium.launch();
  const serverChild = boot.child ?? null;
  let serverExited = false;
  serverChild?.on("exit", () => {
    serverExited = true;
    serverMeta.exitedDuringCapture = true;
  });

  try {
    const auth = await prepareAuth(browser, baseUrl);
    if (!auth.succeeded) {
      console.warn(`[visual-review] auth unavailable: ${auth.detail}`);
      for (const line of authInstructions()) console.warn(`  ${line}`);

      // Capture public pages only for tooling health evidence; never claim full PASS.
      const context = await browser.newContext({ reducedMotion: "reduce" });
      const captures: CaptureResult[] = [];
      for (const pageSpec of PAGES) {
        for (const viewport of VIEWPORTS) {
          if (pageSpec.auth) {
            captures.push(
              skippedCapture(pageSpec, viewport, "Skipped — no authenticated storage state"),
            );
            continue;
          }
          process.stdout.write(`[visual-review] ${pageSpec.id} @ ${viewport.id} … `);
          const row = await capturePage(context, baseUrl, pageSpec, viewport, () => !serverExited);
          captures.push(row);
          console.log(row.status);
        }
      }
      await context.close();

      const summary = {
        requested: PAGES.length * VIEWPORTS.length,
        captured: captures.filter((c) => c.status !== "skipped").length,
        passed: captures.filter((c) => c.status === "pass").length,
        failed: captures.filter((c) => c.status === "fail").length,
        skipped: captures.filter((c) => c.status === "skipped").length,
        overflows: captures.filter((c) => c.overflow).length,
        consoleErrorPages: new Set(captures.filter((c) => c.consoleErrors.length).map((c) => c.pageId)).size,
        assetFailurePages: new Set(captures.filter((c) => c.assetFailures.length).map((c) => c.pageId)).size,
      };

      const manifest: Manifest = {
        ok: false,
        verdict: "INCOMPLETE — AUTHENTICATION REQUIRED",
        tool: "visual-review",
        capturedAt: new Date().toISOString(),
        baseUrl,
        environment: baseUrl.includes("localhost") || baseUrl.includes("127.0.0.1") ? "local" : "remote",
        git: {
          branch: runGit(["branch", "--show-current"]) || "unknown",
          commit: runGit(["rev-parse", "--short", "HEAD"]) || "unknown",
        },
        auth: {
          method: auth.method,
          succeeded: false,
          detail: auth.detail,
          storageState: null,
        },
        server: serverMeta,
        viewports: VIEWPORTS,
        pages: PAGES,
        captures,
        summary,
        compareAgainst: null,
        compare: [],
      };
      if (wantCompare) {
        const cmp = buildCompare(manifest, previousRunDir());
        manifest.compareAgainst = cmp.compareAgainst;
        manifest.compare = cmp.compare;
      }
      persistManifest(manifest);
      process.exitCode = 1;
      return;
    }

    const context = await browser.newContext({
      storageState: auth.storageStatePath!,
      reducedMotion: "reduce",
    });

    const captures: CaptureResult[] = [];
    for (const pageSpec of PAGES) {
      for (const viewport of VIEWPORTS) {
        process.stdout.write(`[visual-review] ${pageSpec.id} @ ${viewport.id} … `);
        const row = await capturePage(context, baseUrl, pageSpec, viewport, () => !serverExited);
        captures.push(row);
        console.log(row.status);
      }
    }
    await context.close();

    const summary = {
      requested: PAGES.length * VIEWPORTS.length,
      captured: captures.filter((c) => c.status !== "skipped").length,
      passed: captures.filter((c) => c.status === "pass").length,
      failed: captures.filter((c) => c.status === "fail").length,
      skipped: captures.filter((c) => c.status === "skipped").length,
      overflows: captures.filter((c) => c.overflow).length,
      consoleErrorPages: new Set(captures.filter((c) => c.consoleErrors.length).map((c) => c.pageId)).size,
      assetFailurePages: new Set(captures.filter((c) => c.assetFailures.length).map((c) => c.pageId)).size,
    };

    let verdict: RunVerdict = "PASS";
    if (summary.skipped > 0 && !auth.succeeded) verdict = "INCOMPLETE — AUTHENTICATION REQUIRED";
    else if (summary.failed > 0 || summary.skipped > 0 || serverMeta.exitedDuringCapture) verdict = "FAIL";

    const manifest: Manifest = {
      ok: verdict === "PASS",
      verdict,
      tool: "visual-review",
      capturedAt: new Date().toISOString(),
      baseUrl,
      environment: baseUrl.includes("localhost") || baseUrl.includes("127.0.0.1") ? "local" : "remote",
      git: {
        branch: runGit(["branch", "--show-current"]) || "unknown",
        commit: runGit(["rev-parse", "--short", "HEAD"]) || "unknown",
      },
      auth: {
        method: auth.method,
        succeeded: auth.succeeded,
        detail: auth.detail,
        storageState: auth.storageStatePath ? auth.storageStatePath.replace(`${ROOT}/`, "") : null,
      },
      server: serverMeta,
      viewports: VIEWPORTS,
      pages: PAGES,
      captures,
      summary,
      compareAgainst: null,
      compare: [],
    };

    if (wantCompare) {
      const cmp = buildCompare(manifest, previousRunDir());
      manifest.compareAgainst = cmp.compareAgainst;
      manifest.compare = cmp.compare;
    }

    persistManifest(manifest);
    if (verdict !== "PASS") process.exitCode = 1;
  } finally {
    await browser.close().catch(() => undefined);
    // Shut down only the server we started — never an independently running owner process.
    if (serverChild && !serverChild.killed) {
      serverChild.kill("SIGTERM");
      await new Promise((r) => setTimeout(r, 500));
      if (!serverChild.killed) serverChild.kill("SIGKILL");
    }
  }
}

main().catch((error) => {
  console.error("[visual-review] fatal:", sanitizeText(error instanceof Error ? error.message : String(error)));
  process.exitCode = 1;
});
