import Link from "next/link";
import type { MarketVideoRecord } from "../lib/market-video/types.ts";
import { customerVideoTypeLabel, formatVideoDuration } from "../lib/market-video/select.ts";
import { StatusIcon } from "./StatusIcon.tsx";

type MarketVideoArchiveProps = {
  videos: MarketVideoRecord[];
  compact?: boolean;
};

/** Limited previous-reviews list — published records only, newest first. */
export function MarketVideoArchive({ videos, compact = false }: MarketVideoArchiveProps) {
  if (!videos.length) return null;

  return (
    <section className={`marketVideoArchive${compact ? " is-compact" : ""}`} aria-labelledby="mv-archive-title">
      <header>
        <span className="mccEyebrow vxIconLabel">
          <StatusIcon name="archive" />
          Archive
        </span>
        <h2 id="mv-archive-title">Previous market reviews</h2>
        <p>Published pre-market and post-market reviews only. Dates use America/New_York market days.</p>
      </header>
      <ul>
        {videos.map((video) => {
          const duration = formatVideoDuration(video.durationSeconds);
          return (
            <li key={`${video.type}-${video.youtubeVideoId}-${video.marketDate}`}>
              <a href={video.watchUrl} target="_blank" rel="noopener noreferrer" className="marketVideoArchiveItem">
                <span className="marketVideoArchiveThumb">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={video.thumbnailUrl} alt="" loading="lazy" decoding="async" />
                </span>
                <span>
                  <em className={`marketVideoBadge is-${video.type === "PRE_MARKET" ? "pre" : "post"}`}>
                    {customerVideoTypeLabel(video.type)}
                  </em>
                  <strong>{video.title}</strong>
                  <small>
                    {video.marketDate}
                    {duration ? ` · ${duration}` : ""}
                  </small>
                </span>
              </a>
            </li>
          );
        })}
      </ul>
      {!compact ? (
        <p className="marketVideoArchiveFoot">
          <Link href="/brief">Return to Morning Brief</Link>
        </p>
      ) : null}
    </section>
  );
}
