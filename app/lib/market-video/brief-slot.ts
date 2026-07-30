/**
 * Map shared market-video selection into Morning Brief video slots.
 */

import type { BriefVideoSlot } from "../../brief/lib/compose-market-brief.ts";
import type { MarketVideoSelection } from "./types.ts";
import { customerVideoTypeLabel } from "./select.ts";

export function briefVideoSlotFromSelection(
  selection: MarketVideoSelection,
  placement: BriefVideoSlot["placement"] = "current",
): BriefVideoSlot {
  if (!selection.available) {
    return {
      available: false,
      youtubeId: null,
      title: customerVideoTypeLabel(selection.type),
      reason: selection.reason,
      type: selection.type,
      marketDate: selection.marketDate,
      embedUrl: null,
      watchUrl: null,
      thumbnailUrl: null,
      durationSeconds: null,
      summary: null,
      publishedAt: null,
      placement: "hidden",
    };
  }

  const video = selection.video;
  return {
    available: true,
    youtubeId: video.youtubeVideoId,
    title: video.title,
    reason: "Verified published market video.",
    type: video.type,
    marketDate: video.marketDate,
    embedUrl: video.embedUrl,
    watchUrl: video.watchUrl,
    thumbnailUrl: video.thumbnailUrl,
    durationSeconds: video.durationSeconds,
    summary: video.summary || null,
    publishedAt: video.publishedAt,
    placement,
  };
}
