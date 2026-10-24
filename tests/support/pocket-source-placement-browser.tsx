import React from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import OriginalChartEvidence from "../../app/pocket/OriginalChartEvidence";
import { useOriginalChartMeasurement } from "../../app/pocket/use-original-chart-measurement";
import { sourceLevelPlacement } from "../../app/pocket/source-placement";

type ControlledAxis = { status: "verified"; anchors: { price: number; y: number }[]; matchedModelTicks: number; axisLeft: number } | { status: "held"; reason: string };
type HarnessProps = typeof props;
type ReviewApi = {
  imageA: string; imageB: string; renderCount: () => number;
  replace: (patch: Partial<HarnessProps>) => void;
  replaceReport: () => void; reconfirm: () => void; reset: () => void;
  resolve: (index: number, mode?: string) => void; reject: (index: number) => void; unmount: () => void;
};
declare global { interface Window {
  review: ReviewApi;
  __ocr: { resolve: (axis: ControlledAxis) => void; reject: (error: Error) => void; signal: AbortSignal }[];
} }

const anchors = [{ price: 3000, y: 20 }, { price: 2900, y: 50 }, { price: 2800, y: 80 }];
const report = {
  evidenceQuality: { chartReadability: "CLEAR", instrumentConfidence: "HIGH", timeframeConfidence: "HIGH", scaleReadable: true, candlesReadable: true, limitations: [] },
  plotBounds: { left: 5, right: 90, top: 10, bottom: 90 }, priceScaleAnchors: anchors,
  // The deliberately wrong model coordinate must never reach the measured SVG.
  levels: [{ kind: "support", label: "Candidate", price: "2850", x: 10, x2: 85, y: 40, y2: 40 }],
  timeframe: "1h", currentPrice: "2950", patterns: [],
  liquidity: { state: "NONE", confidence: "LOW", zones: [], observations: [] },
};
const source = (color: string) => "data:image/svg+xml," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1000"><rect width="1000" height="1000" fill="${color}"/><path d="M50 200H900 M50 500H900 M50 800H900" stroke="#888" stroke-width="1"/></svg>`);
const imageA = source("white"), imageB = source("#fafafa");
const root = createRoot(document.getElementById("root")!);
let props = { image: imageA, report, identity: true, enabled: true, confirmation: { instrument: "SYNTHETIC" }, consumers: 2 };
let renderCount = 0;
function Harness(p: typeof props) {
  renderCount++;
  const measured = useOriginalChartMeasurement(p.image, p.report, p.identity, p.enabled, p.confirmation);
  const placement = sourceLevelPlacement(measured, p.image, p.report, p.identity);
  return <main data-render-count={renderCount}>
    <output id="placement" data-count={placement.levels.length} data-y={placement.levels[0]?.y ?? ""}>{placement.reason ?? "SOURCE PLACEMENT VERIFIED"}</output>
    {Array.from({ length: p.consumers }, (_, i) => <OriginalChartEvidence key={i} image={p.image} report={p.report} identityConfirmed={p.identity} measurement={measured} />)}
  </main>;
}
const render = () => flushSync(() => root.render(<Harness {...props} />));
window.review = {
  imageA, imageB,
  renderCount: () => renderCount,
  replace: (patch: Partial<typeof props>) => { props = { ...props, ...patch }; render(); },
  replaceReport: () => { props = { ...props, report: structuredClone(props.report) }; render(); },
  reconfirm: () => { props = { ...props, confirmation: { ...props.confirmation } }; render(); },
  reset: () => { props = { image: imageA, report: structuredClone(report), identity: true, enabled: true, confirmation: { instrument: "SYNTHETIC" }, consumers: 2 }; render(); },
  resolve: (i: number, mode = "verified") => window.__ocr[i].resolve(mode === "verified" ? { status: "verified", anchors, matchedModelTicks: 3, axisLeft: 950 } : { status: "held", reason: "CONTROLLED OCR HOLD" }),
  reject: (i: number) => window.__ocr[i].reject(new Error("CONTROLLED OCR FAILURE")),
  unmount: () => flushSync(() => root.unmount()),
};
render();
