import { redirect } from "next/navigation";
import { createClient } from "../../utils/supabase/server";
import { MemberShell } from "../components/MemberShell";

export default async function Loading() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

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
