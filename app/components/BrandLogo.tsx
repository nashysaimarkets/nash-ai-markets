import Image from "next/image";
import Link from "next/link";

type Props = {
  compact?: boolean;
  authenticated?: boolean;
  className?: string;
};

/**
 * Shared NASH AI Markets wordmark / mark.
 * Authenticated logos quietly reveal “Project BULLSEYE” on hover/focus.
 */
export function BrandLogo({ compact = false, authenticated = false, className = "" }: Props) {
  const href = authenticated ? "/dashboard" : "/";
  const label = authenticated ? "NASH AI Markets member dashboard" : "NASH AI Markets home";
  // ~55% larger than the previous 36px / 42px display sizes
  const width = compact ? 64 : 325;
  const height = compact ? 64 : 56;

  return (
    <Link
      href={href}
      className={`brandLogo ${compact ? "brandLogoCompact" : ""} ${authenticated ? "brandLogoAuth" : ""} ${className}`.trim()}
      aria-label={label}
      title="NASH AI Markets"
      data-project="bullseye"
    >
      <Image
        src={compact ? "/brand/logo-mark.svg" : "/brand/logo-horizontal.svg"}
        width={width}
        height={height}
        alt="NASH AI Markets"
        priority
      />
      {authenticated ? <span className="brandBullseyeReveal">Project BULLSEYE</span> : null}
    </Link>
  );
}
