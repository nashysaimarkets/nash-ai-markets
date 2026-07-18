import Image from "next/image";
import Link from "next/link";

export function BrandLogo({ compact = false, authenticated = false, className = "" }: {
  compact?: boolean;
  authenticated?: boolean;
  className?: string;
}) {
  return <Link href={authenticated ? "/dashboard" : "/"} className={`brandLogo ${compact ? "brandLogoCompact" : ""} ${className}`.trim()} aria-label={authenticated ? "NASH AI Markets member dashboard" : "NASH AI Markets home"}>
    <Image src={compact ? "/brand/logo-mark.svg" : "/brand/logo-horizontal.svg"} width={compact ? 42 : 210} height={compact ? 42 : 36} alt="NASH AI Markets" priority />
  </Link>;
}
