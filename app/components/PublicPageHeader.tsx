import Link from "next/link";
import { BrandLogo } from "./BrandLogo.tsx";

type PublicPageHeaderProps = {
  active?: "about" | "help" | "contact";
};

export function PublicPageHeader({ active }: PublicPageHeaderProps) {
  return (
    <header className="publicPageHeader">
      <BrandLogo />
      <nav aria-label="Public navigation">
        <Link href="/pricing">Pricing</Link>
        <Link href="/about" aria-current={active === "about" ? "page" : undefined}>About</Link>
        <Link href="/help" aria-current={active === "help" ? "page" : undefined}>Help</Link>
        <Link href="/contact" aria-current={active === "contact" ? "page" : undefined}>Contact</Link>
        <Link className="publicPageSignIn" href="/login">Sign in</Link>
      </nav>
    </header>
  );
}
