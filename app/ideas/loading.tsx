import { MemberShell } from "../components/MemberShell";

export default function Loading() {
  return (
    <MemberShell active="ideas">
      <div className="ideasPage" aria-busy="true" aria-live="polite">
        <section className="ideasUnavailable ideasLoading" role="status">
          <span>MEMBER IDEAS</span>
          <h1>Loading member ideas…</h1>
          <p>Opening the product council and verified member submissions.</p>
        </section>
      </div>
    </MemberShell>
  );
}
