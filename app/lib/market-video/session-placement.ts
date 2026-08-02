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
  getCurrentSessionVideo,
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
  /** Show once on Dashboard during RTH when post-market is unpublished. */
  postMarketPendingNotice: string | null;
  deskShortcut: MarketVideoSelection | null;
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
  const sessionVideo = getCurrentSessionVideo({
    marketDate,
    session: input.phase,
    now,
    videos,
  });

  let dashboardSelection: MarketVideoSelection;
  let briefPrimary: BriefVideoSlot;
  let briefEarlier: BriefVideoSlot | null = null;
  let postMarketPendingNotice: string | null = null;
  let deskShortcut: MarketVideoSelection | null = null;

  if (input.phase === "premarket") {
    dashboardSelection = pre;
    briefPrimary = briefVideoSlotFromSelection(pre, "current");
    deskShortcut = pre.available ? pre : null;
  } else if (input.phase === "rth") {
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
      summary: null,
      publishedAt: null,
      placement: "hidden",
    };
    briefEarlier = pre.available ? briefVideoSlotFromSelection(pre, "earlier") : null;
    dashboardSelection = {
      available: false,
      reason: "Video card reserved for pre-market and post-market windows.",
      type: "PRE_MARKET",
      marketDate,
    };
    if (!post.available && "showPostMarketPending" in sessionVideo && sessionVideo.showPostMarketPending) {
      postMarketPendingNotice = "Post-market review will appear here after publication.";
    }
    deskShortcut = pre.available ? { ...pre, available: true } : null;
    if (deskShortcut && deskShortcut.available) {
      // During RTH, desk shortcut may point to earlier briefing with clear labelling upstream.
    }
  } else {
    dashboardSelection = post;
    briefPrimary = briefVideoSlotFromSelection(post, "current");
    briefEarlier = pre.available ? briefVideoSlotFromSelection(pre, "earlier") : null;
    deskShortcut = post.available ? post : pre.available ? pre : null;
  }

  return {
    marketDate,
    dashboardSelection,
    briefPrimary,
    briefEarlier,
    archive: listPublishedMarketVideoArchive(videos, 8),
    postMarketPendingNotice,
    deskShortcut,
  };
}
