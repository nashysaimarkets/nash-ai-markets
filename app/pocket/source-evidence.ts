import type { Analysis, Level } from "./analysis-types";
import { numericLevelPrice } from "./level-verification";

/** Never project a level from one screenshot onto another screenshot's geometry. */
export function resolveLevelEvidence(level: Level, analysis: Analysis, image: string, contextImage?: string | null) {
  const source = level.source ?? "PRIMARY";
  const context = source === "CONTEXT";
  const sourceImage = context ? contextImage : image;
  const frame = context ? analysis.contextBattlefield : analysis;
  const original = frame?.levels.find((item) => item.kind === level.kind
    && numericLevelPrice(item.price) !== null && numericLevelPrice(item.price) === numericLevelPrice(level.price)
    && (context || (item.source ?? "PRIMARY") === source));
  const bounds = frame?.plotBounds;
  const coordinates = original ? [original.x, original.y, original.x2, original.y2] : [];
  const reliable = (source === "PRIMARY" || source === "CONTEXT") && original && bounds
    && coordinates.every((value) => Number.isFinite(value) && value >= 0 && value <= 100)
    && bounds.left >= 0 && bounds.right <= 100 && bounds.top >= 0 && bounds.bottom <= 100
    && bounds.left < bounds.right && bounds.top < bounds.bottom
    && original.x >= bounds.left && original.x2 <= bounds.right && original.x2 > original.x
    && original.y >= bounds.top && original.y <= bounds.bottom
    && original.y2 >= bounds.top && original.y2 <= bounds.bottom;
  return { image: sourceImage || null, label: context ? "Supporting source chart" : "Selected source chart",
    line: reliable ? { x: original.x, y: original.y, x2: original.x2, y2: original.y2 } : null };
}
