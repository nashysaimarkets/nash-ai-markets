import Link from "next/link";
import { MarketVideoPlayer } from "../../components/MarketVideoPlayer.tsx";
import { StatusIcon } from "../../components/StatusIcon.tsx";
import type { MarketVideoSelection, MarketVideoType } from "../../lib/market-video/types.ts";

type Slot = {
  type: MarketVideoType;
  label: string;
  when: string;
  detail: string;
};

const SLOTS: readonly Slot[] = [
  {
    type: "PRE_MARKET",
    label: "Morning brief",
    when: "Before the US open",
    detail: "A walkthrough of the verified overnight context, key levels and what to watch at the bell.",
  },
  {
    type: "POST_MARKET",
    label: "Post-market review",
    when: "After the close",
    detail: "A review of how the session resolved, which levels mattered and what carries into tomorrow.",
  },
];

/**
 * The Video Centre embeds the published session video directly rather than
 * linking away to it, and falls back to a structured view of both daily slots
 * when nothing is published.
 *
 * The placeholder deliberately shows the shape of what will appear without
 * standing in for it: no sample video, no borrowed thumbnail and no invented
 * publication time. An unpublished slot is a normal part of the day, not a
 * fault, so it reads as a schedule rather than an error.
 */
export function DashboardVideoCentre({
  selection,
  postMarketPendingNotice = null,
  archiveAvailable = false,
}: {
  selection: MarketVideoSelection | null;
  postMarketPendingNotice?: string | null;
  archiveAvailable?: boolean;
}) {
  const published = selection?.available ? selection.video : null;

  return (
    <section className="dashVideoCentre" aria-labelledby="dash-video-centre-title">
      <header>
        <span className="mccEyebrow vxIconLabel">
          <StatusIcon name="video" />
          VIDEO CENTRE
        </span>
        <h2 id="dash-video-centre-title">Morning brief &amp; post-market wrap</h2>
        <p>Published session videos only. Written intelligence remains primary when video is unavailable.</p>
      </header>

      {published ? (
        <MarketVideoPlayer video={published} heading={published.title} compact />
      ) : (
        <div className="dashVideoSlots">
          {SLOTS.map((slot) => {
            const pending = slot.type === "POST_MARKET" ? postMarketPendingNotice : null;
            return (
              <article key={slot.type} className="dashVideoSlot" aria-label={slot.label}>
                <div className="dashVideoSlotFrame" aria-hidden="true">
                  <StatusIcon name={slot.type === "PRE_MARKET" ? "sunrise" : "sunset"} />
                </div>
                <div className="dashVideoSlotCopy">
                  <span className="dashVideoSlotWhen">{slot.when}</span>
                  <strong>{slot.label}</strong>
                  <p>{slot.detail}</p>
                  <span className="dashVideoSlotStatus">
                    {pending ?? "Not published yet for this market date"}
                  </span>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {published ? null : (
        <p className="dashVideoSlotsNote">
          Videos appear here on the day they are published. The written{" "}
          <Link href="/brief" className="dashTextLink">
            Morning Brief
          </Link>{" "}
          carries the same verified market context and is ready now.
        </p>
      )}

      {archiveAvailable ? (
        <p className="dashArchiveLink">
          <Link href="/reviews">Previous market reviews</Link>
        </p>
      ) : null}
    </section>
  );
}
