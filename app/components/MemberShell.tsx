import Link from "next/link";
import type { ReactNode } from "react";
import { BrandLogo } from "./BrandLogo";
import { PwaController } from "./PwaController";
import { BullseyeLoginSting } from "./BullseyeLoginSting";
import { SmileyEasterEgg } from "./SmileyEasterEgg";
import { MemberMobileMenu } from "./MemberMobileMenu";
import { PreviewNavigationGuard } from "../marketing-preview/components/PreviewNavigationGuard.tsx";

export type MemberShellActive =
  | "dashboard"
  | "brief"
  | "terminal"
  | "ideas"
  | "profile"
  | "onboarding"
  | "review"
  | "archive"
  | "journal"
  | "performance"
  | "results"
  | "replay"
  | "methodology";

type MemberShellProps = {
  active: MemberShellActive;
  children: ReactNode;
  className?: string;
  toolbar?: ReactNode;
  /** Explicitly isolate navigation inside the private marketing walkthrough. */
  previewMode?: boolean;
};

/** Primary signed-in destinations shown in customer navigation. */
const links = [
  { href: "/dashboard", label: "Dashboard", key: "dashboard", previewView: "dashboard" },
  { href: "/brief", label: "Morning Brief", key: "brief", previewView: "brief" },
  { href: "/terminal", label: "Trading Desk", key: "terminal", previewView: "terminal" },
  { href: "/ideas", label: "Ideas", key: "ideas", previewView: "ideas" },
  { href: "/reviews", label: "Reviews", key: "review", previewView: "reviews" },
  { href: "/profile", label: "Profile", key: "profile", previewView: "profile" },
  { href: "/preferences", label: "Preferences", key: "onboarding", previewView: "preferences" },
] as const;

/**
 * Unfinished workspace destinations retained for direct deep-links
 * (e.g. Risk & Journal from Morning Brief). Not advertised in More until ready.
 */
export const unfinishedWorkspaceLinks = [
  { href: "/review", label: "Review", key: "review" },
  { href: "/archive", label: "Archive", key: "archive" },
  { href: "/journal", label: "Journal", key: "journal" },
  { href: "/performance", label: "Performance", key: "performance" },
  { href: "/results", label: "Results", key: "results" },
  { href: "/replay", label: "Replay", key: "replay" },
  { href: "/methodology", label: "Methodology", key: "methodology" },
] as const;

export function MemberShell({
  active,
  children,
  className = "",
  toolbar,
  previewMode,
}: MemberShellProps) {
  // Existing private preview surfaces already carry this class. Auto-detection
  // prevents any future preview page from accidentally linking into real member
  // actions even if the explicit prop is omitted.
  const isolatedPreview = previewMode ?? className.split(/\s+/).includes("marketingRealMemberPreview");
  const resolveHref = (link: (typeof links)[number]) =>
    isolatedPreview ? `/marketing-preview?view=${link.previewView}` : link.href;

  return (
    <main className={`memberDashboard ${className}`.trim()}>
      {isolatedPreview ? <PreviewNavigationGuard /> : null}
      <a className="memberSkipLink" href="#member-content">
        Skip to member content
      </a>
      <header className="memberDashboardNav">
        <BrandLogo authenticated
          className="memberBrandLogo"
          href={isolatedPreview ? "/marketing-preview" : undefined}
        />
        <BullseyeLoginSting />
        <nav aria-label="Member navigation">
          {links.map((link) => (
            <Link
              key={link.key}
              href={resolveHref(link)}
              aria-current={active === link.key ? "page" : undefined}
            >
              {link.label}
            </Link>
          ))}
          {isolatedPreview ? (
            <a href="#preview-navigation-note" aria-disabled="true" title="Disabled in example preview">
              Sign out
            </a>
          ) : (
            <a href="/auth/signout">Sign out</a>
          )}
        </nav>
        <MemberMobileMenu key={`${active}:${isolatedPreview ? "preview" : "member"}`}>
          <nav aria-label="Mobile member navigation">
            {links.map((link) => (
              <Link
                key={link.key}
                href={resolveHref(link)}
                aria-current={active === link.key ? "page" : undefined}
              >
                {link.label}
                <span aria-hidden="true">↗</span>
              </Link>
            ))}
            {isolatedPreview ? (
              <a href="#preview-navigation-note" aria-disabled="true" title="Disabled in example preview">
                Sign out
                <span aria-hidden="true">↗</span>
              </a>
            ) : (
              <a href="/auth/signout">
                Sign out
                <span aria-hidden="true">↗</span>
              </a>
            )}
          </nav>
        </MemberMobileMenu>
      </header>
      {toolbar ? (
        <div className="memberToolbar" role="toolbar" aria-label="Page tools">
          {toolbar}
        </div>
      ) : null}
      <div id="member-content">{children}</div>
      {isolatedPreview ? (
        <span id="preview-navigation-note" hidden>
          Example preview only. No member session action is available.
        </span>
      ) : null}
      <SmileyEasterEgg />
      <PwaController />
    </main>
  );
}
