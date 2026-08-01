"use client";

import { useState } from "react";
import Link from "next/link";
import type { MarketVideoRecord } from "../lib/market-video/types.ts";
import {
  customerVideoTypeLabel,
  formatPublishedTimes,
  formatVideoDuration,
} from "../lib/market-video/select.ts";
import { StatusIcon } from "./StatusIcon.tsx";

type MarketVideoPlayerProps = {
  video: MarketVideoRecord;
  heading?: string;
  supportingText?: string;
  compact?: boolean;
  showArchiveLink?: boolean;
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
  showArchiveLink = false,
}: MarketVideoPlayerProps) {
  const [active, setActive] = useState(false);
  const [failed, setFailed] = useState(false);
  const typeLabel = customerVideoTypeLabel(video.type);
  const duration = formatVideoDuration(video.durationSeconds);
  const published = formatPublishedTimes(video.publishedAt);
  const title =
    heading ??
    (video.type === "PRE_MARKET" ? "Today’s pre-market video briefing" : "Today’s post-market video review");
  const support =
    supportingText ??
    (video.type === "PRE_MARKET"
      ? "A concise walkthrough of the verified market context before the US session."
      : "A calm review of the session, key reactions and what the evidence suggests next.");
  const sessionIcon = video.type === "PRE_MARKET" ? "sunrise" : "sunset";
  // Highlights are operator-published only; an absent list renders no section.
  const takeaways = (video.keyTakeaways ?? []).slice(0, 3);

  return (
    <section
      className={`marketVideoCard${compact ? " is-compact" : ""}`}
      aria-labelledby={`mv-${video.id}`}
    >
      <header>
        <span className={`marketVideoBadge is-${video.type === "PRE_MARKET" ? "pre" : "post"}`}>
          <StatusIcon name={sessionIcon} />
          {typeLabel}
        </span>
        <h2 id={`mv-${video.id}`} className="vxIconLabel">
          <StatusIcon name="video" />
          {title}
        </h2>
        <p>{support}</p>
        {video.summary ? <p className="marketVideoSummary">{video.summary}</p> : null}
        <small>
          Market date {video.marketDate}
          {published ? ` · Published ${published.et} · Local ${published.local}` : ""}
          {duration ? ` · ${duration}` : ""}
          {" · "}
          Educational market commentary based on delayed and verified inputs. Not personalised financial advice.
        </small>
      </header>

      <div className="marketVideoFrame">
        {failed ? (
          <div className="marketVideoFailed" role="status">
            <strong>Video player unavailable</strong>
            <p>The written briefing remains available. You can still open the review on YouTube.</p>
          </div>
        ) : active ? (
          <iframe
            title={video.title}
            src={video.embedUrl}
            loading="lazy"
            allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            onError={() => {
              setFailed(true);
              setActive(false);
              console.error("[market-video] embed failed", { id: video.id, type: video.type });
            }}
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
              <StatusIcon name="video" />
              Play
            </span>
          </button>
        )}
      </div>

      {takeaways.length ? (
        <div className="marketVideoTakeaways">
          <h3>Key takeaways</h3>
          <ol>
            {takeaways.map((item, index) => (
              <li key={item}>
                <span aria-hidden="true">{index + 1}</span>
                <p>{item}</p>
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      {video.transcriptPreview ? (
        <details className="marketVideoTranscript">
          <summary>Transcript preview</summary>
          <p>{video.transcriptPreview}</p>
          <small>
            Opening excerpt of the published transcript. Watch the video for the full commentary.
          </small>
        </details>
      ) : null}

      <p className="marketVideoWatch">
        <a href={video.watchUrl} target="_blank" rel="noopener noreferrer">
          Watch on YouTube
        </a>
        {showArchiveLink ? (
          <>
            {" · "}
            <Link href="/reviews">Previous market reviews</Link>
          </>
        ) : null}
      </p>
    </section>
  );
}
