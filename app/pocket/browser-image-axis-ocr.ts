"use client";

import type { Worker } from "tesseract.js";
import { axisWordsFromTsv, type AxisWord } from "./axis-verification";
import { IMAGE_AXIS_POLICY, isMeasuredImagePlotRegion, verifyImageAxisWords, type ImageAxisVerification } from "./image-axis-verification";
import type { ImagePlotRegion } from "./image-plot-region";

/** Read only an independently measured axis region. No model crop or numeric
 * repair is used. This path is intentionally uncached: its owning hook cancels
 * every old image/report/confirmation binding before a new measurement starts. */
export async function verifyImagePriceAxis(
  image: HTMLImageElement,
  region: ImagePlotRegion,
  modelPrices: readonly number[],
  signal: AbortSignal,
): Promise<ImageAxisVerification> {
  const held = (reason: string): ImageAxisVerification => ({ status: "held", policy: IMAGE_AXIS_POLICY, reason });
  if (signal.aborted) return held("Price-axis verification cancelled.");
  if (!isMeasuredImagePlotRegion(region) || region.width !== image.naturalWidth || region.height !== image.naturalHeight) {
    return held("The measured chart does not match the current image.");
  }
  const crop = region.axisLabelRegionPixels;
  const { left, top, right, bottom } = crop;
  if (![left, top, right, bottom].every(Number.isInteger) || left < 0 || top < 0 || right > region.width || bottom > region.height || left >= right || top >= bottom) {
    return held("The image price-label region is unavailable.");
  }
  const width = right - left, height = bottom - top;
  let worker: Worker | undefined;
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let onAbort: (() => void) | undefined;
  const stop = () => { stopped = true; void worker?.terminate().catch(() => {}); };
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => { stop(); reject(new Error("Price reading timed out.")); }, 25_000);
  });
  const aborted = new Promise<never>((_, reject) => {
    onAbort = () => { stop(); reject(new Error("Price reading cancelled.")); };
    signal.addEventListener("abort", onAbort, { once: true });
  });
  const work = async (): Promise<ImageAxisVerification> => {
    const { createWorker, PSM } = await import("tesseract.js");
    if (stopped || signal.aborted) throw new Error("Price reading cancelled.");
    worker = await createWorker("eng", 1, {
      workerPath: "/ocr/v6/worker.min.js", corePath: "/ocr/v6/core", langPath: "/ocr/v6/lang",
      workerBlobURL: false, cacheMethod: "write", errorHandler: () => {},
    });
    if (stopped || signal.aborted) { await worker.terminate(); throw new Error("Price reading cancelled."); }
    let result: ImageAxisVerification = held("The chart's printed prices could not be checked.");
    const evidence: AxisWord[] = [];
    for (const attempt of [0, 1]) {
      if (stopped || signal.aborted) throw new Error("Price reading cancelled.");
      await worker.setParameters(attempt
        ? { tessedit_pageseg_mode: PSM.SINGLE_BLOCK, tessedit_char_whitelist: "0123456789.,$£€" }
        : { tessedit_pageseg_mode: PSM.SPARSE_TEXT });
      const scale = Math.min(attempt ? 3 : 2, 4096 / height, 1200 / width);
      const canvas = document.createElement("canvas");
      try {
        canvas.width = Math.max(1, Math.round(width * scale));
        canvas.height = Math.max(1, Math.round(height * scale));
        const context = canvas.getContext("2d", { willReadFrequently: true });
        if (!context) return held("The image price-label pixels are unavailable.");
        context.drawImage(image, left, top, width, height, 0, 0, canvas.width, canvas.height);
        const xScale = canvas.width / width, yScale = canvas.height / height;
        const recognized = await worker.recognize(canvas, {}, { tsv: true });
        if (stopped || signal.aborted) throw new Error("Price reading cancelled.");
        // Preserve the exact canvas rounding in each axis when mapping word
        // boxes back to the original image. y is already the word centre.
        const words = axisWordsFromTsv(recognized.data.tsv ?? "", { x: 0, y: 0, scale: 1 }).map(word => ({
          ...word, x: left + word.x / xScale, y: top + word.y / yScale,
          width: word.width / xScale, height: word.height / yScale,
        }));
        // A second read may add missing evidence. It must never erase an
        // earlier confident contradiction by retaining only a clean subset.
        evidence.push(...words);
        result = verifyImageAxisWords(evidence, region, modelPrices);
        if (result.status === "verified" || !result.retryable) return result;
      } finally {
        canvas.width = canvas.height = 1;
      }
    }
    return result;
  };
  try { return await Promise.race([work(), deadline, aborted]); }
  catch { return held(signal.aborted ? "Price-axis verification cancelled." : "The chart's printed prices could not be checked. Try a clearer screenshot."); }
  finally {
    if (timer) clearTimeout(timer);
    if (onAbort) signal.removeEventListener("abort", onAbort);
    stop();
  }
}
