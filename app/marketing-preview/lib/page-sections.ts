export const MARKETING_PREVIEW_PAGES = [
  {
    id: "dashboard",
    label: "Dashboard",
    eyebrow: "MEMBER DASHBOARD · EXAMPLE",
    title: "Today's command centre",
  },
  {
    id: "brief",
    label: "Morning Brief",
    eyebrow: "MORNING BRIEF · EXAMPLE EDITION",
    title: "Prepare with a clear plan",
  },
  {
    id: "terminal",
    label: "Trading Desk",
    eyebrow: "TRADING DESK · EXAMPLE WORKSPACE",
    title: "Follow the evidence in one place",
  },
  {
    id: "ideas",
    label: "Ideas",
    eyebrow: "IDEAS HUB · EXAMPLE BOARD",
    title: "Capture, challenge and review ideas",
  },
  {
    id: "reviews",
    label: "Reviews",
    eyebrow: "REVIEWS · EXAMPLE LIBRARY",
    title: "Learn from every session",
  },
  {
    id: "profile",
    label: "Profile",
    eyebrow: "MEMBER PROFILE · EXAMPLE ACCOUNT",
    title: "Membership and account centre",
  },
  {
    id: "preferences",
    label: "Preferences",
    eyebrow: "PREFERENCES · EXAMPLE SETTINGS",
    title: "Make Bullseye work your way",
  },
] as const;

export type MarketingPreviewPageId = (typeof MARKETING_PREVIEW_PAGES)[number]["id"];

export function resolveMarketingPreviewPage(value: string | string[] | null | undefined): MarketingPreviewPageId {
  const candidate = Array.isArray(value) ? value[0] : value;
  return MARKETING_PREVIEW_PAGES.some((page) => page.id === candidate)
    ? (candidate as MarketingPreviewPageId)
    : "dashboard";
}

export function getMarketingPreviewPage(id: MarketingPreviewPageId) {
  return MARKETING_PREVIEW_PAGES.find((page) => page.id === id) ?? MARKETING_PREVIEW_PAGES[0];
}
