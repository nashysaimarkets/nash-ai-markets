import Link from "next/link";
import type { ReactNode } from "react";

type MemberShellProps = {
  active: "dashboard" | "brief" | "terminal" | "profile";
  children: ReactNode;
  className?: string;
};

const links = [
  { href: "/dashboard", label: "Dashboard", key: "dashboard" },
  { href: "/brief", label: "Market brief", key: "brief" },
  { href: "/terminal", label: "Terminal", key: "terminal" },
  { href: "/profile", label: "Profile", key: "profile" },
] as const;

export function MemberShell({ active, children, className = "" }: MemberShellProps) {
  return <main className={`memberDashboard ${className}`.trim()}>
    <header className="memberDashboardNav">
      <Link href="/dashboard" className="ftBrand">
        <span className="ftReticle" aria-hidden="true" />
        <span>NASH <b>AI</b> / BULLSEYE</span>
      </Link>
      <nav aria-label="Member navigation">
        {links.map((link) => <Link key={link.key} href={link.href} aria-current={active === link.key ? "page" : undefined}>{link.label}</Link>)}
        <Link href="/auth/signout">Sign out</Link>
      </nav>
    </header>
    {children}
  </main>;
}
