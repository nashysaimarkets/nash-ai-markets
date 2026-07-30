/**
 * Shared Includes line for grouped verified catalysts (Dashboard / Brief / Desk).
 */

type IncludeItem = { name: string } | string;

function labels(includes: readonly IncludeItem[]): string[] {
  return includes.map((item) => (typeof item === "string" ? item : item.name)).filter(Boolean);
}

export function VerifiedCatalystIncludes({
  includes,
  variant = "inline",
  className = "deskCatalystIncludes",
}: {
  includes: readonly IncludeItem[];
  variant?: "inline" | "details";
  className?: string;
}) {
  const parts = labels(includes);
  if (!parts.length) return null;

  if (variant === "details") {
    return (
      <details className={className}>
        <summary>
          Includes: {parts.join(" · ")}
        </summary>
        <ul>
          {parts.map((name) => (
            <li key={name}>{name}</li>
          ))}
        </ul>
      </details>
    );
  }

  return <p className={className}>Includes: {parts.join(" · ")}</p>;
}
