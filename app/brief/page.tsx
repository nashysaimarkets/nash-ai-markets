import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { MemberShell } from "../components/MemberShell";
import { requireMemberPage } from "../lib/server/member-page-access";
import { listAnalysisSnapshots } from "../lib/server/market-snapshots";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Evidence | NASH AI Markets",
  description: "Inspect the latest preserved market evidence, source status and methodology behind the daily brief.",
  robots: { index: false, follow: false },
};

function formattedTimestamp(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Timestamp unavailable";
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/London",
  }).format(date);
}

function driverLabel(factor: string): string {
  return factor.replaceAll("_", " ").toLowerCase();
}

function invalidationLabel(condition: {
  kind: string;
  level?: string;
  threshold?: number;
}): string {
  const boundary = condition.level ?? condition.threshold;
  return `${condition.kind.replaceAll("_", " ").toLowerCase()}${boundary === undefined ? "" : ` · ${boundary}`}`;
}

export default async function EvidencePage() {
  const { access } = await requireMemberPage();
  if (!access.features.intelligence) redirect("/terminal");
  const result = await listAnalysisSnapshots(1);
  const latest = result.rows[0] ?? null;

  return (
    <MemberShell active="brief" className="focusedMemberPage">
      <div className="focusedMemberShell">
        <header className="focusedMemberHero">
          <div>
            <span>Evidence · Preserved record</span>
            <h1>Inspect what supports<br /><em>the decision.</em></h1>
            <p>
              This page reads the latest immutable analysis snapshot. It does not
              reconstruct missing history or silently replace unavailable evidence.
            </p>
          </div>
          <Link href="/terminal">Return to Today →</Link>
        </header>

        {!result.available ? (
          <section className="focusedUnavailable" role="status">
            <span>Evidence store unavailable</span>
            <h2>The preserved record cannot be read right now.</h2>
            <p>
              No historical values have been reconstructed. Today remains available
              with its current verified or fail-closed state.
            </p>
          </section>
        ) : !latest ? (
          <section className="focusedUnavailable" role="status">
            <span>No preserved snapshot yet</span>
            <h2>Evidence will appear after the first verified brief is stored.</h2>
            <p>No sample prices, scores or historical conclusions are shown in its place.</p>
          </section>
        ) : (
          <>
            <section className="evidenceRecordHeader" data-quality={latest.data_quality}>
              <div>
                <span>Latest preserved snapshot</span>
                <h2>{latest.session_date}</h2>
                <p>{formattedTimestamp(latest.created_at)} · {latest.kind.replaceAll("_", " ")}</p>
              </div>
              <dl>
                <div><dt>Data quality</dt><dd>{latest.data_quality}</dd></div>
                <div><dt>Provider</dt><dd>{latest.provider_health}</dd></div>
                <div><dt>Method</dt><dd>{latest.methodology_version}</dd></div>
              </dl>
            </section>

            <section className="evidenceDecision" aria-labelledby="evidence-decision-title">
              <header><span>01 / Preserved decision</span></header>
              <div>
                <article>
                  <span>Posture</span>
                  <h2 id="evidence-decision-title">{latest.posture ?? "Unavailable"}</h2>
                  <p>Trade permission: <strong>{latest.trade_permission ?? "Unavailable"}</strong></p>
                </article>
                <dl>
                  <div><dt>Market bias</dt><dd>{latest.payload.decision.marketBias}</dd></div>
                  <div><dt>Risk</dt><dd>{latest.risk_rating ?? "Unavailable"}</dd></div>
                  <div><dt>Volatility</dt><dd>{latest.volatility_regime ?? "Unavailable"}</dd></div>
                  <div><dt>Generation</dt><dd>{latest.payload.generationMode.replaceAll("-", " ")}</dd></div>
                </dl>
              </div>
            </section>

            <section className="evidenceGrid" aria-label="Preserved verified quotes">
              {latest.payload.market.quotes.map((quote) => (
                <article key={quote.symbol} data-direction={quote.direction}>
                  <span>{quote.label}</span>
                  <strong>{quote.value}</strong>
                  <small>{quote.change}</small>
                </article>
              ))}
              {!latest.payload.market.quotes.length ? (
                <article><span>Quotes</span><strong>Unavailable</strong><small>No preserved values</small></article>
              ) : null}
            </section>

            <section className="evidenceColumns">
              <article>
                <span>02 / Supporting evidence</span>
                <h2>What supported the posture</h2>
                <ul>
                  {latest.payload.decision.topSupportingDrivers.map((item) => (
                    <li key={`${item.factor}-${item.score}`}>
                      {driverLabel(item.factor)} · score {item.score}
                    </li>
                  ))}
                  {!latest.payload.decision.topSupportingDrivers.length ? <li>No supporting drivers were preserved.</li> : null}
                </ul>
              </article>
              <article>
                <span>03 / Conflicts</span>
                <h2>What opposed the posture</h2>
                <ul>
                  {latest.payload.decision.conflictingDrivers.map((item) => (
                    <li key={`${item.factor}-${item.score}`}>
                      {driverLabel(item.factor)} · score {item.score}
                    </li>
                  ))}
                  {!latest.payload.decision.conflictingDrivers.length ? <li>No conflicting drivers were preserved.</li> : null}
                </ul>
              </article>
              <article>
                <span>04 / Invalidation</span>
                <h2>What would change it</h2>
                <ul>
                  {latest.payload.decision.invalidationConditions.map((item) => (
                    <li key={`${item.kind}-${item.level ?? item.threshold ?? "none"}`}>
                      {invalidationLabel(item)}
                    </li>
                  ))}
                  {!latest.payload.decision.invalidationConditions.length ? <li>No invalidation conditions were preserved.</li> : null}
                </ul>
              </article>
            </section>

            <footer className="focusedDisclosure">
              <strong>Immutable evidence record</strong>
              <span>Snapshot {latest.content_hash.slice(0, 12)} · Stored before review · No retrospective reconstruction</span>
            </footer>
          </>
        )}
      </div>
    </MemberShell>
  );
}
