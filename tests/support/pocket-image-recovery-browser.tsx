import React from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import OriginalChartEvidence from "../../app/pocket/OriginalChartEvidence";
import { useOriginalChartMeasurement } from "../../app/pocket/use-original-chart-measurement";
import { sourceLevelPlacement } from "../../app/pocket/source-placement";
import { readCandlePixels } from "../../app/pocket/candle-pixels";
import type { OriginalGeometryReport } from "../../app/pocket/original-pixel-geometry";
import { collectSourcePriceCandidates } from "../../app/pocket/source-price-candidates";
import { IMAGE_AXIS_POLICY, verifyImageAxisWords, type ImageAxisVerification } from "../../app/pocket/image-axis-verification";
import type { ImagePlotRegion, PlotRaster } from "../../app/pocket/image-plot-region";
import { plotRaster } from "./pocket-image-plot-raster";

type DeferredAxis = {
  src: string; width: number; height: number; region: ImagePlotRegion; modelPrices: number[]; signal: AbortSignal;
  resolve: (axis: ImageAxisVerification) => void; reject: (error: Error) => void;
};
type ReportMode = "candidate" | "valid_bounds" | "unsupported_scale" | "malformed_limitations" | "malformed_envelope";
type Props = { image: string; report: OriginalGeometryReport; identity: boolean; enabled: boolean; confirmation: object; consumers: number };
type Snapshot = {
  measured: boolean; legacyAxis: string | null; pixelsNull: boolean; regionStatus: string | null; recoveryAxis: string | null;
  count: number; reason: string | null; renderCount: number; placement: string | null; provenance: string | null;
};
declare global { interface Window {
  __imageRecoveryAxisCalls: DeferredAxis[];
  __imageRecoveryLegacyCalls: { src: string; signal: AbortSignal }[];
  __imageRecoveryReadbacks: { width: number; height: number }[];
  imageRecoveryReview: {
    images: { a: string; b: string; ambiguous: string; oversized: string };
    configure: (image: "a" | "b" | "ambiguous" | "oversized", mode?: ReportMode, price?: string) => void;
    replace: (patch: Partial<Props>) => void;
    report: (mode?: ReportMode, price?: string) => void;
    reconfirm: () => void;
    resolve: (index: number, mode?: "valid" | "held" | "nonlinear" | "malformed_axis") => void;
    reject: (index: number) => void;
    snapshot: () => Snapshot;
    unmount: () => void;
  };
} }

const fixtureA = plotRaster();
const fixtureB = plotRaster({ width: 960, height: 640, dark: true, panels: [
  { plot: { left: 190, right: 810, top: 110, bottom: 510 }, axis: "left" },
] });
const ambiguous = plotRaster({ width: 900, height: 720, panels: [
  { plot: { left: 90, right: 750, top: 40, bottom: 340 } },
  { plot: { left: 90, right: 750, top: 340, bottom: 640 }, candles: "volume" },
] });
function imageFromRaster(raster: PlotRaster) {
  const canvas = document.createElement("canvas"); canvas.width = raster.width; canvas.height = raster.height;
  const context = canvas.getContext("2d")!;
  const pixels = context.createImageData(raster.width, raster.height); pixels.data.set(raster.data);
  context.putImageData(pixels, 0, 0);
  const image = canvas.toDataURL("image/png"); canvas.width = canvas.height = 1;
  return image;
}
function oversizedImage() {
  const canvas = document.createElement("canvas"); canvas.width = 2000; canvas.height = 2001;
  const context = canvas.getContext("2d")!; context.fillStyle = "#eee"; context.fillRect(0, 0, canvas.width, canvas.height);
  const image = canvas.toDataURL("image/png"); canvas.width = canvas.height = 1;
  return image;
}
const images = { a: imageFromRaster(fixtureA.raster), b: imageFromRaster(fixtureB.raster),
  ambiguous: imageFromRaster(ambiguous.raster), oversized: oversizedImage() };
const actualPlot = fixtureA.expected[0];
const percentPlot = { left: actualPlot.left / fixtureA.raster.width * 100, right: actualPlot.right / fixtureA.raster.width * 100,
  top: actualPlot.top / fixtureA.raster.height * 100, bottom: actualPlot.bottom / fixtureA.raster.height * 100 };
const candleWitnesses = readCandlePixels(fixtureA.raster, percentPlot)!.candles.slice(0, 3);

function makeReport(mode: ReportMode = "candidate", price = "12032.50"): OriginalGeometryReport {
  const candidates = collectSourcePriceCandidates({
    levels: [{ kind: "support", label: "Untrusted model label", price, x: 99, x2: 100, y: .25, y2: .25 }],
    priceScaleAnchors: [{ price: 12345, y: .1 }, { price: 11720, y: .9 }],
  });
  const report: OriginalGeometryReport = {
    evidenceQuality: { chartReadability: "UNCLEAR", instrumentConfidence: "LOW", timeframeConfidence: "LOW", scaleReadable: false,
      candlesReadable: false, limitations: mode === "unsupported_scale" ? ["A logarithmic scale is reported."] : [] },
    plotBounds: mode === "valid_bounds" ? percentPlot : { left: 70, right: 100, top: 100, bottom: 20 },
    priceScaleAnchors: [{ price: 12345, y: .1 }, { price: 11720, y: .9 }],
    sourcePriceCandidates: candidates, levels: [], timeframe: "1h", currentPrice: "12032.50",
    // Valid observed endpoint coordinates make the separate authority test
    // meaningful when valid_bounds is selected. Recovery must still not
    // publish candle witnesses to the pattern or liquidity consumers.
    patterns: [{ name: "Reported pattern", timeframe: "1h", sourceRole: "PRIMARY", confidence: "HIGH", status: "FORMING",
      geometry: { labelX: 50, labelY: 50, points: candleWitnesses.map(c => ({ x: c.x / fixtureA.raster.width * 100, y: c.highY / fixtureA.raster.height * 100 })) } }],
    liquidity: { state: "VERIFIED", confidence: "HIGH", zones: [
      { side: "BUY_SIDE", basis: "RANGE_HIGH", price: "12220", x: 10, x2: 80, y: 30 },
    ], observations: [{ side: "buy-side", x: 20, y: 30, confidence: "HIGH" }, { side: "buy-side", x: 60, y: 30, confidence: "HIGH" }] },
  };
  if (mode === "malformed_envelope") report.sourcePriceCandidates = { ...candidates, provenance: "VERIFIED" } as unknown as typeof candidates;
  if (mode === "malformed_limitations") report.evidenceQuality.limitations = { text: "unknown" } as unknown as string[];
  return report;
}

// Fixture generation is over. Count only raster reads performed by the mounted
// path so an over-budget image cannot quietly allocate/read a full recovery canvas.
window.__imageRecoveryReadbacks = [];
const originalGetImageData = CanvasRenderingContext2D.prototype.getImageData;
CanvasRenderingContext2D.prototype.getImageData = function (this: CanvasRenderingContext2D, ...args: Parameters<typeof originalGetImageData>) {
  window.__imageRecoveryReadbacks.push({ width: args[2], height: args[3] });
  return originalGetImageData.apply(this, args);
};

const root = createRoot(document.getElementById("root")!);
let props: Props = { image: images.a, report: makeReport(), identity: true, enabled: true, confirmation: { instrument: "SYNTHETIC" }, consumers: 2 };
let renderCount = 0;
let snapshot: Snapshot = { measured: false, legacyAxis: null, pixelsNull: true, regionStatus: null, recoveryAxis: null, count: 0,
  reason: null, renderCount: 0, placement: null, provenance: null };
function Harness(p: Props) {
  renderCount++;
  const measurement = useOriginalChartMeasurement(p.image, p.report, p.identity, p.enabled, p.confirmation);
  const placement = sourceLevelPlacement(measurement, p.image, p.report, p.identity);
  const first = placement.levels[0];
  snapshot = { measured: measurement !== null, legacyAxis: measurement?.axis.status ?? null, pixelsNull: measurement?.pixels == null,
    regionStatus: measurement?.imageRecovery?.region.status ?? null, recoveryAxis: measurement?.imageRecovery?.axis?.status ?? null,
    count: placement.levels.length, reason: placement.reason, renderCount,
    placement: first && "placement" in first && typeof first.placement === "string" ? first.placement : null,
    provenance: first && "provenance" in first && typeof first.provenance === "string" ? first.provenance : null };
  return <main>
    <output id="recovery-placement" data-count={placement.levels.length} data-y={first?.y ?? ""}>{placement.reason ?? "IMAGE PRICE PLACEMENT"}</output>
    <div id="level-views">{Array.from({ length: p.consumers }, (_, i) =>
      <OriginalChartEvidence key={i} image={p.image} report={p.report} identityConfirmed={p.identity} measurement={measurement} />)}</div>
    <div id="pattern-view"><OriginalChartEvidence image={p.image} report={p.report} identityConfirmed={p.identity} measurement={measurement} layer="patterns" /></div>
    <div id="liquidity-view"><OriginalChartEvidence image={p.image} report={p.report} identityConfirmed={p.identity} measurement={measurement} layer="liquidity" /></div>
  </main>;
}
const render = () => flushSync(() => root.render(<Harness {...props} />));
window.imageRecoveryReview = {
  images, snapshot: () => ({ ...snapshot }),
  configure: (image, mode = "candidate", price = "12032.50") => { props = { ...props, image: images[image], report: makeReport(mode, price) }; render(); },
  replace: patch => { props = { ...props, ...patch }; render(); },
  report: (mode = "candidate", price = "12032.50") => { props = { ...props, report: makeReport(mode, price) }; render(); },
  reconfirm: () => { props = { ...props, confirmation: { ...props.confirmation } }; render(); },
  resolve: (index, mode = "valid") => {
    const call = window.__imageRecoveryAxisCalls[index];
    if (mode === "held") { call.resolve({ status: "held", policy: IMAGE_AXIS_POLICY, reason: "CONTROLLED INDEPENDENT OCR HOLD" }); return; }
    if (call.region.status !== "measured") throw new Error("The hook must not call OCR for an unmeasured region.");
    const region = call.region, roi = region.axisLabelRegionPixels;
    const words = region.gridRowPixels.map((row, i) => ({ text: String(12345 - i * 125 + (mode === "nonlinear" && i === 2 ? 60 : 0)),
      confidence: 96, x: roi.left + 2, y: row, width: Math.min(32, roi.right - roi.left - 4), height: 8 }));
    const axis = verifyImageAxisWords(words, region, call.modelPrices);
    if (mode === "valid" && axis.status !== "verified") throw new Error("The controlled fixture must satisfy the real axis verifier: " + axis.reason);
    if (mode === "nonlinear" && axis.status !== "held") throw new Error("The deliberately nonlinear word evidence must fail the real axis verifier.");
    call.resolve(mode === "malformed_axis" ? { status: "verified", policy: IMAGE_AXIS_POLICY } as ImageAxisVerification : axis);
  },
  reject: index => window.__imageRecoveryAxisCalls[index].reject(new Error("CONTROLLED INDEPENDENT OCR FAILURE")),
  unmount: () => flushSync(() => root.unmount()),
};
render();
