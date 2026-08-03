import { MemberShell } from "../components/MemberShell.tsx";

export default function JournalLoading() {
  return (
    <MemberShell active="journal" className="journalPage">
      <div className="memberDashboardShell workflowLoading" aria-busy="true" aria-live="polite">
        <section role="status">
          <span>PRIVATE JOURNAL</span>
          <h1>Opening your review workspace…</h1>
          <p>Checking private entries and process notes. No example trades are created.</p>
        </section>
      </div>
    </MemberShell>
  );
}
