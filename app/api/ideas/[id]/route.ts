import { NextResponse } from "next/server";
import { createClient } from "../../../../utils/supabase/server";
import { monthKey, validateComment } from "../../../ideas/lib";
export const dynamic = "force-dynamic";
const sameOrigin = (request: Request) => request.headers.get("origin") === new URL(request.url).origin;
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(request)) return NextResponse.json({ ok: false }, { status: 403 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  const { id } = await params;
  const body = await request.json().catch(() => ({})) as { action?: unknown; body?: unknown };
  let error = null;
  if (body.action === "vote") ({ error } = await supabase.from("member_idea_votes").insert({ idea_id: id, user_id: user.id }));
  else if (body.action === "unvote") ({ error } = await supabase.from("member_idea_votes").delete().eq("idea_id", id).eq("user_id", user.id));
  else if (body.action === "monthly-vote") ({ error } = await supabase.from("member_monthly_votes").insert({ month_key: monthKey(), idea_id: id, user_id: user.id }));
  else if (body.action === "monthly-unvote") ({ error } = await supabase.from("member_monthly_votes").delete().eq("month_key", monthKey()).eq("user_id", user.id));
  else if (body.action === "comment") {
    const comment = validateComment(body.body);
    if (!comment) return NextResponse.json({ ok: false, message: "Comments must be between 2 and 1,000 characters." }, { status: 400 });
    const name = typeof user.user_metadata.full_name === "string" ? user.user_metadata.full_name.trim().slice(0, 60) : (user.email?.split("@")[0] || "NASH member").slice(0, 60);
    ({ error } = await supabase.from("member_idea_comments").insert({ idea_id: id, user_id: user.id, author_name: name, body: comment }));
  } else return NextResponse.json({ ok: false }, { status: 400 });
  if (error) return NextResponse.json({ ok: false, message: body.action === "vote" ? "You have already voted for this idea." : "That action could not be completed." }, { status: 409 });
  return NextResponse.json({ ok: true });
}
