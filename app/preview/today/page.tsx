import type { Metadata } from "next";
import Link from "next/link";
import { BrandLogo } from "../../components/BrandLogo";

export const metadata: Metadata = {
  title: "Today Experience Preview",
  description: "Illustrative preview of the focused NASH AI Markets daily decision brief.",
  robots: { index: false, follow: false },
};

const evidence = [
  ["S&P 500 futures", "Unavailable", "No verified preview feed"],
  ["Volatility", "Unavailable", "No verified preview feed"],
  ["US dollar", "Unavailable", "No verified preview feed"],
  ["Treasury yields", "Unavailable", "No verified preview feed"],
] as const;

const paths = [
  {
    tone: "bull",
    label: "Bullish path",
    title: "Wait for verified acceptance",
    confirmation: "Price acceptance above the decision zone with supporting cross-market evidence.",
    invalidation: "Return below the decision zone or deterioration in supporting evidence.",
  },
  {
    tone: "bear",
    label: "Bearish path",
    title: "Wait for verified rejection",
    confirmation: "Loss of the decision zone followed by a failed recovery and aligned risk evidence.",
    invalidation: "Recovery through the decision zone with sustained supporting evidence.",
  },
  {
    tone: "neutral",
    label: "Stand aside",
    title: "Do nothing while evidence conflicts",
    confirmation: "Remain out when freshness, event risk or structure cannot support either path.",
    invalidation: "A verified path becomes clear and its confirmation conditions are satisfied.",
  },
] as const;

export default function TodayPreview() {
  return (
    <main className="todayPreview">
      <header className="todayPreviewNav">
        <BrandLogo authenticated className="todayPreviewBrand" />
        <nav aria-label="Preview navigation">
          <a href="#brief">Today</a>
          <a href="#evidence">Evidence</a>
          <a href="#review">Review</a>
          <Link href="/">Exit preview</Link>
        </nav>
      </header>

      <div className="todayPreviewNotice" role="status">
        <strong>DESIGN PREVIEW</strong>
        <span>No account access · No live market values · No trading guidance</span>
        <Link href="/">Return to homepage</Link>
      </div>

      <div className="todayPreviewShell" id="brief">
        <section className="todayPreviewHero" aria-labelledby="today-preview-title">
          <div>
            <p className="todayPreviewEyebrow">Today · Pre-session decision brief</p>
            <h1 id="today-preview-title">Prepare the conditions.<br /><em>Protect the decision.</em></h1>
            <p>
              The finished member experience begins with one answer hierarchy:
              trust, posture, evidence, paths and risk.
            </p>
          </div>
          <dl>
            <div><dt>Session</dt><dd>Preview only</dd></div>
            <div><dt>Updated</dt><dd>Unavailable</dd></div>
            <div><dt>Source</dt><dd>No live feed</dd></div>
          </dl>
        </section>

        <section className="todayTrust" aria-label="Data trust state">
          <div className="todayTrustIcon" aria-hidden="true">!</div>
          <div>
            <span>Data trust</span>
            <strong>Live evidence is unavailable in this design preview</strong>
            <p>Directional output and market levels remain withheld until every required input can be verified.</p>
          </div>
          <b>FAIL-CLOSED</b>
        </section>

        <section className="previewValueChange" aria-labelledby="preview-change-title">
          <header>
            <div><span>Since the prior brief</span><h2 id="preview-change-title">What changed?</h2></div>
            <small>Member value preview</small>
          </header>
          <p>A prior preserved session is required before changes can be compared.</p>
          <div>
            {["Posture", "Risk", "Permission", "Data quality"].map((label) => (
              <article key={label}><span>{label}</span><strong>Awaiting preserved evidence</strong><small>No comparison invented</small></article>
            ))}
          </div>
        </section>

        <section className="todayPosture" aria-labelledby="today-posture-title">
          <header>
            <span>01 / Session posture</span>
            <b>Capital protection active</b>
          </header>
          <div>
            <p>Current decision</p>
            <h2 id="today-posture-title">Stand aside</h2>
            <strong>Wait for verified market evidence</strong>
          </div>
          <p className="todayPostureReason">
            This preview intentionally contains no market conclusion. In the live
            product, this area explains the strongest aligned facts and the conflict
            that could prevent participation.
          </p>
        </section>

        <section className="todayPaths" aria-labelledby="today-paths-title">
          <header>
            <div>
              <span>02 / Conditional paths</span>
              <h2 id="today-paths-title">Plan more than one outcome.</h2>
            </div>
            <p>Conditions must verify before any path can become active.</p>
          </header>
          <div className="todayPathGrid">
            {paths.map((path) => (
              <article key={path.label} data-tone={path.tone}>
                <span>{path.label}</span>
                <h3>{path.title}</h3>
                <dl>
                  <div><dt>Confirmation</dt><dd>{path.confirmation}</dd></div>
                  <div><dt>Invalidation</dt><dd>{path.invalidation}</dd></div>
                </dl>
                <footer>Awaiting verified evidence</footer>
              </article>
            ))}
          </div>
        </section>

        <section className="todayEvidence" id="evidence" aria-labelledby="today-evidence-title">
          <header>
            <div>
              <span>03 / Evidence</span>
              <h2 id="today-evidence-title">Inspect what supports the brief.</h2>
            </div>
            <p>Source status stays beside the evidence instead of hiding behind a score.</p>
          </header>
          <div className="todayEvidenceGrid">
            {evidence.map(([label, value, detail]) => (
              <article key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
                <small>{detail}</small>
              </article>
            ))}
          </div>
          <div className="todayChartPlaceholder">
            <div aria-hidden="true"><i /><i /><i /><i /><i /></div>
            <strong>Verified chart evidence appears here</strong>
            <p>No synthetic candles or market levels are rendered in preview mode.</p>
          </div>
        </section>

        <section className="todayReview" id="review" aria-labelledby="today-review-title">
          <div>
            <span>04 / Review</span>
            <h2 id="today-review-title">Close the loop after the session.</h2>
            <p>
              The pre-session brief is preserved before the member records what
              happened, what they decided and whether the process was followed.
            </p>
          </div>
          <ol>
            <li className="previewDecisionCapture">
              <span>FAST</span><strong>One-click decision capture</strong>
              <div><button disabled>Prepare bullish</button><button disabled>Prepare bearish</button><button disabled>Stand aside</button></div>
              <small>Member-only controls are disabled in this design preview.</small>
            </li>
            <li><span>01</span><strong>Save the brief</strong><small>Preserve the original conditions.</small></li>
            <li><span>02</span><strong>Record the decision</strong><small>Trade, wait or stand aside.</small></li>
            <li><span>03</span><strong>Review the process</strong><small>Learn without inventing performance.</small></li>
          </ol>
        </section>

        <section className="previewWeeklyReview" aria-labelledby="preview-weekly-title">
          <header><span>Weekly process review</span><h2 id="preview-weekly-title">Measure the routine, not the theatre.</h2></header>
          <div>
            <article><span>Decisions</span><strong>—</strong><small>No member records in preview</small></article>
            <article><span>Plan followed</span><strong>— / —</strong><small>Only explicit answers count</small></article>
            <article><span>Confirmation</span><strong>— / —</strong><small>Nothing inferred</small></article>
            <article><span>Invalidation</span><strong>— / —</strong><small>No invented performance</small></article>
          </div>
          <footer><span>Next process focus</span><strong>Generated only from the member’s private decision record.</strong></footer>
        </section>
      </div>

      <footer className="todayPreviewFooter">
        <BrandLogo className="todayPreviewBrand" />
        <p>Illustrative design preview only. No live data and no recommendation.</p>
        <Link href="/">Return to homepage</Link>
      </footer>
    </main>
  );
}
