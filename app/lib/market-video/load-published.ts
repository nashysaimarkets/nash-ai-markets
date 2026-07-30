/**
 * Safe loader for the operator-maintained published video manifest.
 * Failures return an empty list — never block member routes.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { MarketVideoRecord } from "./types.ts";
import { normalizeMarketVideoRecord } from "./validate.ts";

type ManifestShape = {
  videos?: unknown[];
};

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

export function loadPublishedMarketVideos(): MarketVideoRecord[] {
  try {
    const manifest = readManifest();
    const rows = Array.isArray(manifest.videos) ? manifest.videos : [];
    return rows
      .map((row) => normalizeMarketVideoRecord(row))
      .filter((row): row is MarketVideoRecord => Boolean(row));
  } catch (error) {
    console.error("[market-video] manifest parse failed", {
      name: error instanceof Error ? error.name : "Error",
    });
    return [];
  }
}
