"use client";

import dynamic from "next/dynamic";
import type { CustomerCandleSeries } from "../../lib/providers/financial-modeling-prep-candles.ts";

const HeroMarketChart = dynamic(
  () => import("./HeroMarketChart").then((mod) => mod.HeroMarketChart),
  {
    ssr: false,
    loading: () => (
      <section className="mccHeroChart is-loading" aria-busy="true" aria-label="Loading hero chart">
        <div className="mccChartSkeleton">
          <div className="mccSkeletonBar" />
          <div className="mccSkeletonBar short" />
          <p>Loading interactive chart…</p>
        </div>
      </section>
    ),
  },
);

export function HeroMarketChartLazy({
  series,
  sessionPhase,
}: {
  series: CustomerCandleSeries;
  sessionPhase: string;
}) {
  return <HeroMarketChart series={series} instrument="ES" sessionPhase={sessionPhase} />;
}
