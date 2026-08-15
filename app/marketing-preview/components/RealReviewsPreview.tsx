import Link from "next/link";
import { MemberShell } from "../../components/MemberShell";
import { LearningWorkflowRail } from "../../components/LearningWorkflowRail.tsx";
import { MarketVideoArchive } from "../../components/MarketVideoArchive.tsx";
import type { MarketVideoRecord } from "../../lib/market-video/types.ts";

const REVIEW_VIDEOS: MarketVideoRecord[] = [
  {
    id: "example-post-2026-07-21",
    youtubeVideoId: "example-post-2026-07-21",
    type: "POST_MARKET",
    marketDate: "2026-07-21",
    title: "How the session respected the verified range",
    summary: "An illustrative review of range location, patience and the evidence that mattered after the close.",
    description: "Illustrative private-preview review. Not a published live-market recording.",
    publishedAt: "2026-07-21T21:15:00.000Z",
    durationSeconds: 486,
    thumbnailUrl: "/og-image.svg",
    watchUrl: "#example-post-2026-07-21",
    embedUrl: "",
    status: "published",
    source: "youtube",
    verifiedAt: "2026-07-21T21:20:00.000Z",
    keyTakeaways: [
      "The opening range remained the main decision reference.",
      "Incomplete confirmation kept participation selective.",
      "The post-session review scores process, not hindsight.",
    ],
  },
  {
    id: "example-pre-2026-07-21",
    youtubeVideoId: "example-pre-2026-07-21",
    type: "PRE_MARKET",
    marketDate: "2026-07-21",
    title: "Morning plan: catalysts, levels and no-trade conditions",
    summary: "An example pre-market walkthrough of the verified preparation route before the US cash open.",
    description: "Illustrative private-preview review. Not a published live-market recording.",
    publishedAt: "2026-07-21T11:45:00.000Z",
    durationSeconds: 392,
    thumbnailUrl: "/brand/logo-horizontal.svg",
    watchUrl: "#example-pre-2026-07-21",
    embedUrl: "",
    status: "published",
    source: "youtube",
    verifiedAt: "2026-07-21T11:50:00.000Z",
  },
  {
    id: "example-post-2026-07-18",
    youtubeVideoId: "example-post-2026-07-18",
    type: "POST_MARKET",
    marketDate: "2026-07-18",
    title: "What changed when volatility stopped confirming",
    summary: "An illustrative learning review showing why cross-market disagreement should reduce conviction.",
    description: "Illustrative private-preview review. Not a published live-market recording.",
    publishedAt: "2026-07-18T21:10:00.000Z",
    durationSeconds: 531,
    thumbnailUrl: "/brand/logo-mark.svg",
    watchUrl: "#example-post-2026-07-18",
    embedUrl: "",
    status: "published",
    source: "youtube",
    verifiedAt: "2026-07-18T21:16:00.000Z",
  },
  {
    id: "example-pre-2026-07-18",
    youtubeVideoId: "example-pre-2026-07-18",
    type: "PRE_MARKET",
    marketDate: "2026-07-18",
    title: "Preparing for a mixed evidence session",
    summary: "An example briefing focused on stand-aside conditions, event risk and protecting decision quality.",
    description: "Illustrative private-preview review. Not a published live-market recording.",
    publishedAt: "2026-07-18T11:40:00.000Z",
    durationSeconds: 418,
    thumbnailUrl: "/icons/app-icon-512.png",
    watchUrl: "#example-pre-2026-07-18",
    embedUrl: "",
    status: "published",
    source: "youtube",
    verifiedAt: "2026-07-18T11:46:00.000Z",
  },
];

export function RealReviewsPreview() {
  return (
    <MemberShell active="review" className="reviewsPage marketingRealMemberPreview">
      <aside className="dashPartialBanner" role="status">
        <strong>EXAMPLE-ONLY MEMBER EXPERIENCE</strong>
        <span>All review titles, dates, durations and thumbnails on this private preview are illustrative.</span>
      </aside>
      <div className="memberDashboardShell marketReviewsPage">
        <LearningWorkflowRail active="reviews" />
        <section className="reviewsHero">
          <div>
            <span>SESSION INTELLIGENCE LIBRARY</span>
            <h1>
              Review the tape.
              <br />
              <em>Refine the process.</em>
            </h1>
            <p>
              Published pre-market context and post-market learning, organised as a disciplined review loop—not an
              entertainment feed.
            </p>
          </div>
          <div className="reviewsOrbit" aria-hidden="true">
            <i />
            <i />
            <i />
            <span />
          </div>
          <aside>
            <span>PUBLISHED · EXAMPLE</span>
            <strong>{REVIEW_VIDEOS.length}</strong>
            <small>illustrative reviews</small>
            <Link href="#review-journal-example">Open private journal ↗</Link>
          </aside>
        </section>
        <MarketVideoArchive videos={REVIEW_VIDEOS} />
        <p id="review-journal-example" className="dashDisclosure" role="note">
          Example review library for private product presentation. No video is published or opened from this preview.
        </p>
      </div>
    </MemberShell>
  );
}
