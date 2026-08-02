/**
 * Safe loader for the operator-maintained published video manifest.
 * Request-scoped cache — never blocks member routes on failure.
 */

import manifest from "../../content/published-market-videos.json" with { type: "json" };
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

/**
 * Imported statically rather than read from disk at request time: the bundled
 * server output does not carry the source tree, so a runtime `readFileSync`
 * resolved against `import.meta.url` fails in every deployment and silently
 * published no videos at all.
 */
function readManifest(): ManifestShape {
  return manifest as ManifestShape;
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
