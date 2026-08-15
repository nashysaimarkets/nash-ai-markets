"use client";

import { useEffect } from "react";

const PREVIEW_VIEWS: Record<string, string> = {
  "/dashboard": "dashboard",
  "/brief": "brief",
  "/terminal": "terminal",
  "/ideas": "ideas",
  "/reviews": "reviews",
  "/profile": "profile",
  "/preferences": "preferences",
  "/onboarding": "preferences",
};

const BLOCKED_MEMBER_PATHS = new Set([
  "/auth/signout",
  "/archive",
  "/journal",
  "/methodology",
  "/performance",
  "/replay",
  "/results",
  "/review",
]);

function protectedPreviewHref(rawHref: string): string | null {
  if (!rawHref || rawHref.startsWith("#") || rawHref.startsWith("mailto:") || rawHref.startsWith("tel:")) {
    return null;
  }

  try {
    const current = new URL(window.location.href);
    const target = new URL(rawHref, current);
    if (target.origin !== current.origin) return null;

    const view = PREVIEW_VIEWS[target.pathname];
    if (view) {
      const query = new URLSearchParams({ view });
      const state = current.searchParams.get("state");
      if (state) query.set("state", state);
      return `/marketing-preview?${query.toString()}`;
    }

    if (target.pathname.startsWith("/api/") || BLOCKED_MEMBER_PATHS.has(target.pathname)) {
      return "#preview-navigation-note";
    }
  } catch {
    return "#preview-navigation-note";
  }

  return null;
}

function rewritePreviewLinks(root: HTMLElement) {
  root.querySelectorAll<HTMLAnchorElement>("a[href]").forEach((anchor) => {
    const replacement = protectedPreviewHref(anchor.getAttribute("href") ?? "");
    if (!replacement || anchor.getAttribute("href") === replacement) return;
    anchor.setAttribute("href", replacement);
    if (replacement.startsWith("#")) {
      anchor.removeAttribute("target");
      anchor.setAttribute("aria-disabled", "true");
      anchor.setAttribute("title", "Disabled in example preview");
    }
  });
}

/**
 * Private-preview safety net. Presentation components can be reused exactly as
 * shipped while all nested member writes and protected-route exits remain
 * isolated from real accounts.
 */
export function PreviewNavigationGuard() {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>("main.memberDashboard.marketingRealMemberPreview");
    if (!root) return;

    rewritePreviewLinks(root);
    const observer = new MutationObserver(() => rewritePreviewLinks(root));
    observer.observe(root, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["href"],
    });

    const preventSubmit = (event: Event) => {
      const form = event.target instanceof HTMLFormElement ? event.target : null;
      if (!form || !root.contains(form)) return;
      event.preventDefault();
      event.stopPropagation();
      window.location.hash = "preview-navigation-note";
    };
    root.addEventListener("submit", preventSubmit, true);

    return () => {
      observer.disconnect();
      root.removeEventListener("submit", preventSubmit, true);
    };
  }, []);

  return null;
}
