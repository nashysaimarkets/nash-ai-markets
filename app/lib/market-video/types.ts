/**
 * Normalized published market video records for member surfaces.
 * Presentation only — never invents titles, dates or publication status.
 */

export type MarketVideoType = "PRE_MARKET" | "POST_MARKET";

export type MarketVideoStatus = "published" | "scheduled" | "unavailable";

export type MarketVideoRecord = {
  id: string;
  youtubeVideoId: string;
  type: MarketVideoType;
  marketDate: string;
  title: string;
  /** Customer-facing short summary (alias of description when summary omitted). */
  summary: string;
  description: string;
  publishedAt: string;
  durationSeconds: number | null;
  thumbnailUrl: string;
  watchUrl: string;
  embedUrl: string;
  status: MarketVideoStatus;
  source: "youtube";
  verifiedAt: string;
  /**
   * Operator-published highlights, capped at three. Never generated or inferred
   * from market data — absent unless the manifest supplies them, in which case
   * the surfaces simply omit the section.
   */
  keyTakeaways?: string[];
  /**
   * Opening excerpt of the published transcript, when the operator supplies one.
   * A preview only; it is never assembled from the video or from market inputs.
   */
  transcriptPreview?: string;
};

export type MarketVideoSelection =
  | { available: true; video: MarketVideoRecord }
  | {
      available: false;
      reason: string;
      type: MarketVideoType;
      marketDate: string;
    };

export type PublishedMarketVideoManifest = {
  schemaVersion: 1;
  source: string;
  note?: string;
  videos: Array<Partial<MarketVideoRecord> & Record<string, unknown>>;
};
