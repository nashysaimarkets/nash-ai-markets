import { NextResponse } from "next/server";
import { createClient } from "../../../utils/supabase/server";
import { rejectCrossOrigin } from "../../lib/server/same-origin.ts";
import { validateIdea } from "../../ideas/lib";

export const dynamic = "force-dynamic";
const displayName = (email: string | undefined, metadata: Record<string, unknown>) => {
  const supplied = typeof metadata.full_name === "string" ? metadata.full_name.trim() : "";
  return supplied.length >= 2 && supplied.length <= 60 ? supplied : (email?.split("@")[0] || "NASH member").slice(0, 60);
};

async function readIdea(request: Request) {
  if ((request.headers.get("content-type") ?? "").includes("application/json")) {
    return request.json().catch(() => ({}));
  }
  return Object.fromEntries(await request.formData());
}

export async function POST(request: Request) {
  const blocked = rejectCrossOrigin(request);
  if (blocked) return blocked;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  const input = validateIdea(await readIdea(request));
  if (!input) return NextResponse.json({ ok: false, message: "Please check the title, description and category." }, { status: 400 });
  const { data, error } = await supabase.from("member_ideas").insert({ ...input, user_id: user.id, author_name: displayName(user.email, user.user_metadata) }).select("id").single();
  if (error) return NextResponse.json({ ok: false, message: "The Ideas Hub is being prepared and will be available shortly." }, { status: 503 });
  if (!request.headers.get("accept")?.includes("application/json")) {
    return NextResponse.redirect(new URL(`/ideas/${data.id}`, request.url), 303);
  }
  return NextResponse.json({ ok: true, id: data.id });
}
