/**
 * Customer-facing data-health summary derived from verified freshness feeds.
 */

export type DataHealthState = "healthy-delayed" | "partial" | "degraded" | "unavailable";

export type DataHealthFeed = {
  id: string;
  label: string;
  status: "LIVE" | "DELAYED" | "STALE" | "UNAVAILABLE" | "PREVIOUS_SESSION" | "MARKET_CLOSED";
  ageLabel: string;
  detail: string;
};

export type DataHealthSummary = {
  state: DataHealthState;
  headline: string;
  detail: string;
  esUsable: boolean;
  supportingIncomplete: boolean;
  oldestImportantLabel: string | null;
  unavailableSources: string[];
};

const SUPPORTING_IDS = new Set(["VIX", "DXY", "US10Y", "calendar", "vix", "dxy", "us10y"]);

function isUsable(status: DataHealthFeed["status"]): boolean {
  return status === "LIVE" || status === "DELAYED" || status === "MARKET_CLOSED" || status === "PREVIOUS_SESSION";
}

function isStaleOrMissing(status: DataHealthFeed["status"]): boolean {
  return status === "STALE" || status === "UNAVAILABLE";
}

export function buildDataHealthSummary(feeds: readonly DataHealthFeed[]): DataHealthSummary {
  const snapshot = feeds.find((feed) => feed.id === "snapshot");
  const esCandle = feeds.find((feed) => /es/i.test(feed.id) && /candle/i.test(feed.label));
  const esUsable = Boolean(
    (snapshot && isUsable(snapshot.status)) || (esCandle && isUsable(esCandle.status)),
  );

  const supporting = feeds.filter(
    (feed) =>
      SUPPORTING_IDS.has(feed.id) ||
      /vix|dxy|10.?year|calendar/i.test(`${feed.id} ${feed.label}`),
  );
  const unavailableSources = feeds
    .filter((feed) => feed.status === "UNAVAILABLE")
    .map((feed) => feed.label);
  const supportingIncomplete = supporting.some((feed) => isStaleOrMissing(feed.status));

  const important = [snapshot, esCandle, ...supporting].filter(Boolean) as DataHealthFeed[];
  const oldest = important
    .filter((feed) => feed.status === "STALE" || feed.status === "PREVIOUS_SESSION")
    .sort((left, right) => right.ageLabel.localeCompare(left.ageLabel))[0];

  if (!esUsable && unavailableSources.length >= Math.max(1, feeds.length - 1)) {
    return {
      state: "unavailable",
      headline: "Primary market unavailable",
      detail: "No trustworthy primary ES context is available for educational review.",
      esUsable: false,
      supportingIncomplete: true,
      oldestImportantLabel: oldest?.ageLabel ?? null,
      unavailableSources,
    };
  }

  if (!esUsable || snapshot?.status === "STALE" || esCandle?.status === "STALE") {
    return {
      state: "degraded",
      headline: "Degraded verified coverage",
      detail: "Primary market evidence is stale or incomplete beyond the accepted delayed window.",
      esUsable,
      supportingIncomplete,
      oldestImportantLabel: oldest?.ageLabel ?? snapshot?.ageLabel ?? null,
      unavailableSources,
    };
  }

  if (supportingIncomplete || unavailableSources.length > 0) {
    return {
      state: "partial",
      headline: supportingIncomplete ? "Supporting markets stale" : "Partial delayed coverage",
      detail: "ES remains usable for educational review, but one or more supporting inputs are stale or unavailable.",
      esUsable: true,
      supportingIncomplete: true,
      oldestImportantLabel: oldest?.ageLabel ?? null,
      unavailableSources,
    };
  }

  return {
    state: "healthy-delayed",
    headline: "Verified delayed coverage",
    detail: "Primary market and required supporting inputs are available within accepted delayed thresholds.",
    esUsable: true,
    supportingIncomplete: false,
    oldestImportantLabel: null,
    unavailableSources: [],
  };
}
