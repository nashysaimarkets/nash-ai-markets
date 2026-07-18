import Link from "next/link";

type BrandLogoProps = {
  audience?: "public" | "member";
  className?: string;
  compactOnMobile?: boolean;
  context?: "markets" | "bullseye" | "launch";
  href?: string;
};

const wordmarks = {
  markets: <span>NASH <b>AI</b> MARKETS</span>,
  bullseye: <span>NASH <b>AI</b> / BULLSEYE</span>,
  launch: <span>NASH <b>AI</b> / OPERATION LAUNCH</span>,
} as const;

export function BrandLogo({
  audience = "public",
  className = "",
  compactOnMobile = false,
  context = "markets",
  href,
}: BrandLogoProps) {
  const destination = href ?? (audience === "member" ? "/dashboard" : "/");
  return <Link
    href={destination}
    className={`brandLogo brandLogo-${context} ${className}`.trim()}
    data-mobile-compact={compactOnMobile}
    aria-label={audience === "member" ? "NASH AI Markets member dashboard" : "NASH AI Markets home"}
  >
    <span className="brandLogoMark" aria-hidden="true"><i /></span>
    <span className="brandLogoWordmark">{wordmarks[context]}</span>
  </Link>;
}
