import Link from "next/link";
import type { MarketVideoSelection } from "../lib/market-video/types.ts";
import { customerVideoTypeLabel, formatVideoDuration } from "../lib/market-video/select.ts";

type DashboardMarketVideoCardProps = {
  selection: MarketVideoSelection;
  href?: string;
};

/** Compact dashboard card — only renders when a published video exists for the market date. */
export function DashboardMarketVideoCard({ selection, href = "/brief" }: DashboardMarketVideoCardProps) {
  if (!selection.available) return null;
  const video = selection.video;
  const cta =
    video.type === "PRE_MARKET"
      ? "Watch today’s pre-market briefing"
      : "Watch today’s post-market review";
  const duration = formatVideoDuration(video.durationSeconds);

  return (
    <aside className="dashVideoCard" aria-label={customerVideoTypeLabel(video.type)}>
      <Link href={href} className="dashVideoLink">
        <span className="dashVideoThumb">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={video.thumbnailUrl} alt="" loading="lazy" decoding="async" />
          <span className="dashVideoPlay" aria-hidden="true">
            Play
          </span>
        </span>
        <span className="dashVideoCopy">
          <span className="mccEyebrow">{customerVideoTypeLabel(video.type)}</span>
          <strong>{cta}</strong>
          <small>
            {video.marketDate}
            {duration ? ` · ${duration}` : ""}
          </small>
        </span>
      </Link>
    </aside>
  );
}
