export function BrandLoader({ label = "Loading NASH AI Markets" }: { label?: string }) {
  return (
    <div className="brandLoader" role="status" aria-label={label}>
      <span className="brandLoaderMark" aria-hidden="true">
        <i />
      </span>
      <span>{label}</span>
    </div>
  );
}
