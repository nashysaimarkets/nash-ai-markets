/**
 * Session-aware video placement for Morning Brief and Dashboard.
 * Fail-soft: never throws; empty manifest yields unavailable slots.
 */

import type { SessionPhase } from "../../terminal/lib/session-clock.ts";
import type { BriefVideoSlot } from "../../brief/lib/compose-market-brief.ts";
import { briefVideoSlotFromSelection } from "./brief-slot.ts";
import { loadPublishedMarketVideos } from "./load-published.ts";
import {
  getCurrentMarketVideo,
  listPublishedMarketVideoArchive,
  marketDateInNewYork,
} from "./select.ts";
import type { MarketVideoRecord, MarketVideoSelection } from "./types.ts";

export type SessionVideoBundle = {
  marketDate: string;
  dashboardSelection: MarketVideoSelection;
  briefPrimary: BriefVideoSlot;
  briefEarlier: BriefVideoSlot | null;
  archive: MarketVideoRecord[];
};

export function resolveSessionMarketVideos(input: {
  phase: SessionPhase;
  now?: number;
  videos?: readonly unknown[];
}): SessionVideoBundle {
  let videos: readonly unknown[] = input.videos ?? [];
  if (!input.videos) {
    try {
      videos = loadPublishedMarketVideos();
    } catch (error) {
      console.error("[market-video] load failed", {
        name: error instanceof Error ? error.name : "Error",
      });
      videos = [];
    }
  }

  const now = input.now ?? Date.now();
  const marketDate = marketDateInNewYork(now);
  const pre = getCurrentMarketVideo({ type: "PRE_MARKET", marketDate, now, videos });
  const post = getCurrentMarketVideo({ type: "POST_MARKET", marketDate, now, videos });

  let dashboardSelection: MarketVideoSelection;
  let briefPrimary: BriefVideoSlot;
  let briefEarlier: BriefVideoSlot | null = null;

  if (input.phase === "premarket") {
    dashboardSelection = pre;
    briefPrimary = briefVideoSlotFromSelection(pre, "current");
  } else if (input.phase === "rth") {
    dashboardSelection = pre.available ? pre : { available: false, reason: pre.reason, type: "PRE_MARKET", marketDate };
    // During session, do not present pre-market as the current update.
    briefPrimary = {
      available: false,
      youtubeId: null,
      title: "Session update",
      reason: "The written session update is primary during regular hours. Earlier video briefing is available below when published.",
      type: "PRE_MARKET",
      marketDate,
      embedUrl: null,
      watchUrl: null,
      thumbnailUrl: null,
      durationSeconds: null,
      placement: "hidden",
    };
    briefEarlier = pre.available ? briefVideoSlotFromSelection(pre, "earlier") : null;
    // Hide dashboard video card during RTH unless we only want post — spec says before market pre, after market post.
    dashboardSelection = { available: false, reason: "Video card reserved for pre-market and post-market windows.", type: "PRE_MARKET", marketDate };
  } else {
    dashboardSelection = post;
    briefPrimary = briefVideoSlotFromSelection(post, "current");
    briefEarlier = pre.available ? briefVideoSlotFromSelection(pre, "earlier") : null;
  }

  return {
    marketDate,
    dashboardSelection,
    briefPrimary,
    briefEarlier,
    archive: listPublishedMarketVideoArchive(videos, 8),
  };
}
