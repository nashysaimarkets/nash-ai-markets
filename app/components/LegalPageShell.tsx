import Link from "next/link";
import type { ReactNode } from "react";
import { BrandLogo } from "./BrandLogo";

export function LegalPageShell({ children }: { children: ReactNode }) {
  return <main className="legal">
    <header className="legalNav">
      <BrandLogo />
      <Link href="/">Back to overview</Link>
    </header>
    <article>{children}</article>
    <footer className="legalFooter">
      <span>© 2026 NASH AI Markets</span>
      <nav aria-label="Legal and support">
        <Link href="/privacy">Privacy</Link>
        <Link href="/terms">Terms</Link>
        <Link href="/risk-disclaimer">Risk</Link>
        <Link href="/contact">Contact</Link>
      </nav>
    </footer>
  </main>;
}
