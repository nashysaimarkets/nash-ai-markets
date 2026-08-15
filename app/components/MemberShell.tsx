import Link from "next/link";
import type { ReactNode } from "react";
import { BrandLogo } from "./BrandLogo";
import { PwaController } from "./PwaController";
import { BullseyeLoginSting } from "./BullseyeLoginSting";

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
};

/** Primary signed-in destinations shown in customer navigation. */
const links = [
  { href: "/dashboard", label: "Dashboard", key: "dashboard" },
  { href: "/brief", label: "Morning Brief", key: "brief" },
  { href: "/terminal", label: "Trading Desk", key: "terminal" },
  { href: "/ideas", label: "Ideas", key: "ideas" },
  { href: "/reviews", label: "Reviews", key: "review" },
  { href: "/profile", label: "Profile", key: "profile" },
  { href: "/preferences", label: "Preferences", key: "onboarding" },
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

export function MemberShell({ active, children, className = "", toolbar }: MemberShellProps) {
  return (
    <main className={`memberDashboard ${className}`.trim()}>
      <a className="memberSkipLink" href="#member-content">
        Skip to member content
      </a>
      <header className="memberDashboardNav">
        <BrandLogo authenticated className="memberBrandLogo" />
        <BullseyeLoginSting />
        <nav aria-label="Member navigation">
          {links.map((link) => (
            <Link
              key={link.key}
              href={link.href}
              aria-current={active === link.key ? "page" : undefined}
            >
              {link.label}
            </Link>
          ))}
          <a href="/auth/signout">Sign out</a>
        </nav>
        <details className="memberMobileMenu">
          <summary aria-label="Open member navigation">
            <span>Menu</span>
            <i aria-hidden="true" />
          </summary>
          <nav aria-label="Mobile member navigation">
            {links.map((link) => (
              <Link
                key={link.key}
                href={link.href}
                aria-current={active === link.key ? "page" : undefined}
              >
                {link.label}
                <span aria-hidden="true">↗</span>
              </Link>
            ))}
            <a href="/auth/signout">
              Sign out
              <span aria-hidden="true">↗</span>
            </a>
          </nav>
        </details>
      </header>
      {toolbar ? (
        <div className="memberToolbar" role="toolbar" aria-label="Page tools">
          {toolbar}
        </div>
      ) : null}
      <div id="member-content">{children}</div>
      <PwaController />
    </main>
  );
}
