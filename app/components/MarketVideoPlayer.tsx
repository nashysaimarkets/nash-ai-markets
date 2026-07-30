"use client";

import { useState } from "react";
import type { MarketVideoRecord } from "../lib/market-video/types.ts";
import {
  customerVideoTypeLabel,
  formatVideoDuration,
} from "../lib/market-video/select.ts";

type MarketVideoPlayerProps = {
  video: MarketVideoRecord;
  heading?: string;
  supportingText?: string;
  compact?: boolean;
};

/**
 * Click-to-load privacy-enhanced YouTube embed.
 * No autoplay; iframe loads only after explicit member interaction.
 */
export function MarketVideoPlayer({
  video,
  heading,
  supportingText,
  compact = false,
}: MarketVideoPlayerProps) {
  const [active, setActive] = useState(false);
  const typeLabel = customerVideoTypeLabel(video.type);
  const duration = formatVideoDuration(video.durationSeconds);
  const title = heading ?? (video.type === "PRE_MARKET" ? "Today’s pre-market video" : "Today’s post-market video review");

  return (
    <section className={`marketVideoCard${compact ? " is-compact" : ""}`} aria-labelledby={`mv-${video.id}`}>
      <header>
        <span className="marketVideoBadge">{typeLabel}</span>
        <h2 id={`mv-${video.id}`}>{title}</h2>
        {supportingText ? <p>{supportingText}</p> : null}
        <small>
          Market date {video.marketDate}
          {duration ? ` · ${duration}` : ""}
          {" · "}
          Educational market commentary based on delayed and verified inputs. Not personalised financial advice.
        </small>
      </header>

      <div className="marketVideoFrame">
        {active ? (
          <iframe
            title={video.title}
            src={video.embedUrl}
            loading="lazy"
            allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        ) : (
          <button
            type="button"
            className="marketVideoPoster"
            onClick={() => setActive(true)}
            aria-label={`Play ${video.title}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={video.thumbnailUrl} alt="" loading="lazy" decoding="async" />
            <span className="marketVideoPlay" aria-hidden="true">
              Play
            </span>
          </button>
        )}
      </div>

      <p className="marketVideoWatch">
        <a href={video.watchUrl} target="_blank" rel="noopener noreferrer">
          Watch on YouTube
        </a>
      </p>
    </section>
  );
}
