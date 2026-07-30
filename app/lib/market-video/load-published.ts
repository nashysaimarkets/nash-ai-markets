/**
 * Safe loader for the operator-maintained published video manifest.
 * Request-scoped cache — never blocks member routes on failure.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { MarketVideoRecord } from "./types.ts";
import { normalizeMarketVideoRecord } from "./validate.ts";

type ManifestShape = {
  videos?: unknown[];
};

type CacheEntry = {
  loadedAt: number;
  videos: MarketVideoRecord[];
};

const CACHE_TTL_MS = 60_000;
let cache: CacheEntry | null = null;

function readManifest(): ManifestShape {
  try {
    const here = dirname(fileURLToPath(import.meta.url));
    const path = join(here, "../../content/published-market-videos.json");
    return JSON.parse(readFileSync(path, "utf8")) as ManifestShape;
  } catch (error) {
    console.error("[market-video] manifest load failed", {
      name: error instanceof Error ? error.name : "Error",
    });
    return { videos: [] };
  }
}

export function loadPublishedMarketVideos(options?: { bypassCache?: boolean }): MarketVideoRecord[] {
  const now = Date.now();
  if (!options?.bypassCache && cache && now - cache.loadedAt < CACHE_TTL_MS) {
    return cache.videos;
  }

  try {
    const manifest = readManifest();
    const rows = Array.isArray(manifest.videos) ? manifest.videos : [];
    const videos = rows
      .map((row) => normalizeMarketVideoRecord(row))
      .filter((row): row is MarketVideoRecord => Boolean(row));
    cache = { loadedAt: now, videos };
    return videos;
  } catch (error) {
    console.error("[market-video] manifest parse failed", {
      name: error instanceof Error ? error.name : "Error",
    });
    return cache?.videos ?? [];
  }
}

/** Test helper — clears the in-memory cache. */
export function clearPublishedMarketVideoCache() {
  cache = null;
}
