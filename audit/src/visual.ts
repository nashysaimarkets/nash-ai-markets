import type { Page } from "@playwright/test";
import type { Finding } from "./types.ts";

function finding(
  partial: Omit<Finding, "timestamp" | "reproducible"> & { reproducible?: boolean },
): Finding {
  return {
    ...partial,
    reproducible: partial.reproducible ?? true,
    timestamp: new Date().toISOString(),
  };
}

/** Heuristic visual checks — presentation evidence only. */
export async function runVisualChecks(
  page: Page,
  meta: { route: string; viewport: string; screenshot?: string | null },
): Promise<Finding[]> {
  const findings: Finding[] = [];
  const metrics = await page.evaluate(() => {
    const doc = document.documentElement;
    const body = document.body;
    const overflowX = Math.max(doc.scrollWidth, body?.scrollWidth ?? 0) > window.innerWidth + 2;
    const sticky = [...document.querySelectorAll("header, [class*='sticky'], [class*='Nav']")] as HTMLElement[];
    const stickyBottom = sticky.reduce((max, el) => {
      const style = getComputedStyle(el);
      if (style.position !== "sticky" && style.position !== "fixed") return max;
      const rect = el.getBoundingClientRect();
      return Math.max(max, rect.bottom);
    }, 0);

    const firstHeading = document.querySelector("h1");
    const headingTop = firstHeading?.getBoundingClientRect().top ?? null;
    const hiddenByHeader =
      headingTop != null && stickyBottom > 0 && headingTop < stickyBottom - 4;

    const tinyText = [...document.querySelectorAll("p, span, li, button, a")]
      .slice(0, 400)
      .filter((el) => {
        const size = Number.parseFloat(getComputedStyle(el).fontSize || "16");
        const text = (el.textContent || "").trim();
        return text.length > 8 && size > 0 && size < 10;
      }).length;

    const brokenImages = [...document.images].filter((img) => img.complete && img.naturalWidth === 0).length;
    const comingSoon = (document.body?.innerText || "").match(/coming soon|coming later/gi)?.length ?? 0;
    const unfinished = [...document.querySelectorAll("button, a, summary")]
      .map((el) => (el.textContent || "").trim())
      .filter((text) => /^(More|PRESENT|TODO|WIP)$/i.test(text)).length;

    return {
      overflowX,
      hiddenByHeader,
      stickyBottom,
      headingTop,
      tinyText,
      brokenImages,
      comingSoon,
      unfinished,
      bodyTextLength: (document.body?.innerText || "").trim().length,
    };
  });

  if (metrics.overflowX) {
    findings.push(
      finding({
        id: `${meta.route}-${meta.viewport}-overflow-x`,
        severity: "P2",
        category: "visual",
        page: meta.route,
        viewport: meta.viewport,
        title: "Horizontal overflow detected",
        evidence: "document scrollWidth exceeds viewport width",
        recommendedFix: "Inspect layout containers and long unbroken strings on this viewport.",
        screenshot: meta.screenshot,
      }),
    );
  }

  if (metrics.hiddenByHeader) {
    findings.push(
      finding({
        id: `${meta.route}-${meta.viewport}-sticky-cover`,
        severity: "P2",
        category: "visual",
        page: meta.route,
        viewport: meta.viewport,
        title: "Content may be hidden behind sticky header",
        evidence: `h1 top ${metrics.headingTop} vs sticky bottom ${metrics.stickyBottom}`,
        recommendedFix: "Add scroll-margin/padding under the sticky member header.",
        screenshot: meta.screenshot,
      }),
    );
  }

  if (metrics.tinyText > 8) {
    findings.push(
      finding({
        id: `${meta.route}-${meta.viewport}-tiny-text`,
        severity: "P3",
        category: "visual",
        page: meta.route,
        viewport: meta.viewport,
        title: "Unusably small text samples found",
        evidence: `${metrics.tinyText} elements under 10px font-size`,
        recommendedFix: "Raise minimum body/control type size on this viewport.",
        screenshot: meta.screenshot,
      }),
    );
  }

  if (metrics.brokenImages > 0) {
    findings.push(
      finding({
        id: `${meta.route}-${meta.viewport}-broken-images`,
        severity: "P1",
        category: "visual",
        page: meta.route,
        viewport: meta.viewport,
        title: "Broken images detected",
        evidence: `${metrics.brokenImages} images with naturalWidth 0`,
        recommendedFix: "Fix image URLs or provide honest unavailable placeholders.",
        screenshot: meta.screenshot,
      }),
    );
  }

  if (metrics.unfinished > 0) {
    findings.push(
      finding({
        id: `${meta.route}-${meta.viewport}-unfinished-controls`,
        severity: "P1",
        category: "visual",
        page: meta.route,
        viewport: meta.viewport,
        title: "Unfinished development-style controls visible",
        evidence: `${metrics.unfinished} controls labelled More/PRESENT/TODO/WIP`,
        recommendedFix: "Hide unfinished controls from ordinary member navigation.",
        screenshot: meta.screenshot,
      }),
    );
  }

  if (metrics.comingSoon >= 8) {
    findings.push(
      finding({
        id: `${meta.route}-${meta.viewport}-coming-soon-dominance`,
        severity: "P3",
        category: "visual",
        page: meta.route,
        viewport: meta.viewport,
        title: "Many coming-soon labels on page",
        evidence: `${metrics.comingSoon} coming soon/later mentions`,
        recommendedFix: "Collapse planned catalogue noise so connected markets stay primary.",
        screenshot: meta.screenshot,
      }),
    );
  }

  if (metrics.bodyTextLength < 40) {
    findings.push(
      finding({
        id: `${meta.route}-${meta.viewport}-blankish`,
        severity: "P1",
        category: "functional",
        page: meta.route,
        viewport: meta.viewport,
        title: "Page appears blank or nearly empty",
        evidence: `body text length ${metrics.bodyTextLength}`,
        recommendedFix: "Investigate render/error boundary failures for this route.",
        screenshot: meta.screenshot,
      }),
    );
  }

  return findings;
}

/** Checks for session video surfaces introduced in the visual/video layer. */
export async function runVideoSurfaceChecks(
  page: Page,
  meta: { route: string; viewport: string; screenshot?: string | null },
): Promise<Finding[]> {
  const findings: Finding[] = [];
  const state = await page.evaluate(() => {
    const ytIframes = [...document.querySelectorAll("iframe")].filter((frame) =>
      /youtube|youtu\.be/i.test(frame.getAttribute("src") || frame.getAttribute("data-src") || ""),
    );
    const autoplay = ytIframes.some((frame) => /autoplay=1/i.test(frame.getAttribute("src") || ""));
    const nonPrivacy = ytIframes.some((frame) => {
      const src = frame.getAttribute("src") || "";
      return /youtube\.com\/embed/i.test(src) && !/youtube-nocookie\.com/i.test(src);
    });
    const missingTitle = ytIframes.filter((frame) => !(frame.getAttribute("title") || "").trim()).length;
    const livePulseOnDelayed = [...document.querySelectorAll(".vxPulseLive")].some((el) => {
      const text = `${el.textContent || ""} ${el.parentElement?.textContent || ""}`;
      return /delayed|stale|unavailable/i.test(text);
    });
    return {
      ytIframeCount: ytIframes.length,
      autoplay,
      nonPrivacy,
      missingTitle,
      livePulseOnDelayed,
      hasVideoControls: document.querySelectorAll(
        "button.marketVideoPoster, .dashVideoLink, .deskVideoShortcut, .dashVideoPending, .marketVideoArchive",
      ).length,
      hasBrokenEmptyIframe: [...document.querySelectorAll("iframe")].some(
        (frame) => !(frame.getAttribute("src") || "").trim(),
      ),
    };
  });

  if (state.autoplay) {
    findings.push(
      finding({
        id: `${meta.route}-${meta.viewport}-video-autoplay`,
        severity: "P1",
        category: "functional",
        page: meta.route,
        viewport: meta.viewport,
        title: "YouTube embed appears to autoplay",
        evidence: "iframe src contains autoplay=1",
        recommendedFix: "Remove autoplay from embed URLs; keep click-to-load posters.",
        screenshot: meta.screenshot,
      }),
    );
  }

  if (state.nonPrivacy) {
    findings.push(
      finding({
        id: `${meta.route}-${meta.viewport}-video-privacy`,
        severity: "P2",
        category: "functional",
        page: meta.route,
        viewport: meta.viewport,
        title: "YouTube embed is not using privacy-enhanced domain",
        evidence: "youtube.com/embed without youtube-nocookie.com",
        recommendedFix: "Use youtube-nocookie embed URLs for member video players.",
        screenshot: meta.screenshot,
      }),
    );
  }

  if (state.missingTitle) {
    findings.push(
      finding({
        id: `${meta.route}-${meta.viewport}-video-iframe-title`,
        severity: "P2",
        category: "accessibility",
        page: meta.route,
        viewport: meta.viewport,
        title: "YouTube iframe missing accessible title",
        evidence: `${state.missingTitle} iframe(s) without title`,
        recommendedFix: "Set a meaningful iframe title from the video record.",
        screenshot: meta.screenshot,
      }),
    );
  }

  if (state.livePulseOnDelayed) {
    findings.push(
      finding({
        id: `${meta.route}-${meta.viewport}-delayed-live-pulse`,
        severity: "P1",
        category: "visual",
        page: meta.route,
        viewport: meta.viewport,
        title: "Delayed/stale indicator uses live pulse styling",
        evidence: ".vxPulseLive near delayed/stale/unavailable copy",
        recommendedFix: "Reserve live pulse for genuinely live connected indicators only.",
        screenshot: meta.screenshot,
      }),
    );
  }

  if (state.hasBrokenEmptyIframe) {
    findings.push(
      finding({
        id: `${meta.route}-${meta.viewport}-empty-iframe`,
        severity: "P2",
        category: "functional",
        page: meta.route,
        viewport: meta.viewport,
        title: "Empty iframe present on page",
        evidence: "iframe without src",
        recommendedFix: "Do not mount YouTube iframes until click-to-load activation.",
        screenshot: meta.screenshot,
      }),
    );
  }

  return findings;
}

export async function extractMarketSnapshot(page: Page): Promise<Record<string, string | null>> {
  return page.evaluate(() => {
    const text = document.body?.innerText || "";
    const pick = (re: RegExp): string | null => {
      const match = text.match(re);
      return match?.[1]?.trim() ?? null;
    };
    return {
      esValue: pick(/S&P 500[^\n]{0,40}?([\d,]+\.\d{2})/i) || pick(/\bES\b[^\n]{0,20}?([\d,]+\.\d{2})/),
      percentChange: pick(/([+-]?\d+\.\d+%)/),
      absoluteChange: pick(/([+-]?\d+\.\d+)\s*pts/i),
      delayAge: pick(/(Delayed market data[^\n]+|Delayed[^\n]{0,40}\d+\s*min[^\n]*)/i),
      session: pick(/Session\s*\n?\s*([^\n]+)/i),
      lean: pick(/Observed market lean\s*\n?\s*([^\n]+)/i) || pick(/Mildly (?:bullish|bearish)|Neutral/i),
      confidence: pick(/Confidence\s*\n?\s*([^\n]+)/i) || pick(/(NOT ESTABLISHED|\d+\s*\/\s*100)/i),
      participation: pick(/Participation\s*\n?\s*([^\n]+)/i) || pick(/WAIT FOR CONFIRMATION/i),
      catalyst: pick(/Upcoming catalyst\s*\n?\s*([^\n]+)/i) || pick(/Employment Cost[^\n]*/i),
      vix: pick(/\bVIX\b[^\n]{0,20}?([\d.]+)/i),
      dxy: pick(/\bDXY\b[^\n]{0,20}?([\d.]+)/i),
      us10y: pick(/US 10-year[^\n]{0,20}?([\d.]+%?)/i),
      nasdaqLabel: pick(/Nasdaq[^\n]{0,40}/i),
    };
  });
}
