import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createClient } from "../../../utils/supabase/server";
import {
  buildPostAuthRedirect,
  isAllowedAuthOrigin,
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
  const trusted = isAllowedAuthOrigin(origin) ? new URL(origin).origin : "https://www.nashaimarkets.com";
  return NextResponse.redirect(`${trusted}/login?error=signin`);
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const requestedType = searchParams.get("type");
  const next = safeAuthNextPath(searchParams.get("next"));

  if (tokenHash && requestedType && EMAIL_OTP_TYPES.has(requestedType as EmailOtpType)) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: requestedType as EmailOtpType,
    });
    if (!error) return NextResponse.redirect(buildPostAuthRedirect(origin, next));
  }

  return signInFailureRedirect(origin);
}
