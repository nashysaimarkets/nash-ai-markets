/**
 * Project Bullseye visual + functional audit configuration.
 * Credentials are never hard-coded — read AUDIT_* env only.
 */

export const AUDIT_OUTPUT_DIR = "audit-output";
export const STORAGE_STATE_PATH = "audit-output/.auth/storage-state.json";

export const VIEWPORTS = [
  { id: "desktop-1440", label: "Desktop 1440×900", width: 1440, height: 900, group: "desktop" },
  { id: "desktop-1280", label: "Desktop 1280×800", width: 1280, height: 800, group: "desktop" },
  { id: "tablet-1024", label: "Tablet 1024×768", width: 1024, height: 768, group: "tablet" },
  { id: "mobile-390", label: "Mobile 390×844", width: 390, height: 844, group: "mobile" },
  { id: "mobile-375", label: "Mobile 375×667", width: 375, height: 667, group: "mobile" },
] as const;

export type ViewportSpec = (typeof VIEWPORTS)[number];

export type RouteSpec = {
  path: string;
  id: string;
  auth: boolean;
  folder: string;
  label: string;
  /** Skip heavy interaction suites on simple legal pages */
  interactions?: boolean;
};

export const PUBLIC_ROUTES: RouteSpec[] = [
  { path: "/", id: "home", auth: false, folder: "public", label: "Home", interactions: true },
  { path: "/methodology", id: "method", auth: false, folder: "public", label: "Method / Methodology" },
  { path: "/pricing", id: "membership", auth: false, folder: "public", label: "Membership / Pricing", interactions: true },
  { path: "/login", id: "login", auth: false, folder: "public", label: "Login" },
  { path: "/privacy", id: "privacy", auth: false, folder: "public", label: "Privacy" },
  { path: "/terms", id: "terms", auth: false, folder: "public", label: "Terms" },
  { path: "/risk-disclaimer", id: "risk-disclosure", auth: false, folder: "public", label: "Risk disclosure" },
  { path: "/contact", id: "contact", auth: false, folder: "public", label: "Contact" },
  { path: "/help", id: "help", auth: false, folder: "public", label: "Help / FAQ" },
  { path: "/about", id: "about", auth: false, folder: "public", label: "About" },
  { path: "/waitlist", id: "waitlist", auth: false, folder: "public", label: "Waitlist" },
  { path: "/founding-member", id: "founding-member", auth: false, folder: "public", label: "Founding member" },
];

export const MEMBER_ROUTES: RouteSpec[] = [
  { path: "/dashboard", id: "dashboard", auth: true, folder: "dashboard", label: "Dashboard", interactions: true },
  { path: "/brief", id: "brief", auth: true, folder: "brief", label: "Morning Brief", interactions: true },
  { path: "/terminal", id: "terminal", auth: true, folder: "terminal", label: "Trading Desk", interactions: true },
  { path: "/ideas", id: "ideas", auth: true, folder: "ideas", label: "Ideas", interactions: true },
  { path: "/profile", id: "profile", auth: true, folder: "profile", label: "Profile", interactions: true },
  { path: "/preferences", id: "preferences", auth: true, folder: "preferences", label: "Preferences", interactions: true },
  { path: "/review", id: "review", auth: true, folder: "review", label: "Review (deep-link)" },
  { path: "/archive", id: "archive", auth: true, folder: "archive", label: "Archive (deep-link)" },
  { path: "/journal", id: "journal", auth: true, folder: "journal", label: "Journal (deep-link)" },
  { path: "/performance", id: "performance", auth: true, folder: "performance", label: "Performance (deep-link)" },
  { path: "/results", id: "results", auth: true, folder: "results", label: "Results (deep-link)" },
  { path: "/replay", id: "replay", auth: true, folder: "replay", label: "Replay (deep-link)" },
  { path: "/methodology", id: "member-methodology", auth: true, folder: "methodology", label: "Methodology (member)" },
];

export const CONSISTENCY_ROUTES = ["/dashboard", "/brief", "/terminal"] as const;

export function resolveBaseUrl(): string {
  const raw =
    process.env.AUDIT_BASE_URL?.trim() ||
    process.env.PLAYWRIGHT_BASE_URL?.trim() ||
    "https://nash-ai-markets-git-feature-morning-brie-3c2717-nash-ai-markets.vercel.app";
  return raw.replace(/\/$/, "");
}

export function auditCredentialsPresent(): { email: boolean; password: boolean } {
  return {
    email: Boolean(process.env.AUDIT_USER_EMAIL?.trim()),
    password: Boolean(process.env.AUDIT_USER_PASSWORD?.trim()),
  };
}
