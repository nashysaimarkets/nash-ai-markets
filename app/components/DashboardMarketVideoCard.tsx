import Link from "next/link";
import type { MarketVideoSelection } from "../lib/market-video/types.ts";
import { customerVideoTypeLabel, formatVideoDuration } from "../lib/market-video/select.ts";
import { StatusIcon } from "./StatusIcon.tsx";

type DashboardMarketVideoCardProps = {
  selection: MarketVideoSelection;
  href?: string;
  pendingNotice?: string | null;
};

/** Compact dashboard card — only renders when a published video exists, or a single pending notice. */
export function DashboardMarketVideoCard({
  selection,
  href = "/brief",
  pendingNotice = null,
}: DashboardMarketVideoCardProps) {
  if (!selection.available) {
    if (!pendingNotice) return null;
    return (
      <aside className="dashVideoPending" role="status">
        <StatusIcon name="sunset" />
        <div>
          <strong>Post-market review</strong>
          <p>{pendingNotice}</p>
        </div>
      </aside>
    );
  }

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
            <StatusIcon name="video" />
            Play
          </span>
        </span>
        <span className="dashVideoCopy">
          <span className="mccEyebrow vxIconLabel">
            <StatusIcon name={video.type === "PRE_MARKET" ? "sunrise" : "sunset"} />
            {customerVideoTypeLabel(video.type)}
          </span>
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
