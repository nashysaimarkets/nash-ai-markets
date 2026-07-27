import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { MemberShell } from "../components/MemberShell";
import { requireMemberPage } from "../lib/server/member-page-access";
import { listJournalEntries } from "../lib/server/trade-journal";
import { JournalDeleteButton } from "./JournalDeleteButton";
import { JournalForm } from "./JournalForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Decision Journal | NASH AI Markets",
  description: "Private decision journal for disciplined session review.",
  robots: { index: false, follow: false },
};

function readableDate(value: string): string {
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(date)
    : "Time unavailable";
}

export default async function JournalPage() {
  const { user, access } = await requireMemberPage();
  if (!access.features.journal) redirect("/terminal");
  const result = await listJournalEntries(user.id);

  return (
    <MemberShell active="journal" className="journalPage">
      <div className="memberDashboardShell ftPage">
        <header className="journalHero">
          <div>
            <span>PRIVATE DECISION RECORD</span>
            <h1>Record the decision.<br />Review the process.</h1>
            <p>
              Capture what you chose and why. Prices, fills and results remain optional
              because missing facts are never invented.
            </p>
          </div>
          <div className="journalHeroStatus">
            <strong>{result.available ? `${result.rows.length} PRIVATE RECORDS` : "JOURNAL UNAVAILABLE"}</strong>
            <Link href="/review">Open weekly review →</Link>
          </div>
        </header>

        <section className="journalLayout" aria-label="Decision journal">
          <JournalForm />
          <div className="journalList">
            {!result.available ? (
              <article className="ftCard journalEntryCard">
                <header><span>SAFE EMPTY STATE</span><h2>Journal temporarily unavailable</h2></header>
                <p>No substitute or reconstructed records are shown.</p>
              </article>
            ) : result.rows.length ? (
              result.rows.slice(0, 12).map((entry) => (
                <article className="ftCard journalEntryCard" key={entry.id}>
                  <header>
                    <div><span>{readableDate(entry.traded_at)}</span><h2>{entry.underlying} · {entry.direction}</h2></div>
                    <b>PRIVATE</b>
                  </header>
                  <p>{entry.reason || entry.notes || "No reason or note recorded."}</p>
                  <dl>
                    <div><dt>Plan</dt><dd>{entry.followed_plan === true ? "Followed" : entry.followed_plan === false ? "Not followed" : "Not recorded"}</dd></div>
                    <div><dt>Confirmation</dt><dd>{entry.respected_confirmation === true ? "Respected" : entry.respected_confirmation === false ? "Not respected" : "Not recorded"}</dd></div>
                    <div><dt>Invalidation</dt><dd>{entry.respected_invalidation === true ? "Respected" : entry.respected_invalidation === false ? "Not respected" : "Not recorded"}</dd></div>
                  </dl>
                  <JournalDeleteButton id={entry.id} />
                </article>
              ))
            ) : (
              <article className="ftCard journalEntryCard">
                <header><span>NO RECORDS YET</span><h2>Your first decision starts the loop.</h2></header>
                <p>Use the form or return to Today for one-click decision capture.</p>
              </article>
            )}
          </div>
        </section>
      </div>
    </MemberShell>
  );
}
