import type { MarketVideoRecord, MarketVideoStatus, MarketVideoType } from "./types.ts";

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;
const MARKET_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidYoutubeVideoId(value: string): boolean {
  return YOUTUBE_ID.test(value.trim());
}

export function privacyEnhancedEmbedUrl(youtubeVideoId: string): string | null {
  const id = youtubeVideoId.trim();
  if (!isValidYoutubeVideoId(id)) return null;
  return `https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1`;
}

export function watchOnYoutubeUrl(youtubeVideoId: string): string | null {
  const id = youtubeVideoId.trim();
  if (!isValidYoutubeVideoId(id)) return null;
  return `https://www.youtube.com/watch?v=${id}`;
}

export function youtubeThumbnailUrl(youtubeVideoId: string): string | null {
  const id = youtubeVideoId.trim();
  if (!isValidYoutubeVideoId(id)) return null;
  return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
}

function isVideoType(value: unknown): value is MarketVideoType {
  return value === "PRE_MARKET" || value === "POST_MARKET";
}

function isVideoStatus(value: unknown): value is MarketVideoStatus {
  return value === "published" || value === "scheduled" || value === "unavailable";
}

/** Validate and normalize an external video record before presentation. */
export function normalizeMarketVideoRecord(raw: unknown): MarketVideoRecord | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const youtubeVideoId = typeof row.youtubeVideoId === "string" ? row.youtubeVideoId.trim() : "";
  if (!isValidYoutubeVideoId(youtubeVideoId)) return null;
  if (!isVideoType(row.type)) return null;
  const marketDate = typeof row.marketDate === "string" ? row.marketDate.trim() : "";
  if (!MARKET_DATE.test(marketDate)) return null;
  if (!isVideoStatus(row.status)) return null;
  const title = typeof row.title === "string" ? row.title.trim() : "";
  if (!title) return null;
  const publishedAt = typeof row.publishedAt === "string" ? row.publishedAt.trim() : "";
  if (!publishedAt || !Number.isFinite(Date.parse(publishedAt))) return null;
  const verifiedAt =
    typeof row.verifiedAt === "string" && Number.isFinite(Date.parse(row.verifiedAt))
      ? row.verifiedAt
      : publishedAt;
  const embedUrl = privacyEnhancedEmbedUrl(youtubeVideoId);
  const watchUrl = watchOnYoutubeUrl(youtubeVideoId);
  const thumbnailUrl =
    typeof row.thumbnailUrl === "string" && /^https:\/\/i\.ytimg\.com\//.test(row.thumbnailUrl)
      ? row.thumbnailUrl
      : youtubeThumbnailUrl(youtubeVideoId);
  if (!embedUrl || !watchUrl || !thumbnailUrl) return null;

  const durationSeconds =
    typeof row.durationSeconds === "number" && Number.isFinite(row.durationSeconds) && row.durationSeconds > 0
      ? Math.round(row.durationSeconds)
      : null;

  return {
    id: typeof row.id === "string" && row.id.trim() ? row.id.trim() : `${row.type}-${marketDate}-${youtubeVideoId}`,
    youtubeVideoId,
    type: row.type,
    marketDate,
    title,
    description: typeof row.description === "string" ? row.description.trim() : "",
    publishedAt,
    durationSeconds,
    thumbnailUrl,
    watchUrl,
    embedUrl,
    status: row.status,
    source: "youtube",
    verifiedAt,
  };
}
