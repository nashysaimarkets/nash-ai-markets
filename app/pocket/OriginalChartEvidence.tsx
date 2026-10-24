"use client";
/* Uploaded private images remain local data URLs. */
/* eslint-disable @next/next/no-img-element */
import { useState } from "react";
import { useOriginalChartMeasurement } from "./use-original-chart-measurement";
import { currentSourceMeasurement, sourceLevelPlacement, type OriginalChartMeasurement } from "./source-placement";
import { pixelCheckedPatterns, pixelCheckedLiquidity, type OriginalGeometryReport } from "./original-pixel-geometry";
import "./original-chart-evidence.css";

export default function OriginalChartEvidence({ image, report, identityConfirmed = false, expanded = false, layer = "levels", measurement }: { image: string; report?: OriginalGeometryReport | null; identityConfirmed?: boolean; expanded?: boolean; layer?: "levels" | "patterns" | "liquidity"; measurement?: OriginalChartMeasurement | null }) {
  const [visible, setVisible] = useState(true);
  const localMeasurement = useOriginalChartMeasurement(image, report, identityConfirmed, measurement === undefined);
  const measured = measurement === undefined ? localMeasurement : measurement;
  const current = currentSourceMeasurement(measured, image, report, identityConfirmed);
  const placement = report ? sourceLevelPlacement(measured, image, report, identityConfirmed) : null;
  const patterns = report && current && identityConfirmed ? pixelCheckedPatterns(report.patterns ?? [], report.timeframe ?? "", report.plotBounds, current.pixels) : [];
  const liquidity = report && current ? pixelCheckedLiquidity(report, identityConfirmed, current.axis, current.pixels) : [];
  const count = layer === "patterns" ? patterns.length : layer === "liquidity" ? liquidity.length : placement?.levels.length ?? 0;
  const reason = layer === "levels" ? placement?.reason : count ? null : `No ${layer} candidates passed original candle-endpoint checks.`;
  return <section className={`psOriginalEvidence${expanded ? " psOriginalEvidenceExpanded" : ""}`} aria-label="Original source chart">
    {report ? <header><strong>ORIGINAL CHART {layer.toUpperCase()}</strong><button type="button" aria-pressed={visible} onClick={() => setVisible(value => !value)}>{visible ? `Hide ${layer}` : `Show ${layer}`}</button></header> : null}
    <div className="psOriginalRaster"><img src={image} alt="Original uploaded trading chart" />
      {visible && current && count ? <svg viewBox={`0 0 ${current.width} ${current.height}`} aria-label={`${layer} placed using original-image pixel evidence`}>
        {layer === "levels" ? placement?.levels.map((level, index) => <line key={`${level.kind}-${level.price}-${index}`} data-kind={level.kind} x1={level.x * current.width / 100} x2={level.x2 * current.width / 100} y1={level.y * current.height / 100} y2={level.y2 * current.height / 100} vectorEffect="non-scaling-stroke" />) : null}
        {layer === "patterns" ? patterns.map((pattern, index) => <polyline key={`${pattern.name}-${index}`} points={pattern.geometry.points.map(point => `${point.x * current.width / 100},${point.y * current.height / 100}`).join(" ")} vectorEffect="non-scaling-stroke" />) : null}
        {layer === "liquidity" ? liquidity.map((zone, index) => <g key={`${zone.side}-${index}`}>{zone.height > 0 ? <rect className="psOriginalLiquidityBand" data-side={zone.side} x={zone.x * current.width / 100} y={zone.top * current.height / 100} width={(zone.x2-zone.x) * current.width / 100} height={zone.height * current.height / 100} /> : null}<line data-kind={zone.side === "BUY_SIDE" ? "resistance" : "support"} x1={zone.x * current.width / 100} x2={zone.x2 * current.width / 100} y1={zone.y * current.height / 100} y2={zone.y * current.height / 100} vectorEffect="non-scaling-stroke" />{zone.touches.map((point, i) => <circle key={i} cx={point.x * current.width / 100} cy={point.y * current.height / 100} r="2" />)}</g>) : null}
      </svg> : null}
    </div>
    {report ? <p role="status">{reason ?? `${count} ${layer} candidates placed from independent source pixels. Placement does not establish trading accuracy or hidden orders.`}</p> : null}
  </section>;
}
