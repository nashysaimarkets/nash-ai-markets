export type ChartEvidenceRole = "PRIMARY" | "HIGHER_TIMEFRAME" | "PRICE_DETAIL" | "INDICATOR_VOLUME";

export type DeterministicChartEvidence = {
  version: "pocket-cv-v1";
  role: ChartEvidenceRole;
  image: { width: number; height: number };
  chartStatus: "chart-detected" | "not-a-chart";
  plot: { left: number; top: number; right: number; bottom: number; confidence: number };
  candles: { count: number; confidence: number; centres: number[] };
  levels: Array<{ kind: "support" | "resistance" | "pivot"; y: number; strength: number; touches: number }>;
  volumeProfile: { status: "visible" | "not-detected"; side?: "left" | "right"; pointOfControlY?: number; confidence: number };
  warnings: string[];
};

const finite = (value: unknown) => typeof value === "number" && Number.isFinite(value);
const percent = (value: unknown) => finite(value) ? Math.max(0, Math.min(100, value as number)) : null;
const confidence = (value: unknown) => finite(value) ? Math.max(0, Math.min(1, value as number)) : 0;

/** Treat browser measurements as bounded evidence, never as trusted arbitrary JSON. */
export function normalizeDeterministicEvidence(value: unknown): DeterministicChartEvidence[] {
  if (!Array.isArray(value)) return [];
  const roles = new Set<ChartEvidenceRole>();
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const source = item as Record<string, unknown>;
    const role = source.role as ChartEvidenceRole;
    if (!["PRIMARY", "HIGHER_TIMEFRAME", "PRICE_DETAIL", "INDICATOR_VOLUME"].includes(role) || roles.has(role)) return [];
    const plotSource = source.plot && typeof source.plot === "object" ? source.plot as Record<string, unknown> : {};
    const left = percent(plotSource.left), top = percent(plotSource.top), right = percent(plotSource.right), bottom = percent(plotSource.bottom);
    if (left === null || top === null || right === null || bottom === null || right <= left || bottom <= top) return [];
    const candleSource = source.candles && typeof source.candles === "object" ? source.candles as Record<string, unknown> : {};
    const volumeSource = source.volumeProfile && typeof source.volumeProfile === "object" ? source.volumeProfile as Record<string, unknown> : {};
    const imageSource = source.image && typeof source.image === "object" ? source.image as Record<string, unknown> : {};
    const width = finite(imageSource.width) ? Math.max(1, Math.min(4096, Math.round(imageSource.width as number))) : 1;
    const height = finite(imageSource.height) ? Math.max(1, Math.min(4096, Math.round(imageSource.height as number))) : 1;
    const count = finite(candleSource.count) ? Math.max(0, Math.min(1000, Math.round(candleSource.count as number))) : 0;
    const centres = Array.isArray(candleSource.centres) ? candleSource.centres.flatMap((entry) => {
      const parsed = percent(entry);
      return parsed === null ? [] : [Number(parsed.toFixed(2))];
    }).slice(0, 400) : [];
    const levels = Array.isArray(source.levels) ? source.levels.flatMap((entry) => {
      if (!entry || typeof entry !== "object") return [];
      const level = entry as Record<string, unknown>;
      const y = percent(level.y);
      const kind = level.kind;
      if (y === null || !["support", "resistance", "pivot"].includes(String(kind))) return [];
      return [{ kind: kind as "support" | "resistance" | "pivot", y: Number(y.toFixed(2)), strength: confidence(level.strength), touches: finite(level.touches) ? Math.max(1, Math.min(20, Math.round(level.touches as number))) : 1 }];
    }).slice(0, 4) : [];
    const pointOfControlY = percent(volumeSource.pointOfControlY);
    roles.add(role);
    return [{
      version: "pocket-cv-v1" as const,
      role,
      image: { width, height },
      chartStatus: source.chartStatus === "chart-detected" ? "chart-detected" as const : "not-a-chart" as const,
      plot: { left, top, right, bottom, confidence: confidence(plotSource.confidence) },
      candles: { count, confidence: confidence(candleSource.confidence), centres },
      levels,
      volumeProfile: volumeSource.status === "visible" ? {
        status: "visible" as const,
        side: volumeSource.side === "left" ? "left" as const : "right" as const,
        ...(pointOfControlY === null ? {} : { pointOfControlY: Number(pointOfControlY.toFixed(2)) }),
        confidence: confidence(volumeSource.confidence),
      } : { status: "not-detected" as const, confidence: confidence(volumeSource.confidence) },
      warnings: Array.isArray(source.warnings) ? source.warnings.filter((entry): entry is string => typeof entry === "string").map((entry) => entry.slice(0, 140)).slice(0, 4) : [],
    }];
  }).slice(0, 4);
}

export function deterministicPrimaryFallback(value: unknown) {
  const primary = normalizeDeterministicEvidence(value).find((item) => item.role === "PRIMARY" && item.chartStatus === "chart-detected" && item.candles.count >= 8);
  if (!primary) return null;
  return {
    plotBounds: { left: primary.plot.left, top: primary.plot.top, right: primary.plot.right, bottom: primary.plot.bottom },
    levels: primary.levels.map((level, index) => ({
      kind: level.kind,
      label: `${level.kind.toUpperCase()} · ${level.touches} TOUCH${level.touches === 1 ? "" : "ES"} · IMAGE-MEASURED`,
      price: "",
      x: primary.plot.left,
      y: level.y,
      x2: primary.plot.right,
      y2: level.y,
      source: "PRIMARY",
      evidenceId: `cv-${index + 1}`,
    })),
    primary,
  };
}

export function hasCorroboratedVolumeProfile(value: unknown, indicators: unknown) {
  const measured = normalizeDeterministicEvidence(value).some((entry) => entry.volumeProfile.status === "visible");
  const visiblyRead = Array.isArray(indicators) && indicators.some((item) => typeof item === "string" && /volume profile|point of control|\bPOC\b|\bVAH\b|\bVAL\b/i.test(item));
  return measured && visiblyRead;
}
