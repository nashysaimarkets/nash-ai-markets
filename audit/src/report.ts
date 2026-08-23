import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { AuditReport, Finding } from "./types.ts";
import { AUDIT_OUTPUT_DIR } from "./config.ts";
import { sanitizeText } from "./sanitize.ts";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function groupFindings(findings: Finding[]): Record<string, Finding[]> {
  return {
    P0: findings.filter((item) => item.severity === "P0"),
    P1: findings.filter((item) => item.severity === "P1"),
    P2: findings.filter((item) => item.severity === "P2"),
    P3: findings.filter((item) => item.severity === "P3"),
  };
}

export function writeJsonReport(report: AuditReport): string {
  const dir = join(AUDIT_OUTPUT_DIR, "reports");
  mkdirSync(dir, { recursive: true });
  const path = join(AUDIT_OUTPUT_DIR, "project-bullseye-audit.json");
  writeFileSync(path, JSON.stringify(report, null, 2));
  return path;
}

export function writeMarkdownReport(report: AuditReport): string {
  const grouped = groupFindings(report.findings);
  const lines = [
    "# Project Bullseye Audit",
    "",
    `Generated: ${report.generatedAt}`,
    `Base URL: ${report.baseUrl}`,
    "",
    "## Executive summary",
    "",
    `- Auth: ${report.auth.succeeded ? "succeeded" : report.auth.attempted ? "failed" : "skipped"} (${report.auth.method})`,
    `- Routes tested: ${report.routesTested.length}`,
    `- Routes failed: ${report.routesFailed.length}`,
    `- Screenshots: ${report.screenshotCount}`,
    `- Findings: P0 ${report.counts.P0}, P1 ${report.counts.P1}, P2 ${report.counts.P2}, P3 ${report.counts.P3}`,
    `- Console errors: ${report.consoleErrorCount}`,
    `- Failed requests: ${report.failedRequestCount}`,
    "",
    `Authentication detail: ${sanitizeText(report.auth.detail)}`,
    "",
    "## Data consistency",
    "",
    report.dataConsistencySummary,
    "",
    "## Accessibility",
    "",
    report.accessibilitySummary,
    "",
    "## Recommended repair order",
    "",
    ...report.recommendedRepairOrder.map((item, index) => `${index + 1}. ${item}`),
    "",
    "## Findings",
    "",
  ];

  for (const severity of ["P0", "P1", "P2", "P3"] as const) {
    lines.push(`### ${severity}`);
    const items = grouped[severity] ?? [];
    if (!items.length) {
      lines.push("", "_None_", "");
      continue;
    }
    for (const item of items) {
      lines.push(
        "",
        `#### ${item.title}`,
        "",
        `- Page: \`${item.page}\``,
        `- Viewport: ${item.viewport}`,
        `- Category: ${item.category}`,
        `- Evidence: ${sanitizeText(item.evidence)}`,
        `- Fix: ${item.recommendedFix}`,
        `- Reproducible: ${item.reproducible}`,
        item.screenshot ? `- Screenshot: ${item.screenshot}` : "- Screenshot: n/a",
      );
    }
    lines.push("");
  }

  const path = join(AUDIT_OUTPUT_DIR, "project-bullseye-audit.md");
  writeFileSync(path, lines.join("\n"));
  return path;
}

export function writeHtmlReport(report: AuditReport): string {
  const grouped = groupFindings(report.findings);
  const gallery = report.routeResults
    .filter((item) => item.screenshotFull)
    .map((item) => {
      const rel = item.screenshotFull!.replace(`${AUDIT_OUTPUT_DIR}/`, "");
      return `<figure><a href="${escapeHtml(rel)}"><img src="${escapeHtml(rel)}" alt="${escapeHtml(item.label)} ${escapeHtml(item.viewport)}" loading="lazy" /></a><figcaption>${escapeHtml(item.label)} · ${escapeHtml(item.viewport)}</figcaption></figure>`;
    })
    .join("\n");

  const findingSection = (severity: "P0" | "P1" | "P2" | "P3") => {
    const items = grouped[severity] ?? [];
    if (!items.length) return `<h3>${severity}</h3><p>None</p>`;
    return `<h3>${severity}</h3><ul>${items
      .map((item) => {
        const shot = item.screenshot
          ? `<a href="${escapeHtml(item.screenshot.replace(`${AUDIT_OUTPUT_DIR}/`, ""))}">screenshot</a>`
          : "n/a";
        return `<li><strong>${escapeHtml(item.title)}</strong><br/>${escapeHtml(item.page)} · ${escapeHtml(item.viewport)}<br/><em>${escapeHtml(sanitizeText(item.evidence))}</em><br/>Fix: ${escapeHtml(item.recommendedFix)} · ${shot}</li>`;
      })
      .join("")}</ul>`;
  };

  const routeNotes = report.routeResults
    .map((item) => {
      const status = item.ok ? "ok" : "FAIL";
      return `<tr><td>${escapeHtml(item.path)}</td><td>${escapeHtml(item.viewport)}</td><td>${status}</td><td>${item.status ?? "—"}</td><td>${item.durationMs}ms</td><td>${escapeHtml(item.notes.join("; ") || "—")}</td></tr>`;
    })
    .join("\n");

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Project Bullseye Audit</title>
  <style>
    :root { color-scheme: dark; font-family: ui-sans-serif, system-ui, sans-serif; }
    body { margin: 0; background: #0b1114; color: #e7eef1; line-height: 1.45; }
    main { width: min(1100px, calc(100% - 32px)); margin: 24px auto 64px; }
    h1,h2,h3 { letter-spacing: -0.02em; }
    .cards { display: grid; grid-template-columns: repeat(auto-fit,minmax(160px,1fr)); gap: 12px; }
    .card { padding: 14px; border: 1px solid #243238; border-radius: 12px; background: #11181c; }
    .card strong { display: block; font-size: 22px; margin-top: 6px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th, td { border-bottom: 1px solid #243238; padding: 8px; text-align: left; vertical-align: top; }
    .gallery { display: grid; grid-template-columns: repeat(auto-fit,minmax(220px,1fr)); gap: 12px; }
    figure { margin: 0; padding: 8px; border: 1px solid #243238; border-radius: 10px; background: #0f1518; }
    img { display: block; width: 100%; height: auto; border-radius: 6px; }
    figcaption { margin-top: 8px; color: #9aa7ad; font-size: 12px; }
    code, em { color: #c9d7cc; }
    .muted { color: #9aa7ad; }
  </style>
</head>
<body>
<main>
  <p class="muted">Project Bullseye · automated QA audit</p>
  <h1>Executive summary</h1>
  <p>Base URL: <code>${escapeHtml(report.baseUrl)}</code><br/>Generated ${escapeHtml(report.generatedAt)}</p>
  <div class="cards">
    <div class="card"><span>P0</span><strong>${report.counts.P0}</strong></div>
    <div class="card"><span>P1</span><strong>${report.counts.P1}</strong></div>
    <div class="card"><span>P2</span><strong>${report.counts.P2}</strong></div>
    <div class="card"><span>P3</span><strong>${report.counts.P3}</strong></div>
    <div class="card"><span>Screenshots</span><strong>${report.screenshotCount}</strong></div>
    <div class="card"><span>Console errors</span><strong>${report.consoleErrorCount}</strong></div>
    <div class="card"><span>Failed requests</span><strong>${report.failedRequestCount}</strong></div>
  </div>

  <h2>Authentication</h2>
  <p>${report.auth.succeeded ? "Succeeded" : report.auth.attempted ? "Failed" : "Skipped"} · ${escapeHtml(report.auth.method)}<br/><span class="muted">${escapeHtml(sanitizeText(report.auth.detail))}</span></p>

  <h2>Routes tested</h2>
  <p>${report.routesTested.map(escapeHtml).join(", ") || "None"}</p>
  <h2>Routes failed</h2>
  <p>${report.routesFailed.map(escapeHtml).join(", ") || "None"}</p>
  <h2>Viewports</h2>
  <p>${report.viewports.map(escapeHtml).join(", ")}</p>

  <h2>Critical blockers (P0)</h2>
  ${findingSection("P0")}
  <h2>High-priority problems (P1)</h2>
  ${findingSection("P1")}
  <h2>Medium-priority improvements (P2)</h2>
  ${findingSection("P2")}
  <h2>Minor polish (P3)</h2>
  ${findingSection("P3")}

  <h2>Data consistency</h2>
  <p>${escapeHtml(report.dataConsistencySummary)}</p>
  <ul>${report.consistency.map((item) => `<li><strong>${escapeHtml(item.title)}</strong> — ${escapeHtml(sanitizeText(item.evidence))}</li>`).join("") || "<li>None flagged</li>"}</ul>

  <h2>Accessibility</h2>
  <p>${escapeHtml(report.accessibilitySummary)}</p>

  <h2>Recommended repair order</h2>
  <ol>${report.recommendedRepairOrder.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ol>

  <h2>Route-by-route notes</h2>
  <table>
    <thead><tr><th>Path</th><th>Viewport</th><th>Result</th><th>Status</th><th>Duration</th><th>Notes</th></tr></thead>
    <tbody>${routeNotes}</tbody>
  </table>

  <h2>Screenshot gallery</h2>
  <div class="gallery">${gallery || "<p>No screenshots captured.</p>"}</div>
</main>
</body>
</html>`;

  const path = join(AUDIT_OUTPUT_DIR, "project-bullseye-audit.html");
  writeFileSync(path, html);
  return path;
}
