import type { Metadata } from "next";
import Link from "next/link";
import { DashboardCard } from "../components/DashboardCard.tsx";
import { MemberShell } from "../components/MemberShell.tsx";
import { SafeState } from "../components/SafeState.tsx";
import { listJournalEntries } from "../lib/server/trade-journal.ts";
import { requireMemberPage } from "../lib/server/member-page-access.ts";
import { LockedPremiumCard } from "../terminal/components/LockedPremiumCard.tsx";
import { TerminalBadge } from "../terminal/components/TerminalBadge.tsx";
import { ProcessScorePanel } from "../components/oracle/ProcessScorePanel.tsx";
import { JournalForm } from "./JournalForm.tsx";
import { JournalDeleteButton } from "./JournalDeleteButton.tsx";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Trade Journal | NASH AI Markets",
  description: "Private trade journal for disciplined post-trade review.",
  robots: { index: false, follow: false },
};

function formatWhen(iso: string) {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return "Unavailable";
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/London" }).format(new Date(ms));
}

export default async function JournalPage() {
  const { user, access, previewState } = await requireMemberPage();

  if (!access.features.journal) {
    return <MemberShell active="journal" className="journalPage">
      <div className="memberDashboardShell">
        <section className="journalHero">
          <div>
            <span>TRADE JOURNAL</span>
            <h1>Private trade journal</h1>
            <p>Log futures and options decisions without inventing fills or outcomes.</p>
          </div>
        </section>
        <LockedPremiumCard
          tier="pro"
          title="Unlock the trade journal"
          value="Pro and Elite members can keep a private journal tied to Bullseye process fields."
          benefits={["Private entries", "Process checkboxes", "Performance readiness later"]}
          previewEligible={access.previewOffer?.eligible ?? false}
          previewAvailable={previewState.available}
          previewCadence={access.previewOffer?.cadence}
        />
      </div>
    </MemberShell>;
  }

  const journal = await listJournalEntries(user.id);

  if (!journal.available) {
    return <MemberShell active="journal" className="journalPage">
      <div className="memberDashboardShell">
        <section className="journalHero">
          <div>
            <span>TRADE JOURNAL</span>
            <h1>Journal migration pending</h1>
            <p>Your private trade journal will open once the member_trade_journal migration is applied.</p>
          </div>
        </section>
        <SafeState title="Journal storage unavailable" tone="warning">
          <p>No entries can be listed or created until migration completes. Bullseye will not invent sample trades.</p>
          <Link href="/methodology">Methodology</Link>
        </SafeState>
      </div>
    </MemberShell>;
  }

  return <MemberShell active="journal" className="journalPage">
    <div className="memberDashboardShell">
      <section className="journalHero">
        <div>
          <span>TRADE JOURNAL</span>
          <h1>Your private journal</h1>
          <p>Process-first logging. Optional P&amp;L stays blank until you record a verified close. Preparation is rewarded — not trade frequency.</p>
        </div>
        <div className="journalHeroStatus">
          <TerminalBadge label={`${journal.rows.length} entries`} tone="info" />
          <strong>{access.effectiveTier.toUpperCase()} ACCESS</strong>
          <Link href="/performance">Performance</Link>
        </div>
      </section>

      <ProcessScorePanel />

      <div className="journalLayout">
        <JournalForm />
        <section className="journalList" aria-label="Journal entries">
          {!journal.rows.length ? (
            <SafeState title="No journal entries yet">
              <p>Log your first trade when you have a real fill. Empty is honest.</p>
            </SafeState>
          ) : journal.rows.map((row) => (
            <DashboardCard
              key={row.id}
              eyebrow={String(row.instrument_class).toUpperCase()}
              title={`${row.underlying} · ${row.direction}`}
              badge={<TerminalBadge label={formatWhen(String(row.traded_at))} tone="neutral" />}
              className="journalEntryCard"
              footer={<JournalDeleteButton id={String(row.id)} />}
            >
              <dl>
                <div><dt>Entry</dt><dd>{row.entry_price ?? "—"}</dd></div>
                <div><dt>Stop</dt><dd>{row.stop_price ?? "—"}</dd></div>
                <div><dt>Target</dt><dd>{row.target_price ?? "—"}</dd></div>
                <div><dt>P&amp;L</dt><dd>{typeof row.pnl === "number" ? row.pnl : "—"}</dd></div>
                <div><dt>Followed plan</dt><dd>{row.followed_plan == null ? "—" : row.followed_plan ? "Yes" : "No"}</dd></div>
                <div><dt>Emotion</dt><dd>{row.emotion ?? "—"}</dd></div>
              </dl>
              {row.reason ? <p>{String(row.reason)}</p> : null}
              {row.notes ? <p>{String(row.notes)}</p> : null}
              {row.lesson ? <p><strong>Lesson:</strong> {String(row.lesson)}</p> : null}
            </DashboardCard>
          ))}
        </section>
      </div>
    </div>
  </MemberShell>;
}
