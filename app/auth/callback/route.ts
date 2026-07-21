import type { EmailOtpType } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createClient } from "../../../utils/supabase/server";
import {
  AUTH_NEXT_COOKIE,
  buildPostAuthRedirect,
  defaultPostAuthPath,
  normalizeHttpOrigin,
  resolveAuthRequestOrigin,
  safeAuthNextPath,
} from "../../lib/auth/safe-auth-redirect";

const EMAIL_OTP_TYPES = new Set<EmailOtpType>([
  "email",
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email_change",
]);

function signInFailureRedirect(origin: string) {
  const trusted = normalizeHttpOrigin(origin);
  if (!trusted) {
    return NextResponse.redirect("https://www.nashaimarkets.com/login?error=signin");
  }
  return NextResponse.redirect(`${trusted}/login?error=signin`);
}

async function resolveNextPath(request: Request, origin: string) {
  const { searchParams } = new URL(request.url);
  const cookieStore = await cookies();
  const fromQuery = searchParams.get("next");
  const fromCookie = cookieStore.get(AUTH_NEXT_COOKIE)?.value;
  const next = safeAuthNextPath(
    fromQuery ?? (fromCookie ? decodeURIComponent(fromCookie) : null),
    defaultPostAuthPath(origin),
  );
  cookieStore.delete(AUTH_NEXT_COOKIE);
  return next;
}

export async function GET(request: Request) {
  const origin = resolveAuthRequestOrigin(request);
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const requestedType = searchParams.get("type");
  const next = await resolveNextPath(request, origin);

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data.session) return NextResponse.redirect(buildPostAuthRedirect(origin, next));
  } else if (tokenHash && requestedType && EMAIL_OTP_TYPES.has(requestedType as EmailOtpType)) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: requestedType as EmailOtpType,
    });
    if (!error && data.session) return NextResponse.redirect(buildPostAuthRedirect(origin, next));
  }

  return signInFailureRedirect(origin);
}
