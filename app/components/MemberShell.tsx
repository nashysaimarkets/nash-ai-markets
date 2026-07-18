import Link from "next/link";
import type { ReactNode } from "react";
import { BrandLogo } from "./BrandLogo";

type MemberShellProps = {
  active: "dashboard" | "brief" | "terminal" | "ideas" | "profile" | "onboarding";
  children: ReactNode;
  className?: string;
};

const links = [
  { href: "/dashboard", label: "Dashboard", key: "dashboard" },
  { href: "/brief", label: "Market brief", key: "brief" },
  { href: "/terminal", label: "Terminal", key: "terminal" },
  { href: "/ideas", label: "Ideas", key: "ideas" },
  { href: "/profile", label: "Profile", key: "profile" },
  { href: "/onboarding", label: "Preferences", key: "onboarding" },
] as const;

export function MemberShell({ active, children, className = "" }: MemberShellProps) {
  return <main className={`memberDashboard ${className}`.trim()}>
    <a className="memberSkipLink" href="#member-content">Skip to member content</a>
    <header className="memberDashboardNav">
      <BrandLogo authenticated className="memberBrandLogo" />
      <nav aria-label="Member navigation">
        {links.map((link) => <Link key={link.key} href={link.href} aria-current={active === link.key ? "page" : undefined}>{link.label}</Link>)}
        <a href="/auth/signout">Sign out</a>
      </nav>
      <details className="memberMobileMenu">
        <summary aria-label="Open member navigation">
          <span>Menu</span>
          <i aria-hidden="true" />
        </summary>
        <nav aria-label="Mobile member navigation">
          {links.map((link) => <Link key={link.key} href={link.href} aria-current={active === link.key ? "page" : undefined}>{link.label}<span aria-hidden="true">↗</span></Link>)}
          <a href="/auth/signout">Sign out<span aria-hidden="true">↗</span></a>
        </nav>
      </details>
    </header>
    <div id="member-content">{children}</div>
  </main>;
}
