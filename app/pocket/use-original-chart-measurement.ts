"use client";
import { useEffect, useMemo, useState } from "react";
import { chartGridRows } from "./chart-grid-rows";
import { verifyOriginalAxis } from "./browser-axis-ocr";
import { readCandlePixels } from "./candle-pixels";
import type { OriginalGeometryReport } from "./original-pixel-geometry";
import type { OriginalChartMeasurement } from "./source-placement";

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
    if (!enabled || !image || !report?.plotBounds || !identityConfirmed) return;
    const q = report.evidenceQuality;
    if (!q?.scaleReadable || !q.candlesReadable || q.chartReadability !== "CLEAR" || q.instrumentConfidence !== "HIGH" || q.timeframeConfidence !== "HIGH") return;
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
      if (!width || !height || width * height > 16_000_000) { unavailable("Original image dimensions are unavailable or too large for placement."); return; }
      const canvas = document.createElement("canvas");
      try {
        canvas.width = width; canvas.height = height;
        const context = canvas.getContext("2d", { willReadFrequently: true });
        if (!context) { unavailable("Original image pixels are unavailable."); return; }
        context.drawImage(source, 0, 0);
        const raster = context.getImageData(0, 0, width, height);
        const rows = chartGridRows(raster, report.plotBounds!);
        const pixels = readCandlePixels(raster, report.plotBounds!);
        canvas.width = canvas.height = 1;
        const axis = await verifyOriginalAxis(source, report.plotBounds!, rows, report.priceScaleAnchors ?? [], controller.signal);
        publish({ image, report, width, height, axis, pixels });
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
