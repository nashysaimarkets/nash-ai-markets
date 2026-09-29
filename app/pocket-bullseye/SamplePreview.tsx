"use client";

import { useMemo, useState } from "react";
import { createSampleCharts } from "../pocket/sample-analysis";
import { trackGrowth } from "../pocket/growth-client";
import { SampleLink } from "../pocket/GrowthControls";
import styles from "./page.module.css";

/** Uses the same deterministic fictional data as the full sample. No API calls. */
export default function SamplePreview() {
  const charts = useMemo(createSampleCharts, []);
  const [selected, setSelected] = useState(0);
  const chart = charts[selected];
  const report = chart.report!;
  return <section className={styles.preview} aria-label="Try a fictional chart review">
    <div className={styles.previewHeading}><span>TRY THE EXAMPLE</span><strong>Same market. Different views.</strong></div>
    <div className={styles.previewTabs} role="group" aria-label="Sample chart timeframe">
      {[0, 2, 3, 4].map((index) => <button key={index} type="button" aria-pressed={selected === index} onClick={() => {
        setSelected(index);
        trackGrowth("evidence_opened", { flow: "sample", once: "introduction-preview" });
      }}>{charts[index].timeframe}</button>)}
    </div>
    {/* Generated locally from the shared sample candles; no remote image request. */}
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img className={styles.sampleChart} src={chart.image} width="640" height="480" alt={`Fictional ${chart.timeframe} candlestick chart showing ${report.direction.toLowerCase()} structure. Not a live market.`} />
    <div className={styles.sampleRead} aria-live="polite" aria-atomic="true">
      <div><span>{chart.timeframe} STRUCTURE</span><strong data-direction={report.direction}>{report.direction.toLowerCase()}</strong></div>
      <div><span>EXAMPLE VERDICT</span><strong>Wait</strong></div>
    </div>
    <p className={styles.sampleInsight}>The 5-minute view rises. The hourly view falls. Checking both helps you question the setup.</p>
    <SampleLink className={styles.previewLink}>Explore the full example <span aria-hidden="true">→</span></SampleLink>
    <p className={styles.sampleNote}>Fictional illustration · no live prices · no account needed</p>
  </section>;
}
