import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "../../utils/supabase/server";
import { MemberShell } from "../components/MemberShell";
import { LearningWorkflowRail } from "../components/LearningWorkflowRail.tsx";
import { IdeaForm } from "./IdeaForm";
import { statusLabel } from "./lib";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Member Ideas | NASH AI Markets",
  description: "Help shape the NASH AI Markets member experience.",
  robots: { index: false, follow: false },
};

type Idea = {
  id: string;
  title: string;
  description: string;
  category: string;
  status: string;
  is_shortlisted: boolean;
  author_name: string;
  founding_number: number | null;
  created_at: string;
};

function IdeaCard({
  idea,
  votes,
  comments,
}: {
  idea: Idea;
  votes: number;
  comments: number;
}) {
  return (
    <article className="ideaCard">
      <div className="ideaVoteCount">
        <strong>{votes}</strong>
        <span>votes</span>
      </div>
      <div>
        <header>
          <span>{idea.category}</span>
          <b data-status={idea.status}>{statusLabel(idea.status)}</b>
        </header>
        <h3>
          <Link href={`/ideas/${idea.id}`}>{idea.title}</Link>
        </h3>
        <p>{idea.description}</p>
        <footer>
          <span>
            By {idea.author_name}
            {idea.founding_number ? ` · Founding Member #${idea.founding_number}` : ""}
          </span>
          <span>{comments} comments</span>
        </footer>
      </div>
    </article>
  );
}

function IdeasUnavailable({ reason }: { reason: string }) {
  return (
    <MemberShell active="ideas">
      <div className="ideasPage">
        <section className="ideasUnavailable" role="status">
          <span>MEMBER IDEAS</span>
          <h1>Ideas are not available right now.</h1>
          <p>{reason}</p>
          <p>No idea content has been invented. Your Dashboard, Morning Brief and Trading Desk remain available.</p>
          <div className="ideasUnavailableActions">
            <Link href="/brief">Open Morning Brief</Link>
            <Link href="/terminal">Open Trading Desk</Link>
            <Link href="/dashboard">Open Dashboard</Link>
          </div>
        </section>
      </div>
    </MemberShell>
  );
}

export default async function IdeasPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; category?: string; sort?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const filters = await searchParams;
  const [{ data: ideas, error }, { data: votes }, { data: comments }] = await Promise.all([
    supabase
      .from("member_ideas")
      .select("id,title,description,category,status,is_shortlisted,author_name,founding_number,created_at")
      .order("created_at", { ascending: false }),
    supabase.from("member_idea_votes").select("idea_id"),
    supabase.from("member_idea_comments").select("idea_id"),
  ]);

  if (error) {
    return (
      <IdeasUnavailable reason="The Ideas Hub could not load verified member submissions from the current workspace connection." />
    );
  }

  const counts = (votes || []).reduce<Record<string, number>>((acc, vote) => {
    acc[vote.idea_id] = (acc[vote.idea_id] || 0) + 1;
    return acc;
  }, {});
  const commentCounts = (comments || []).reduce<Record<string, number>>((acc, comment) => {
    acc[comment.idea_id] = (acc[comment.idea_id] || 0) + 1;
    return acc;
  }, {});

  let rows = (ideas || []) as Idea[];
  if (filters.status) rows = rows.filter((idea) => idea.status === filters.status);
  if (filters.category) rows = rows.filter((idea) => idea.category === filters.category);
  if (filters.sort === "votes") {
    rows = [...rows].sort((left, right) => (counts[right.id] || 0) - (counts[left.id] || 0));
  }
  const shortlisted = rows.filter((idea) => idea.is_shortlisted);

  return (
    <MemberShell active="ideas">
      <div className="ideasPage">
        <LearningWorkflowRail active="ideas" />
        <header className="ideasHero">
          <div>
            <span>MEMBER PRODUCT COUNCIL</span>
            <h1>Help shape what NASH builds next.</h1>
            <p>
              Suggest improvements, discuss member ideas and vote for the features that would make your
              preparation workflow clearer. This is product feedback — not market advice.
            </p>
            <p>
              Educational opportunity conditions (confirmed setups to watch, not buy/sell commands) live on the{" "}
              <Link href="/dashboard#opportunity-radar">Dashboard Opportunity Radar</Link>.
            </p>
          </div>
          <div className="ideasHeroPulse" aria-label={`${rows.length} member ideas in this view`}>
            <div aria-hidden="true"><i /><i /><i /><span /></div>
            <span>Community signal</span>
            <strong>{rows.length}</strong>
            <small>{rows.length === 1 ? "idea in view" : "ideas in view"}</small>
          </div>
        </header>

        {shortlisted.length ? (
          <section className="monthlyShortlist">
            <header>
              <div>
                <span>MONTHLY FEATURE VOTE</span>
                <h2>Member shortlist</h2>
              </div>
              <p>Choose one shortlisted improvement for this calendar month.</p>
            </header>
            <div>
              {shortlisted.map((idea) => (
                <IdeaCard
                  key={idea.id}
                  idea={idea}
                  votes={counts[idea.id] || 0}
                  comments={commentCounts[idea.id] || 0}
                />
              ))}
            </div>
          </section>
        ) : null}

        <div className="ideasLayout">
          <IdeaForm />
          <section className="ideasBrowse" aria-labelledby="ideas-title">
            <header>
              <div>
                <span>COMMUNITY ROADMAP</span>
                <h2 id="ideas-title">Member ideas</h2>
              </div>
              <form className="ideaFilters">
                <label>
                  Status
                  <select name="status" defaultValue={filters.status || ""}>
                    <option value="">All statuses</option>
                    <option value="under_review">Under review</option>
                    <option value="planned">Planned</option>
                    <option value="in_development">In development</option>
                    <option value="released">Released</option>
                    <option value="declined">Declined</option>
                  </select>
                </label>
                <label>
                  Sort
                  <select name="sort" defaultValue={filters.sort || "newest"}>
                    <option value="newest">Newest</option>
                    <option value="votes">Most voted</option>
                  </select>
                </label>
                <button type="submit">Apply</button>
              </form>
            </header>
            <div className="ideaList">
              {rows.length ? (
                rows.map((idea) => (
                  <IdeaCard
                    key={idea.id}
                    idea={idea}
                    votes={counts[idea.id] || 0}
                    comments={commentCounts[idea.id] || 0}
                  />
                ))
              ) : (
                <div className="ideasEmpty" role="status">
                  <strong>No member ideas match this view yet.</strong>
                  <p>Adjust the filters or submit the first idea using the form.</p>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </MemberShell>
  );
}
