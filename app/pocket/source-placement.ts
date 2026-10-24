import { originalPixelLevels } from "./original-pixel-levels.ts";
import type { AxisVerification } from "./axis-verification.ts";
import type { CandlePixels } from "./candle-pixels.ts";
import type { OriginalGeometryReport } from "./original-pixel-geometry.ts";
import { isSourcePriceCandidates } from "./source-price-candidates.ts";
import { imagePixelPriceCandidates, type ImageAxisVerification } from "./image-axis-verification.ts";
import type { ImagePlotRegion } from "./image-plot-region.ts";

export type OriginalChartMeasurement = {
  image: string;
  report: OriginalGeometryReport;
  width: number;
  height: number;
  axis: AxisVerification;
  pixels: CandlePixels | null;
  // Horizontal candidates alone gain this independent image-origin placement.
  // Legacy axis/pixels retain their existing authority for all other features.
  imageRecovery?: { region: ImagePlotRegion; axis: ImageAxisVerification | null };
};

function unsupportedImageScale(report: OriginalGeometryReport) {
  const limitations: unknown = report.evidenceQuality?.limitations;
  return limitations !== undefined && (!Array.isArray(limitations) || limitations.some(text =>
    typeof text !== "string" || /\blog(?:arithmic)?\b|non.?linear|\bscale\b.*\b(?:unknown|uncertain)\b|\b(?:unknown|uncertain)\b.*\bscale\b/i.test(text)));
}

export function sourceImageRecoveryEligible(report: OriginalGeometryReport) {
  const candidates = report.sourcePriceCandidates;
  return isSourcePriceCandidates(candidates) && candidates.levels.length > 0 &&
    new Set(candidates.axisPrices).size >= 2 && !unsupportedImageScale(report);
}

/** A model report is only a candidate. Its numeric prices do not establish
 * source placement. Keep this selection synchronous so a changed source or
 * revoked confirmation cannot display the previous render's evidence. */
export function currentSourceMeasurement(
  measurement: OriginalChartMeasurement | null,
  image: string | null,
  report: OriginalGeometryReport | null | undefined,
  identityConfirmed: boolean,
) {
  return identityConfirmed && image && report && measurement?.image === image && measurement.report === report
    ? measurement : null;
}

export function sourceLevelPlacement(
  measurement: OriginalChartMeasurement | null,
  image: string | null,
  report: OriginalGeometryReport | null | undefined,
  identityConfirmed: boolean,
) {
  if (!report) return { levels: [], reason: "Source report is unavailable." };
  if (identityConfirmed && unsupportedImageScale(report)) return { levels: [], reason: "This price scale is not supported for precise placement." };
  const current = currentSourceMeasurement(measurement, image, report, identityConfirmed);
  const legacy = originalPixelLevels(report, identityConfirmed, current?.axis ?? null, current?.width ?? 0, current?.height ?? 0);
  if (legacy.levels.length || !identityConfirmed || !isSourcePriceCandidates(report.sourcePriceCandidates)) return legacy;
  if (!sourceImageRecoveryEligible(report)) return legacy;
  if (!current?.imageRecovery) return { levels: [], reason: current?.axis.status === "held" ? current.axis.reason : "Verifying image price labels…" };
  const { region, axis } = current.imageRecovery;
  if (region.status === "held") return { levels: [], reason: "The image does not provide a unique readable chart and price scale. Try a clearer screenshot." };
  if (region.status === "measured" && (region.width !== current.width || region.height !== current.height)) {
    return { levels: [], reason: "The measured chart does not match the current image." };
  }
  return imagePixelPriceCandidates(report.sourcePriceCandidates, identityConfirmed, region, axis);
}

export type SourceLevelPlacement = ReturnType<typeof sourceLevelPlacement>;
