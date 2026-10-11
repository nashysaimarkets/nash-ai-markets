import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const revision = (
    process.env.VERCEL_GIT_COMMIT_SHA
    ?? process.env.GIT_COMMIT_SHA
    ?? process.env.CF_PAGES_COMMIT_SHA
    ?? ""
  ).trim();

  if (!/^[a-f0-9]{40}$/i.test(revision)) {
    return NextResponse.json(
      { error: "Build revision is unavailable." },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }

  return NextResponse.json(
    { revision },
    { headers: { "cache-control": "no-store" } },
  );
}
