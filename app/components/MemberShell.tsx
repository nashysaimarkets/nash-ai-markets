import Link from "next/link";
import type { ReactNode } from "react";
import { DashboardBrand } from "../dashboard/components/DashboardBrand.tsx";
import { BrandLogo } from "./BrandLogo.tsx";

type MemberShellProps = {
  active: "dashboard" | "brief" | "terminal" | "profile" | "onboarding";
  children: ReactNode;
  className?: string;
};

const links = [
  { href: "/dashboard", label: "Dashboard", key: "dashboard" },
  { href: "/brief", label: "Market brief", key: "brief" },
  { href: "/terminal", label: "Terminal", key: "terminal" },
  { href: "/profile", label: "Profile", key: "profile" },
  { href: "/onboarding", label: "Preferences", key: "onboarding" },
] as const;

export function MemberShell({ active, children, className = "" }: MemberShellProps) {
  return <main className={`memberDashboard ${className}`.trim()}>
    <a className="memberSkipLink" href="#member-content">Skip to member content</a>
    <header className="memberDashboardNav">
      {active === "dashboard" ? <DashboardBrand /> : <BrandLogo audience="member" context="bullseye" compactOnMobile />}
      <nav aria-label="Member navigation">
        {links.map((link) => <Link key={link.key} href={link.href} aria-current={active === link.key ? "page" : undefined}>{link.label}</Link>)}
        <Link href="/auth/signout">Sign out</Link>
      </nav>
      <details className="memberMobileMenu">
        <summary aria-label="Open member navigation">
          <span>Menu</span>
          <i aria-hidden="true" />
        </summary>
        <nav aria-label="Mobile member navigation">
          {links.map((link) => <Link key={link.key} href={link.href} aria-current={active === link.key ? "page" : undefined}>{link.label}<span aria-hidden="true">↗</span></Link>)}
          <Link href="/auth/signout">Sign out<span aria-hidden="true">↗</span></Link>
        </nav>
      </details>
    </header>
    <div id="member-content">{children}</div>
  </main>;
}
