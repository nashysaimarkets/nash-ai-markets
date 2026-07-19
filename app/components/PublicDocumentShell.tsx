import Link from "next/link";
import type { ReactNode } from "react";
import { BrandLogo } from "./BrandLogo";

type PublicDocumentShellProps = {
  eyebrow: string;
  title: string;
  description?: string;
  children: ReactNode;
};

export function PublicDocumentShell({
  eyebrow,
  title,
  description,
  children,
}: PublicDocumentShellProps) {
  return (
    <main className="publicDocument">
      <a className="mcSkip" href="#document-content">Skip to content</a>
      <header className="publicDocumentNav">
        <BrandLogo />
        <nav aria-label="Public navigation">
          <Link href="/#platform">Platform</Link>
          <Link href="/pricing">Membership</Link>
          <Link href="/help">Help</Link>
          <Link className="publicDocumentSignIn" href="/login">Member login</Link>
        </nav>
      </header>
      <section className="publicDocumentHero" id="document-content">
        <p>{eyebrow}</p>
        <h1>{title}</h1>
        {description ? <p>{description}</p> : null}
      </section>
      <article className="publicDocumentBody">{children}</article>
      <footer className="publicDocumentFooter">
        <BrandLogo />
        <nav aria-label="Legal and support">
          <Link href="/about">About</Link>
          <Link href="/contact">Contact</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/risk-disclaimer">Risk disclaimer</Link>
        </nav>
      </footer>
    </main>
  );
}
