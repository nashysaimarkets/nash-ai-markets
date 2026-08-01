import type { MarketDataStatus } from "../../lib/market-data.ts";
import type { MarketCoverage } from "../../lib/markets/market-catalog.ts";

export type DeskFeedTone = "positive" | "warning" | "info" | "neutral";

export type DeskFeedStatus = {
  label: string;
  tone: DeskFeedTone;
  detail: string;
};

/**
 * Coverage is a static catalogue capability ("we support this market") while
 * snapshot status is a runtime reading ("we have data right now"). Rendering
 * them as two adjacent badges produced contradictions such as UNAVAILABLE
 * sitting beside Connected. Collapsing both into a single statement keeps the
 * desk honest about what is actually available.
 */
export function resolveDeskFeedStatus(input: {
  coverage: MarketCoverage;
  status: MarketDataStatus;
}): DeskFeedStatus {
  if (input.coverage === "proxy") {
    return {
      label: "AWAITING VERIFIED SNAPSHOT",
      tone: "info",
      detail:
        "This market is listed, but no verified provider feed is connected for it yet. No price is inferred.",
    };
  }

  if (input.coverage === "awaiting") {
    return {
      label: "COVERAGE COMING SOON",
      tone: "info",
      detail:
        "Coverage for this market has not been connected yet. It will appear once a verified feed is available.",
    };
  }

  switch (input.status) {
    case "LIVE":
      return {
        label: "CONNECTED · LIVE",
        tone: "positive",
        detail: "Verified provider feed is connected and current.",
      };
    case "DELAYED":
      return {
        label: "CONNECTED · DELAYED",
        tone: "positive",
        detail:
          "Verified provider feed is connected. Readings are delayed, so treat them as aged rather than live.",
      };
    case "PREVIEW":
      return {
        label: "AWAITING VERIFIED SNAPSHOT",
        tone: "info",
        detail:
          "No verified snapshot has been received for this market yet. No directional conclusion has been produced.",
      };
    case "UNAVAILABLE":
      return {
        label: "DATA PROVIDER UNAVAILABLE",
        tone: "warning",
        detail:
          "The verified provider feed could not be reached. Nothing has been inferred from the failure.",
      };
  }
}
