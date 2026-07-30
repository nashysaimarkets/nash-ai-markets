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
