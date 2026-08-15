import type { EconomicRelease, MacroObservation, VerifiedMacroContext } from "../lib/macro-data.ts";
import { MACRO_METRIC_LABELS } from "../lib/verified-macro-context.ts";

function statusLabel(status: VerifiedMacroContext["status"]): string {
  if (status === "complete") return "Verified";
  if (status === "partial") return "Partial";
  return "Unavailable";
}

function formatObservationValue(observation: MacroObservation): string {
  if (observation.value === null) return "Unavailable";
  const digits = observation.unit === "%" ? 2 : observation.unit === "index" || observation.unit === "JAN06=100" ? 2 : 1;
  return `${observation.value.toLocaleString("en-GB", { maximumFractionDigits: digits })}${observation.unit === "%" ? "%" : observation.unit === "index" || observation.unit === "JAN06=100" ? "" : ` ${observation.unit}`}`;
}

function formatReleaseWhen(release: EconomicRelease): string {
  const parsed = Date.parse(release.scheduledAt);
  if (!Number.isFinite(parsed)) return release.scheduledAt;
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/New_York",
    timeZoneName: "short",
  }).format(parsed);
}

export function VerifiedMacroContextPanel({
  context,
  variant = "dashboard",
}: {
  context: VerifiedMacroContext;
  variant?: "dashboard" | "brief" | "desk";
}) {
  const className = variant === "brief" ? "mbPanel verifiedMacroContext" : "verifiedMacroContext";
  const headlineObservations = context.observations.slice(0, 6);
  const upcomingReleases = context.releases.slice(0, 4);

  return (
    <section className={className} aria-labelledby={`${variant}-macro-context-title`}>
      <header>
        <span className={variant === "brief" ? "mbEyebrow" : "mccEyebrow"}>OFFICIAL MACRO CONTEXT</span>
        <h2 id={`${variant}-macro-context-title`}>Government data · informational only</h2>
        <p>
          Treasury yields, Fed funding rates, dollar context, official economic observations and release schedules.
          This layer never drives trade permission, confidence or ES/VIX decision logic.
        </p>
      </header>

      <div className="verifiedMacroContextBody">
        <div className="verifiedMacroContextStatus" data-status={context.status}>
          <span>Status</span>
          <strong>{statusLabel(context.status)}</strong>
          <small>
            {context.availableSources.length
              ? `Sources: ${context.availableSources.join(" · ")}`
              : "No official macro sources responded"}
          </small>
        </div>

        {headlineObservations.length ? (
          <ul className="verifiedMacroContextObservations" aria-label="Official macro observations">
            {headlineObservations.map((observation) => (
              <li key={observation.id}>
                <span>{MACRO_METRIC_LABELS[observation.metric] ?? observation.metric}</span>
                <strong>{formatObservationValue(observation)}</strong>
                <small>{observation.source.attribution}</small>
              </li>
            ))}
          </ul>
        ) : (
          <p className="verifiedMacroContextEmpty" role="status">
            No official macro observations are available right now.
          </p>
        )}

        {upcomingReleases.length ? (
          <ol className="verifiedMacroContextReleases" aria-label="Official release schedule">
            {upcomingReleases.map((release) => (
              <li key={release.id}>
                <time>{formatReleaseWhen(release)}</time>
                <strong>{release.name}</strong>
                <span>{release.agency}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="verifiedMacroContextEmpty" role="status">
            No official release schedule rows are available in the current window.
          </p>
        )}
      </div>

      {context.unavailableSources.length ? (
        <footer>
          <span>Not configured</span>
          <strong>{context.unavailableSources.join(" · ")}</strong>
        </footer>
      ) : null}
    </section>
  );
}
