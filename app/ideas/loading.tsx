import { MemberShell } from "../components/MemberShell";

export default function Loading() {
  return (
    <MemberShell active="ideas">
      <div className="ideasPage" aria-busy="true" aria-live="polite">
        <section className="ideasUnavailable ideasLoading" role="status">
          <span>MEMBER IDEAS</span>
          <h1>Loading member ideas…</h1>
          <p>Fetching verified member submissions. This should only take a moment.</p>
        </section>
      </div>
    </MemberShell>
  );
}
