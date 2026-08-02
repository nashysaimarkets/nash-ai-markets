import { NextResponse } from "next/server";
import { createClient } from "../../../../utils/supabase/server";
import { rejectCrossOrigin } from "../../../lib/server/same-origin.ts";
import { monthKey, validateComment } from "../../../ideas/lib";

export const dynamic = "force-dynamic";

const IDEA_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function displayName(email: string | undefined, metadata: Record<string, unknown>): string {
  const supplied = typeof metadata.full_name === "string" ? metadata.full_name.trim() : "";
  return supplied.length >= 2 && supplied.length <= 60
    ? supplied
    : (email?.split("@")[0] || "NASH member").slice(0, 60);
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const blocked = rejectCrossOrigin(request);
  if (blocked) return blocked;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  const { id } = await params;
  if (!IDEA_ID.test(id)) {
    return NextResponse.json({ ok: false, message: "That idea could not be found." }, { status: 400 });
  }

  const body = await request.json().catch(() => ({})) as { action?: unknown; body?: unknown };
  let error: { code?: string; message?: string } | null = null;

  if (body.action === "vote") {
    ({ error } = await supabase.from("member_idea_votes").insert({ idea_id: id, user_id: user.id }));
  } else if (body.action === "unvote") {
    ({ error } = await supabase.from("member_idea_votes").delete().eq("idea_id", id).eq("user_id", user.id));
  } else if (body.action === "monthly-vote") {
    ({ error } = await supabase.from("member_monthly_votes").insert({ month_key: monthKey(), idea_id: id, user_id: user.id }));
  } else if (body.action === "monthly-unvote") {
    ({ error } = await supabase
      .from("member_monthly_votes")
      .delete()
      .eq("month_key", monthKey())
      .eq("user_id", user.id)
      .eq("idea_id", id));
  } else if (body.action === "comment") {
    const comment = validateComment(body.body);
    if (!comment) {
      return NextResponse.json(
        { ok: false, message: "Comments must be between 2 and 1,000 characters." },
        { status: 400 },
      );
    }
    ({ error } = await supabase.from("member_idea_comments").insert({
      idea_id: id,
      user_id: user.id,
      author_name: displayName(user.email, user.user_metadata),
      body: comment,
    }));
  } else {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json(
        { ok: false, message: "You have already voted for this idea." },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { ok: false, message: "That action could not be completed." },
      { status: 503 },
    );
  }
  return NextResponse.json({ ok: true });
}
