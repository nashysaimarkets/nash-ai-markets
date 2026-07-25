import { redirect } from "next/navigation";
import { createClient } from "../../../utils/supabase/server";
import { MemberEmptyCanvas } from "../../components/MemberEmptyCanvas";

export const dynamic = "force-dynamic";

export default async function IdeaDetail() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return <MemberEmptyCanvas active="ideas" />;
}
