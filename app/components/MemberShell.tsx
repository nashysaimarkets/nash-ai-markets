import Link from "next/link";
import type { ReactNode } from "react";
import { BrandLogo } from "./BrandLogo";
import { PresentationModeToggle } from "./PresentationModeToggle";
import { PwaController } from "./PwaController";

export type MemberShellActive =
  | "dashboard"
  | "brief"
  | "terminal"
  | "ideas"
  | "profile"
  | "onboarding"
  | "review"
  | "archive"
  | "options"
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

const links = [
  { href: "/dashboard", label: "Dashboard", key: "dashboard" },
  { href: "/brief", label: "Market brief", key: "brief" },
  { href: "/terminal", label: "Terminal", key: "terminal" },
  { href: "/ideas", label: "Ideas", key: "ideas" },
  { href: "/profile", label: "Profile", key: "profile" },
  { href: "/onboarding", label: "Preferences", key: "onboarding" },
] as const;

const moreLinks = [
  { href: "/review", label: "Review", key: "review" },
  { href: "/archive", label: "Archive", key: "archive" },
  { href: "/options", label: "Options", key: "options" },
  { href: "/journal", label: "Journal", key: "journal" },
  { href: "/performance", label: "Performance", key: "performance" },
  { href: "/results", label: "Results", key: "results" },
  { href: "/replay", label: "Replay", key: "replay" },
  { href: "/methodology", label: "Methodology", key: "methodology" },
] as const;

const moreActive = new Set<MemberShellActive>(moreLinks.map((link) => link.key));

export function MemberShell({ active, children, className = "", toolbar }: MemberShellProps) {
  const moreOpen = moreActive.has(active);

  return <main className={`memberDashboard ${className}`.trim()}>
    <a className="memberSkipLink" href="#member-content">Skip to member content</a>
    <header className="memberDashboardNav">
      <BrandLogo authenticated className="memberBrandLogo" />
      <nav aria-label="Member navigation">
        {links.map((link) => <Link key={link.key} href={link.href} aria-current={active === link.key ? "page" : undefined}>{link.label}</Link>)}
        <details className="memberMoreMenu">
          <summary aria-current={moreOpen ? "page" : undefined}>More</summary>
          <div className="memberMorePanel" role="group" aria-label="Workspace">
            <span className="memberMoreLabel">Workspace</span>
            {moreLinks.map((link) => <Link key={link.key} href={link.href} aria-current={active === link.key ? "page" : undefined}>{link.label}</Link>)}
          </div>
        </details>
        <PresentationModeToggle />
        <a href="/auth/signout">Sign out</a>
      </nav>
      <details className="memberMobileMenu">
        <summary aria-label="Open member navigation">
          <span>Menu</span>
          <i aria-hidden="true" />
        </summary>
        <nav aria-label="Mobile member navigation">
          {links.map((link) => <Link key={link.key} href={link.href} aria-current={active === link.key ? "page" : undefined}>{link.label}<span aria-hidden="true">↗</span></Link>)}
          <span className="memberMoreLabel">Workspace</span>
          {moreLinks.map((link) => <Link key={link.key} href={link.href} aria-current={active === link.key ? "page" : undefined}>{link.label}<span aria-hidden="true">↗</span></Link>)}
          <PresentationModeToggle />
          <a href="/auth/signout">Sign out<span aria-hidden="true">↗</span></a>
        </nav>
      </details>
    </header>
    {toolbar ? <div className="memberToolbar" role="toolbar" aria-label="Page tools">{toolbar}</div> : null}
    <div id="member-content">{children}</div>
    <PwaController />
  </main>;
}
