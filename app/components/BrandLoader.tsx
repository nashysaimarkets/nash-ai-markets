import { BrandLogo } from "./BrandLogo.tsx";

export function BrandLoader({ label = "Loading NASH AI Markets" }: { label?: string }) {
  return (
    <div className="brandLoader" role="status" aria-label={label}>
      <BrandLogo />
      <span>{label}</span>
    </div>
  );
}
