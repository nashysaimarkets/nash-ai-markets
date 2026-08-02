import { MemberShell } from "../components/MemberShell.tsx";

export default function ReviewsLoading() {
  return (
    <MemberShell active="review" className="reviewsPage">
      <div className="memberDashboardShell workflowLoading" aria-busy="true" aria-live="polite">
        <section role="status">
          <span>SESSION LIBRARY</span>
          <h1>Opening published reviews…</h1>
          <p>Checking the verified publication archive. Draft or scheduled videos are never shown.</p>
        </section>
      </div>
    </MemberShell>
  );
}
