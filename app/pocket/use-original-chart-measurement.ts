"use client";
import { useEffect, useMemo, useState } from "react";
import { chartGridRows } from "./chart-grid-rows";
import { verifyOriginalAxis } from "./browser-axis-ocr";
import { verifyImagePriceAxis } from "./browser-image-axis-ocr";
import { readCandlePixels } from "./candle-pixels";
import { detectImagePlotRegion, MAX_IMAGE_PLOT_PIXELS } from "./image-plot-region";
import { IMAGE_AXIS_POLICY } from "./image-axis-verification";
import { originalPixelLevels } from "./original-pixel-levels";
import type { OriginalGeometryReport } from "./original-pixel-geometry";
import { sourceImageRecoveryEligible, type OriginalChartMeasurement } from "./source-placement";

/** The report owner measures once and shares the result with every view.
 * Standalone source tools can use the same hook without a parent publisher. */
export function useOriginalChartMeasurement(
  image: string | null,
  report: OriginalGeometryReport | null | undefined,
  identityConfirmed: boolean,
  enabled = true,
  confirmation: unknown = identityConfirmed,
) {
  // A new binding is also created for A -> B -> A and confirmed -> revoked ->
  // confirmed. Neither transition may resurrect the previous measurement.
  const binding = useMemo(() => ({ image, report, identityConfirmed, enabled, confirmation }), [image, report, identityConfirmed, enabled, confirmation]);
  const [result, setResult] = useState<{ binding: typeof binding; measurement: OriginalChartMeasurement } | null>(null);
  useEffect(() => {
    if (!enabled || !image || !report || !identityConfirmed) return;
    const q = report.evidenceQuality;
    const legacyEligible = Boolean(report.plotBounds && q?.scaleReadable && q.candlesReadable && q.chartReadability === "CLEAR" && q.instrumentConfidence === "HIGH" && q.timeframeConfidence === "HIGH");
    const recoveryEligible = sourceImageRecoveryEligible(report);
    if (!legacyEligible && !recoveryEligible) return;
    const controller = new AbortController();
    const source = new Image();
    let started = false;
    const publish = (measurement: OriginalChartMeasurement) => {
      if (!controller.signal.aborted) setResult({ binding, measurement });
    };
    const unavailable = (reason: string) => publish({ image, report, width: source.naturalWidth, height: source.naturalHeight, axis: { status: "held", reason }, pixels: null });
    const measure = async () => {
      if (started || controller.signal.aborted) return;
      started = true;
      const width = source.naturalWidth, height = source.naturalHeight;
      // Keep the established path's limit; the new detector is bounded before
      // allocating a canvas when it is the only eligible measurement path.
      const limit = legacyEligible ? 16_000_000 : MAX_IMAGE_PLOT_PIXELS;
      if (!width || !height || width * height > limit) { unavailable("Original image dimensions are unavailable or too large for placement."); return; }
      const canvas = document.createElement("canvas");
      try {
        canvas.width = width; canvas.height = height;
        const context = canvas.getContext("2d", { willReadFrequently: true });
        if (!context) { unavailable("Original image pixels are unavailable."); return; }
        context.drawImage(source, 0, 0);
        const raster = context.getImageData(0, 0, width, height);
        canvas.width = canvas.height = 1;
        let axis: OriginalChartMeasurement["axis"] = { status: "held", reason: "Original model geometry is unavailable." };
        let pixels: OriginalChartMeasurement["pixels"] = null;
        if (legacyEligible) {
          const rows = chartGridRows(raster, report.plotBounds!);
          pixels = readCandlePixels(raster, report.plotBounds!);
          axis = await verifyOriginalAxis(source, report.plotBounds!, rows, report.priceScaleAnchors ?? [], controller.signal);
        }
        if (controller.signal.aborted) return;
        let imageRecovery: OriginalChartMeasurement["imageRecovery"];
        if (recoveryEligible && !originalPixelLevels(report, identityConfirmed, axis, width, height).levels.length) {
          const region = detectImagePlotRegion(raster);
          let imageAxis: NonNullable<OriginalChartMeasurement["imageRecovery"]>["axis"] = null;
          if (region.status === "measured") {
            try { imageAxis = await verifyImagePriceAxis(source, region, report.sourcePriceCandidates!.axisPrices, controller.signal); }
            catch { imageAxis = { status: "held", policy: IMAGE_AXIS_POLICY, reason: "Independent price reader unavailable. Try a clearer chart." }; }
          }
          imageRecovery = { region, axis: imageAxis };
        }
        publish({ image, report, width, height, axis, pixels, ...(imageRecovery ? { imageRecovery } : {}) });
      } catch {
        unavailable("Independent price reader unavailable. Try a clearer chart.");
      } finally {
        canvas.width = canvas.height = 1;
      }
    };
    source.onload = () => { void measure(); };
    source.onerror = () => unavailable("Original image could not be read for placement.");
    source.src = image;
    if (source.complete && source.naturalWidth) void measure();
    return () => { controller.abort(); source.onload = null; source.onerror = null; };
  }, [binding, enabled, image, report, identityConfirmed]);
  return result?.binding === binding ? result.measurement : null;
}
