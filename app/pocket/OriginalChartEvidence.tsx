"use client";
/* Uploaded private images remain local data URLs. */
/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState } from "react";
import { chartGridRows } from "./chart-grid-rows";
import { verifyOriginalAxis } from "./browser-axis-ocr";
import { originalPixelLevels, type OriginalLevelReport } from "./original-pixel-levels";
import type { AxisVerification } from "./axis-verification";
import "./original-chart-evidence.css";

export default function OriginalChartEvidence({ image, report, identityConfirmed = false, expanded = false }: { image: string; report?: OriginalLevelReport | null; identityConfirmed?: boolean; expanded?: boolean }) {
  const imageRef = useRef<HTMLImageElement>(null);
  const [loadEpoch, setLoadEpoch] = useState(0);
  const [visible, setVisible] = useState(true);
  const [measured, setMeasured] = useState<{ image: string; report: OriginalLevelReport; width: number; height: number; axis: AxisVerification } | null>(null);
  useEffect(() => {
    const source = imageRef.current;
    if (!source?.complete || !source.naturalWidth || !report?.plotBounds || !identityConfirmed) return;
    const controller = new AbortController();
    const width = source.naturalWidth, height = source.naturalHeight;
    let rows: number[] = [];
    try {
      if (width * height > 16_000_000) return;
      const canvas = document.createElement("canvas"); canvas.width = width; canvas.height = height;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (context) { context.drawImage(source, 0, 0); rows = chartGridRows(context.getImageData(0, 0, width, height), report.plotBounds); }
      canvas.width = canvas.height = 1;
    } catch { /* Unreadable pixels keep placement held. */ }
    const q = report.evidenceQuality;
    if (!q?.scaleReadable || !q.candlesReadable || q.chartReadability !== "CLEAR" || q.instrumentConfidence !== "HIGH" || q.timeframeConfidence !== "HIGH") return;
    void verifyOriginalAxis(source, report.plotBounds, rows, report.priceScaleAnchors ?? [], controller.signal).then(axis => {
      if (!controller.signal.aborted) setMeasured({ image, report, width, height, axis });
    });
    return () => controller.abort();
  }, [image, report, identityConfirmed, loadEpoch]);
  const current = measured?.image === image && measured.report === report ? measured : null;
  const placement = report ? originalPixelLevels(report, identityConfirmed, current?.axis ?? null, current?.width ?? 0, current?.height ?? 0) : null;
  return <section className={`psOriginalEvidence${expanded ? " psOriginalEvidenceExpanded" : ""}`} aria-label="Original source chart">
    {report ? <header><strong>ORIGINAL CHART LEVELS</strong><button type="button" aria-pressed={visible} onClick={() => setVisible(value => !value)}>{visible ? "Hide levels" : "Show levels"}</button></header> : null}
    <div className="psOriginalRaster"><img ref={imageRef} src={image} alt="Original uploaded trading chart" onLoad={() => setLoadEpoch(value => value + 1)} />
      {visible && current && placement?.levels.length ? <svg viewBox={`0 0 ${current.width} ${current.height}`} aria-label="Price levels placed using original-image axis readings">{placement.levels.map((level, index) => <line key={`${level.kind}-${level.price}-${index}`} data-kind={level.kind} x1={level.x * current.width / 100} x2={level.x2 * current.width / 100} y1={level.y * current.height / 100} y2={level.y2 * current.height / 100} vectorEffect="non-scaling-stroke" />)}</svg> : null}
    </div>
    {placement ? <p role="status">{placement.reason ?? `${placement.levels.length} source levels placed from independent price-axis pixels. Placement checks do not establish trading accuracy.`}</p> : null}
  </section>;
}
