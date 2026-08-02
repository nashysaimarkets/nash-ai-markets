import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "../../../utils/supabase/server";
import { MemberShell } from "../../components/MemberShell";
import { IdeaActions } from "../IdeaActions";
import { monthKey, statusLabel } from "../lib";

export const dynamic = "force-dynamic";

export default async function IdeaDetail({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { id } = await params;

  const [{ data: idea, error }, { data: votes }, { data: comments }, { data: monthly }] = await Promise.all([
    supabase.from("member_ideas").select("*").eq("id", id).maybeSingle(),
    supabase.from("member_idea_votes").select("user_id").eq("idea_id", id),
    supabase
      .from("member_idea_comments")
      .select("id,user_id,author_name,body,created_at")
      .eq("idea_id", id)
      .order("created_at"),
    supabase.from("member_monthly_votes").select("user_id").eq("month_key", monthKey()).eq("idea_id", id),
  ]);

  if (error || !idea) notFound();

  const voted = (votes || []).some((vote) => vote.user_id === user.id);
  const monthlyVoted = (monthly || []).some((vote) => vote.user_id === user.id);

  return (
    <MemberShell active="ideas">
      <div className="ideaDetail">
        <Link href="/ideas">← All member ideas</Link>
        <article>
          <header>
            <div>
              <span>{idea.category}</span>
              <h1>{idea.title}</h1>
              <p>
                Suggested by {idea.author_name}
                {idea.founding_number ? ` · Founding Member #${idea.founding_number}` : ""} ·{" "}
                {new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(new Date(idea.created_at))}
              </p>
            </div>
            <b data-status={idea.status}>{statusLabel(idea.status)}</b>
          </header>
          <div className="ideaDescription">{idea.description}</div>
          <dl>
            <div>
              <dt>Member votes</dt>
              <dd>{votes?.length || 0}</dd>
            </div>
            <div>
              <dt>Discussion</dt>
              <dd>{comments?.length || 0}</dd>
            </div>
            <div>
              <dt>Roadmap status</dt>
              <dd>{statusLabel(idea.status)}</dd>
            </div>
          </dl>
          <IdeaActions
            id={id}
            voted={voted}
            monthlyVoted={monthlyVoted}
            shortlisted={idea.is_shortlisted}
          />
        </article>
        <section className="ideaComments" aria-labelledby="discussion-title">
          <h2 id="discussion-title">Member discussion</h2>
          {comments?.length ? (
            comments.map((comment) => (
              <article key={comment.id}>
                <header>
                  <strong>{comment.author_name}</strong>
                  <time>
                    {new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(
                      new Date(comment.created_at),
                    )}
                  </time>
                </header>
                <p>{comment.body}</p>
              </article>
            ))
          ) : (
            <div className="ideasEmpty" role="status">
              <strong>No comments yet.</strong>
              <p>Start a calm, constructive discussion about this idea.</p>
            </div>
          )}
        </section>
      </div>
    </MemberShell>
  );
}
