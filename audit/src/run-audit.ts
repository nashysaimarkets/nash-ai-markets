import { loadAuditEnv } from "./load-env.ts";
loadAuditEnv();

/**
 * Project Bullseye end-to-end visual/functional audit runner.
 * QA only — does not mutate production data or alter product logic.
 */

import { createWriteStream, mkdirSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { chromium, type Browser, type BrowserContext, type Page, type Response } from "@playwright/test";
import { AxeBuilder } from "@axe-core/playwright";
import {
  AUDIT_OUTPUT_DIR,
  CONSISTENCY_ROUTES,
  MEMBER_ROUTES,
  PUBLIC_ROUTES,
  STORAGE_STATE_PATH,
  VIEWPORTS,
  type RouteSpec,
  type ViewportSpec,
  resolveBaseUrl,
} from "./config.ts";
import { ensureAuthenticatedStorage, type AuthResult } from "./auth.ts";
import { sanitizeText, sanitizeUrl } from "./sanitize.ts";
import { extractMarketSnapshot, runVisualChecks } from "./visual.ts";
import { writeHtmlReport, writeJsonReport, writeMarkdownReport } from "./report.ts";
import type { AuditReport, ConsoleEvent, Finding, NetworkFailure, RouteResult } from "./types.ts";

type Mode = "all" | "desktop" | "mobile" | "setup" | "public";

function parseMode(argv: string[]): Mode {
  const arg = argv.find((item) => item.startsWith("--mode="))?.split("=")[1];
  if (arg === "desktop" || arg === "mobile" || arg === "setup" || arg === "public" || arg === "all") {
    return arg;
  }
  return "all";
}

function selectedViewports(mode: Mode): ViewportSpec[] {
  if (mode === "desktop") return VIEWPORTS.filter((item) => item.group === "desktop");
  if (mode === "mobile") return VIEWPORTS.filter((item) => item.group === "mobile" || item.group === "tablet");
  return [...VIEWPORTS];
}

function ensureDirs() {
  for (const folder of [
    "screenshots/public",
    "screenshots/dashboard",
    "screenshots/brief",
    "screenshots/terminal",
    "screenshots/ideas",
    "screenshots/profile",
    "screenshots/preferences",
    "screenshots/review",
    "screenshots/archive",
    "screenshots/journal",
    "screenshots/performance",
    "screenshots/results",
    "screenshots/replay",
    "screenshots/methodology",
    "reports",
    "logs",
    ".auth",
  ]) {
    mkdirSync(join(AUDIT_OUTPUT_DIR, folder), { recursive: true });
  }
}

function attachCollectors(page: Page, route: string, viewport: string) {
  const consoleEvents: ConsoleEvent[] = [];
  const networkFailures: NetworkFailure[] = [];
  let requestCount = 0;
  let transferEstimateBytes = 0;

  page.on("console", (msg) => {
    if (msg.type() === "error" || msg.type() === "warning") {
      consoleEvents.push({
        route,
        viewport,
        type: msg.type(),
        text: sanitizeText(msg.text()),
        timestamp: new Date().toISOString(),
      });
    }
  });

  page.on("pageerror", (error) => {
    consoleEvents.push({
      route,
      viewport,
      type: "pageerror",
      text: sanitizeText(error.message),
      timestamp: new Date().toISOString(),
    });
  });

  page.on("request", () => {
    requestCount += 1;
  });

  page.on("response", async (response: Response) => {
    const status = response.status();
    const url = sanitizeUrl(response.url());
    try {
      const headers = response.headers();
      const length = Number(headers["content-length"] || 0);
      if (Number.isFinite(length)) transferEstimateBytes += length;
    } catch {
      /* ignore */
    }
    if ([400, 401, 403, 404, 429, 500, 502, 503].includes(status)) {
      networkFailures.push({
        route,
        viewport,
        url,
        status,
        method: response.request().method(),
        timestamp: new Date().toISOString(),
      });
    }
  });

  page.on("requestfailed", (request) => {
    const url = sanitizeUrl(request.url());
    const failureText = request.failure()?.errorText || "requestfailed";
    // Next.js RSC prefetch/navigation aborts are expected when the page settles.
    if (/[?&]_rsc=/i.test(url) && /ERR_ABORTED/i.test(failureText)) return;
    if (/\/auth\/callback/i.test(url)) return;
    networkFailures.push({
      route,
      viewport,
      url,
      status: null,
      method: request.method(),
      timestamp: new Date().toISOString(),
      failureText: sanitizeText(failureText),
    });
  });

  return {
    consoleEvents,
    networkFailures,
    stats: () => ({ requestCount, transferEstimateBytes }),
  };
}

async function settle(page: Page, timeoutMs = 8_000) {
  const started = Date.now();
  try {
    await page.waitForLoadState("networkidle", { timeout: timeoutMs });
  } catch {
    try {
      await page.waitForLoadState("domcontentloaded", { timeout: 3_000 });
    } catch {
      /* continue */
    }
  }
  await page.waitForTimeout(400);
  return Date.now() - started;
}

async function captureScreens(
  page: Page,
  route: RouteSpec,
  viewport: ViewportSpec,
): Promise<{ full: string | null; fold: string | null }> {
  const dir = join(AUDIT_OUTPUT_DIR, "screenshots", route.folder);
  mkdirSync(dir, { recursive: true });
  const fullPath = join(dir, `${route.id}-${viewport.id}-full.png`);
  const foldPath = join(dir, `${route.id}-${viewport.id}-fold.png`);
  try {
    await page.screenshot({ path: foldPath, fullPage: false });
    await page.screenshot({ path: fullPath, fullPage: true });
    return { full: fullPath, fold: foldPath };
  } catch (error) {
    writeFileSync(
      join(AUDIT_OUTPUT_DIR, "logs", `screenshot-${route.id}-${viewport.id}.log`),
      sanitizeText(error instanceof Error ? error.message : "screenshot failed"),
    );
    return { full: null, fold: null };
  }
}

async function runA11y(page: Page) {
  try {
    const results = await new AxeBuilder({ page }).analyze();
    const counts = { critical: 0, serious: 0, moderate: 0, minor: 0 };
    for (const violation of results.violations) {
      const impact = (violation.impact || "minor") as keyof typeof counts;
      if (impact in counts) counts[impact] += 1;
      else counts.minor += 1;
    }
    return {
      ...counts,
      violations: results.violations.slice(0, 40).map((item) => ({
        id: item.id,
        impact: item.impact,
        help: item.help,
        nodes: item.nodes.length,
      })),
    };
  } catch (error) {
    return {
      critical: 0,
      serious: 0,
      moderate: 0,
      minor: 0,
      violations: [
        {
          id: "axe-failed",
          impact: "moderate",
          help: sanitizeText(error instanceof Error ? error.message : "axe failed"),
          nodes: 0,
        },
      ],
    };
  }
}

async function runInteractions(page: Page, route: RouteSpec, viewport: ViewportSpec): Promise<Finding[]> {
  const findings: Finding[] = [];
  const clickSafe = async (selector: string, label: string) => {
    const locator = page.locator(selector).first();
    if ((await locator.count()) === 0) return;
    try {
      await locator.click({ timeout: 2_500 });
      await page.waitForTimeout(250);
    } catch (error) {
      findings.push({
        id: `${route.path}-${viewport.id}-click-${label}`,
        severity: "P3",
        category: "functional",
        page: route.path,
        viewport: viewport.id,
        title: `Control not interactable: ${label}`,
        evidence: sanitizeText(error instanceof Error ? error.message : "click failed"),
        recommendedFix: "Verify control visibility and hit target on this viewport.",
        reproducible: true,
        timestamp: new Date().toISOString(),
      });
    }
  };

  if (route.auth) {
    await clickSafe('nav[aria-label="Member navigation"] a[href="/dashboard"]', "Dashboard nav");
    await clickSafe('nav[aria-label="Member navigation"] a[href="/brief"]', "Brief nav");
    await clickSafe('nav[aria-label="Member navigation"] a[href="/terminal"]', "Terminal nav");
    await clickSafe('details.memberMobileMenu > summary', "Mobile menu");
  }

  if (route.path === "/terminal") {
    await clickSafe('button:has-text("Overview")', "Overview");
    await clickSafe('button:has-text("Charts")', "Charts");
    await clickSafe('button:has-text("Catalysts")', "Catalysts");
    await clickSafe('button:has-text("Risk")', "Risk & Journal");
    await clickSafe('button:has-text("Markets")', "Markets");
    await clickSafe("summary:has-text('Coverage legend')", "Coverage legend");
    await clickSafe("summary:has-text('View technical reasons')", "Technical reasons");
    await clickSafe("summary:has-text('View feed ages')", "Feed ages");
    // Temporary journal note — clearly marked and cleared.
    const journal = page.locator("textarea").first();
    if ((await journal.count()) > 0) {
      try {
        const previous = await journal.inputValue();
        if (!previous.trim()) {
          await journal.fill("[AUDIT TEMP NOTE — safe to delete]");
          await page.waitForTimeout(200);
          await journal.fill("");
        }
      } catch {
        /* ignore writable local journal issues */
      }
    }
  }

  if (route.path === "/brief" || route.path === "/dashboard") {
    await clickSafe("summary:has-text('Technical engine detail')", "Engine detail");
    await clickSafe("button.marketVideoPoster, .dashVideoLink", "Video control");
  }

  return findings;
}

async function auditRoute(
  context: BrowserContext,
  route: RouteSpec,
  viewport: ViewportSpec,
  baseUrl: string,
): Promise<RouteResult> {
  const page = await context.newPage();
  await page.setViewportSize({ width: viewport.width, height: viewport.height });
  const collectors = attachCollectors(page, route.path, viewport.id);
  const started = Date.now();
  const notes: string[] = [];
  let status: number | null = null;
  let response: Response | null = null;

  try {
    response = await page.goto(`${baseUrl}${route.path}`, {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
    status = response?.status() ?? null;
  } catch (error) {
    notes.push(sanitizeText(error instanceof Error ? error.message : "navigation failed"));
  }

  const networkIdleMs = await settle(page);
  const durationMs = Date.now() - started;
  const finalUrl = sanitizeUrl(page.url());
  const bodyText = sanitizeText((await page.locator("body").innerText().catch(() => "")) || "");
  const blank = bodyText.trim().length < 40;
  const loadingStuck = /loading|signing you in/i.test(bodyText) && durationMs > 12_000;
  const redirectedToLogin = route.auth && /\/login/i.test(finalUrl);

  const shots = await captureScreens(page, route, viewport);
  const visualFindings = await runVisualChecks(page, {
    route: route.path,
    viewport: viewport.id,
    screenshot: shots.full,
  });
  const interactionFindings = route.interactions ? await runInteractions(page, route, viewport) : [];
  const a11y = await runA11y(page);
  const marketSnapshot =
    CONSISTENCY_ROUTES.includes(route.path as (typeof CONSISTENCY_ROUTES)[number])
      ? await extractMarketSnapshot(page)
      : undefined;

  const perf = await page.evaluate(() => {
    const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    return {
      navigationMs: nav ? Math.round(nav.duration) : null,
      domContentLoadedMs: nav ? Math.round(nav.domContentLoadedEventEnd) : null,
      loadEventMs: nav ? Math.round(nav.loadEventEnd) : null,
    };
  });

  const findings: Finding[] = [...visualFindings, ...interactionFindings];
  if (status && status >= 500) {
    findings.push({
      id: `${route.path}-${viewport.id}-http5xx`,
      severity: "P0",
      category: "functional",
      page: route.path,
      viewport: viewport.id,
      title: `HTTP ${status} on route`,
      evidence: `status ${status}`,
      recommendedFix: "Investigate server error for this route on the audit base URL.",
      reproducible: true,
      screenshot: shots.full,
      timestamp: new Date().toISOString(),
    });
  } else if (status === 404) {
    findings.push({
      id: `${route.path}-${viewport.id}-http404`,
      severity: "P1",
      category: "functional",
      page: route.path,
      viewport: viewport.id,
      title: "Route returned 404",
      evidence: "HTTP 404",
      recommendedFix: "Confirm route inventory and redirects.",
      reproducible: true,
      screenshot: shots.full,
      timestamp: new Date().toISOString(),
    });
  }

  if (redirectedToLogin) {
    findings.push({
      id: `${route.path}-${viewport.id}-auth-redirect`,
      severity: "P0",
      category: "auth",
      page: route.path,
      viewport: viewport.id,
      title: "Authenticated route redirected to login",
      evidence: `final path ${new URL(finalUrl, baseUrl).pathname}`,
      recommendedFix: "Confirm audit storage state and membership entitlement for the dedicated test account.",
      reproducible: true,
      screenshot: shots.full,
      timestamp: new Date().toISOString(),
    });
  }

  if (blank) notes.push("blank-or-empty");
  if (loadingStuck) notes.push("possible-loading-stuck");
  if (durationMs > 10_000) {
    findings.push({
      id: `${route.path}-${viewport.id}-slow`,
      severity: "P2",
      category: "performance",
      page: route.path,
      viewport: viewport.id,
      title: "Route slow to become usable",
      evidence: `duration ${durationMs}ms`,
      recommendedFix: "Profile slow requests and reduce blocking work on first paint.",
      reproducible: true,
      screenshot: shots.full,
      timestamp: new Date().toISOString(),
    });
  }

  for (const violation of a11y.violations) {
    if (violation.impact === "critical" || violation.impact === "serious") {
      findings.push({
        id: `${route.path}-${viewport.id}-a11y-${violation.id}`,
        severity: violation.impact === "critical" ? "P1" : "P2",
        category: "accessibility",
        page: route.path,
        viewport: viewport.id,
        title: `A11y: ${violation.help}`,
        evidence: `${violation.id} · ${violation.nodes} nodes`,
        recommendedFix: "Address axe violation without redesigning the product in this audit pass.",
        reproducible: true,
        screenshot: shots.full,
        timestamp: new Date().toISOString(),
      });
    }
  }

  const stats = collectors.stats();
  await page.close().catch(() => undefined);

  return {
    path: route.path,
    id: route.id,
    label: route.label,
    auth: route.auth,
    viewport: viewport.id,
    ok: !blank && !redirectedToLogin && !(status && status >= 500),
    finalUrl,
    status,
    blank,
    loadingStuck,
    durationMs,
    screenshotFull: shots.full,
    screenshotFold: shots.fold,
    notes,
    findings,
    consoleErrors: collectors.consoleEvents.filter((item) => item.type === "error" || item.type === "pageerror"),
    networkFailures: collectors.networkFailures,
    a11y,
    performance: {
      navigationMs: perf.navigationMs,
      domContentLoadedMs: perf.domContentLoadedMs,
      loadEventMs: perf.loadEventMs,
      networkIdleMs,
      requestCount: stats.requestCount,
      transferEstimateBytes: stats.transferEstimateBytes,
    },
    marketSnapshot,
  };
}

function compareConsistency(results: RouteResult[]): Finding[] {
  const byPath = new Map<string, RouteResult>();
  for (const result of results) {
    if (result.viewport !== "desktop-1440") continue;
    if (!CONSISTENCY_ROUTES.includes(result.path as (typeof CONSISTENCY_ROUTES)[number])) continue;
    byPath.set(result.path, result);
  }
  const dashboard = byPath.get("/dashboard");
  const brief = byPath.get("/brief");
  const findings: Finding[] = [];
  if (!dashboard?.marketSnapshot || !brief?.marketSnapshot) return findings;

  const keys = ["esValue", "catalyst", "confidence", "participation", "lean"] as const;
  for (const key of keys) {
    const left = dashboard.marketSnapshot[key];
    const right = brief.marketSnapshot[key];
    if (left && right && left !== right) {
      findings.push({
        id: `consistency-${key}`,
        severity: key === "esValue" || key === "catalyst" ? "P1" : "P2",
        category: "consistency",
        page: "/dashboard+/brief",
        viewport: "desktop-1440",
        title: `Shared field mismatch: ${key}`,
        evidence: `Dashboard="${left}" · Brief="${right}" (report-only; do not assume which is correct)`,
        recommendedFix: "Trace each page to the shared snapshot/selector and align presentation.",
        reproducible: true,
        timestamp: new Date().toISOString(),
      });
    }
  }

  const nasdaq = `${dashboard.marketSnapshot.nasdaqLabel || ""} ${brief.marketSnapshot.nasdaqLabel || ""}`;
  if (/Nasdaq Composite/i.test(nasdaq) && /\bNQ\b/.test(nasdaq) && !/futures/i.test(nasdaq)) {
    findings.push({
      id: "consistency-ixic-nq",
      severity: "P1",
      category: "consistency",
      page: "/dashboard+/brief+/terminal",
      viewport: "desktop-1440",
      title: "Possible Nasdaq Composite / NQ labelling confusion",
      evidence: sanitizeText(nasdaq.slice(0, 180)),
      recommendedFix: "Ensure IXIC Composite is never labelled NQ futures.",
      reproducible: true,
      timestamp: new Date().toISOString(),
    });
  }

  return findings;
}

function buildRepairOrder(findings: Finding[]): string[] {
  const ranked = [...findings].sort((a, b) => a.severity.localeCompare(b.severity));
  const seen = new Set<string>();
  const order: string[] = [];
  for (const item of ranked) {
    const key = `${item.severity}:${item.title}`;
    if (seen.has(key)) continue;
    seen.add(key);
    order.push(`${item.severity} — ${item.title} (${item.page})`);
    if (order.length >= 20) break;
  }
  return order;
}

function writeSanitizedLogs(results: RouteResult[]) {
  const consoleLines = results.flatMap((item) =>
    item.consoleErrors.map(
      (event) =>
        `${event.timestamp}\t${event.route}\t${event.viewport}\t${event.type}\t${sanitizeText(event.text)}`,
    ),
  );
  const networkLines = results.flatMap((item) =>
    item.networkFailures.map(
      (event) =>
        `${event.timestamp}\t${event.route}\t${event.viewport}\t${event.method}\t${event.status ?? "—"}\t${sanitizeUrl(event.url)}\t${sanitizeText(event.failureText || "")}`,
    ),
  );
  writeFileSync(join(AUDIT_OUTPUT_DIR, "logs", "console-sanitized.log"), consoleLines.join("\n"));
  writeFileSync(join(AUDIT_OUTPUT_DIR, "logs", "network-failures-sanitized.log"), networkLines.join("\n"));
}

function zipArtifacts() {
  const zipPath = "project-bullseye-audit.zip";
  if (existsSync(zipPath)) rmSync(zipPath);
  const result = spawnSync(
    "zip",
    [
      "-r",
      zipPath,
      AUDIT_OUTPUT_DIR,
      "-x",
      `${AUDIT_OUTPUT_DIR}/.auth/*`,
      `${AUDIT_OUTPUT_DIR}/.auth/**`,
      "**/.DS_Store",
    ],
    { encoding: "utf8" },
  );
  if (result.status !== 0) {
    writeFileSync(
      join(AUDIT_OUTPUT_DIR, "logs", "zip-error.log"),
      sanitizeText(result.stderr || result.stdout || "zip failed"),
    );
    return null;
  }
  return zipPath;
}

async function main() {
  const mode = parseMode(process.argv.slice(2));
  ensureDirs();
  const baseUrl = resolveBaseUrl();
  const viewports = selectedViewports(mode === "setup" ? "desktop" : mode);

  const browser = await chromium.launch({ headless: true });
  let auth: AuthResult = {
    attempted: false,
    succeeded: false,
    method: "none",
    detail: "Authentication not attempted.",
    storageStatePath: null,
  };

  try {
    if (mode !== "public") {
      auth = await ensureAuthenticatedStorage(browser, { force: mode === "setup" || !existsSync(STORAGE_STATE_PATH) });
      writeFileSync(
        join(AUDIT_OUTPUT_DIR, "logs", "auth-result.json"),
        JSON.stringify(
          {
            attempted: auth.attempted,
            succeeded: auth.succeeded,
            method: auth.method,
            detail: sanitizeText(auth.detail),
            storageStatePresent: Boolean(auth.storageStatePath && existsSync(auth.storageStatePath)),
          },
          null,
          2,
        ),
      );
      if (mode === "setup") {
        console.log(
          JSON.stringify({
            ok: auth.succeeded,
            method: auth.method,
            detail: sanitizeText(auth.detail),
          }),
        );
        return;
      }
    }

    const publicContext = await browser.newContext();
    const memberContext =
      auth.succeeded && auth.storageStatePath
        ? await browser.newContext({ storageState: auth.storageStatePath })
        : null;

    const routes: RouteSpec[] =
      mode === "public"
        ? PUBLIC_ROUTES
        : [...PUBLIC_ROUTES, ...(memberContext ? MEMBER_ROUTES : [])];

    const routeResults: RouteResult[] = [];
    for (const viewport of viewports) {
      for (const route of routes) {
        const context = route.auth ? memberContext : publicContext;
        if (!context) continue;
        process.stdout.write(`Auditing ${route.path} @ ${viewport.id}\n`);
        const result = await auditRoute(context, route, viewport, baseUrl);
        routeResults.push(result);
      }
    }

    // Isolated sign-out probe (final, member only, one viewport).
    if (memberContext && mode === "all") {
      const page = await memberContext.newPage();
      await page.setViewportSize({ width: 1280, height: 800 });
      try {
        await page.goto(`${baseUrl}/dashboard`, { waitUntil: "domcontentloaded", timeout: 45_000 });
        await settle(page, 5_000);
        const signOut = page.locator('a[href="/auth/signout"]').first();
        if (await signOut.count()) {
          await signOut.click({ timeout: 3_000 }).catch(() => undefined);
          await page.waitForTimeout(1_000);
        }
      } catch {
        /* isolated */
      } finally {
        await page.close().catch(() => undefined);
      }
    }

    await publicContext.close();
    await memberContext?.close();

    const consistency = compareConsistency(routeResults);
    const findings = [...routeResults.flatMap((item) => item.findings), ...consistency];
    const counts = {
      P0: findings.filter((item) => item.severity === "P0").length,
      P1: findings.filter((item) => item.severity === "P1").length,
      P2: findings.filter((item) => item.severity === "P2").length,
      P3: findings.filter((item) => item.severity === "P3").length,
    };
    const routesTested = [...new Set(routeResults.map((item) => item.path))];
    const routesFailed = [...new Set(routeResults.filter((item) => !item.ok).map((item) => item.path))];
    const consoleErrorCount = routeResults.reduce((sum, item) => sum + item.consoleErrors.length, 0);
    const failedRequestCount = routeResults.reduce((sum, item) => sum + item.networkFailures.length, 0);
    const a11yCritical = routeResults.reduce((sum, item) => sum + (item.a11y?.critical || 0), 0);
    const a11ySerious = routeResults.reduce((sum, item) => sum + (item.a11y?.serious || 0), 0);

    const report: AuditReport = {
      generatedAt: new Date().toISOString(),
      baseUrl,
      auth: {
        attempted: auth.attempted,
        succeeded: auth.succeeded,
        method: auth.method,
        detail: sanitizeText(auth.detail),
      },
      viewports: viewports.map((item) => item.id),
      routesDiscovered: [...PUBLIC_ROUTES, ...MEMBER_ROUTES].map((item) => item.path),
      routesTested,
      routesFailed,
      screenshotCount: routeResults.filter((item) => item.screenshotFull).length,
      findings,
      routeResults,
      consistency,
      consoleErrorCount,
      failedRequestCount,
      counts,
      accessibilitySummary: `Axe critical=${a11yCritical}, serious=${a11ySerious} across audited route/viewport combinations.`,
      dataConsistencySummary: consistency.length
        ? `${consistency.length} cross-page consistency flag(s) on desktop-1440 shared fields.`
        : "No cross-page shared-field contradictions flagged on desktop-1440 (or member auth unavailable).",
      recommendedRepairOrder: buildRepairOrder(findings),
    };

    writeSanitizedLogs(routeResults);
    const jsonPath = writeJsonReport(report);
    const mdPath = writeMarkdownReport(report);
    const htmlPath = writeHtmlReport(report);
    const zipPath = zipArtifacts();

    const summary = {
      baseUrl,
      mode,
      auth: report.auth,
      routesTested: report.routesTested.length,
      routesFailed: report.routesFailed,
      viewports: report.viewports,
      screenshotCount: report.screenshotCount,
      counts: report.counts,
      consoleErrorCount,
      failedRequestCount,
      htmlReport: htmlPath,
      markdownReport: mdPath,
      jsonReport: jsonPath,
      zip: zipPath,
      safeToUploadExternally: true,
    };
    writeFileSync(join(AUDIT_OUTPUT_DIR, "reports", "summary.json"), JSON.stringify(summary, null, 2));
    console.log(JSON.stringify(summary, null, 2));
  } finally {
    await browser.close();
  }
}

await main();
