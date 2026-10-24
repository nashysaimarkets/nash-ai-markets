import { originalPixelLevels } from "./original-pixel-levels.ts";
import type { AxisVerification } from "./axis-verification.ts";
import type { CandlePixels } from "./candle-pixels.ts";
import type { OriginalGeometryReport } from "./original-pixel-geometry.ts";

export type OriginalChartMeasurement = {
  image: string;
  report: OriginalGeometryReport;
  width: number;
  height: number;
  axis: AxisVerification;
  pixels: CandlePixels | null;
};

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
  const current = currentSourceMeasurement(measurement, image, report, identityConfirmed);
  return originalPixelLevels(report, identityConfirmed, current?.axis ?? null, current?.width ?? 0, current?.height ?? 0);
}

export type SourceLevelPlacement = ReturnType<typeof sourceLevelPlacement>;
