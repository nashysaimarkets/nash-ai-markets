import type { MarketVideoRecord, MarketVideoSelection, MarketVideoType } from "./types.ts";
import { normalizeMarketVideoRecord } from "./validate.ts";

const NY_TZ = "America/New_York";

export function marketDateInNewYork(now: Date | number = new Date()): string {
  const stamp = typeof now === "number" ? new Date(now) : now;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: NY_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(stamp);
}

export function customerVideoTypeLabel(type: MarketVideoType): string {
  return type === "PRE_MARKET" ? "Pre-market video briefing" : "Post-market video review";
}

export function formatVideoDuration(seconds: number | null): string | null {
  if (seconds == null || !Number.isFinite(seconds) || seconds <= 0) return null;
  const total = Math.round(seconds);
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  if (mins >= 60) {
    const hours = Math.floor(mins / 60);
    const rem = mins % 60;
    return `${hours}h ${rem.toString().padStart(2, "0")}m`;
  }
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function publishedForDate(
  videos: readonly MarketVideoRecord[],
  type: MarketVideoType,
  marketDate: string,
): MarketVideoRecord | null {
  const matches = videos.filter(
    (video) =>
      video.status === "published" &&
      video.type === type &&
      video.marketDate === marketDate,
  );
  if (!matches.length) return null;
  return matches.sort((left, right) => Date.parse(right.publishedAt) - Date.parse(left.publishedAt))[0] ?? null;
}

/** Shared selector — exact market-date match only; never falls back to yesterday. */
export function getCurrentMarketVideo(input: {
  type: MarketVideoType;
  marketDate?: string;
  now?: Date | number;
  videos: readonly unknown[];
}): MarketVideoSelection {
  const now = input.now ?? Date.now();
  const marketDate = input.marketDate ?? marketDateInNewYork(now);
  const normalized = input.videos
    .map((row) => normalizeMarketVideoRecord(row))
    .filter((row): row is MarketVideoRecord => Boolean(row));

  const match = publishedForDate(normalized, input.type, marketDate);
  if (match) return { available: true, video: match };

  return {
    available: false,
    reason:
      input.type === "PRE_MARKET"
        ? "Today’s pre-market video has not been published yet. The verified written briefing remains available."
        : "Today’s post-market video review has not been published yet. The verified written briefing remains available.",
    type: input.type,
    marketDate,
  };
}

/** Newest-first archive of published videos only. */
export function listPublishedMarketVideoArchive(
  videos: readonly unknown[],
  limit = 12,
): MarketVideoRecord[] {
  const published = videos
    .map((row) => normalizeMarketVideoRecord(row))
    .filter((row): row is MarketVideoRecord => row != null && row.status === "published")
    .sort((left, right) => {
      const byDate = right.marketDate.localeCompare(left.marketDate);
      if (byDate !== 0) return byDate;
      return Date.parse(right.publishedAt) - Date.parse(left.publishedAt);
    });

  const unique: MarketVideoRecord[] = [];
  for (const video of published) {
    if (unique.some((item) => item.youtubeVideoId === video.youtubeVideoId && item.type === video.type)) {
      continue;
    }
    unique.push(video);
  }
  return unique.slice(0, Math.max(0, limit));
}
