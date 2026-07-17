import { createAdminClient } from "../../../utils/supabase/admin.ts";
import type { WaitlistSubmission } from "../launch-onboarding.ts";

type SupabaseFailure = {
  code?: unknown;
  message?: unknown;
  details?: unknown;
  hint?: unknown;
};

type WaitlistClient = {
  from(table: "launch_waitlist"): {
    insert(submission: WaitlistSubmission): PromiseLike<{ error: SupabaseFailure | null }>;
  };
};

type WaitlistDependencies = {
  clientFactory?: () => WaitlistClient;
  environment?: Record<string, string | undefined>;
  logError?: (message: string, metadata: Record<string, unknown>) => void;
};

const EMAIL_IN_TEXT = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const SECRET_IN_TEXT = /\b(?:sb_secret_[A-Za-z0-9_-]+|eyJ[A-Za-z0-9_-]{20,}|(?:api|secret|service)[_-]?key\s*[:=]\s*\S+)\b/gi;

function safeDiagnosticText(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  return value
    .slice(0, 1_000)
    .replace(EMAIL_IN_TEXT, "[redacted-email]")
    .replace(SECRET_IN_TEXT, "[redacted-secret]");
}

function safeSupabaseFailure(error: unknown) {
  const failure = error && typeof error === "object" ? error as SupabaseFailure : {};
  return {
    code: safeDiagnosticText(failure.code),
    message: safeDiagnosticText(failure.message),
    details: safeDiagnosticText(failure.details),
    hint: safeDiagnosticText(failure.hint),
  };
}

function credentialPresence(environment: Record<string, string | undefined>) {
  return {
    supabaseUrlExists: Boolean(environment.NEXT_PUBLIC_SUPABASE_URL?.trim()),
    supabaseServerKeyExists: Boolean(environment.SUPABASE_SERVICE_ROLE_KEY?.trim()),
  };
}

export async function insertWaitlistSubmission(
  submission: WaitlistSubmission,
  dependencies: WaitlistDependencies = {},
): Promise<"inserted" | "duplicate" | "unavailable"> {
  const environment = dependencies.environment ?? process.env;
  const logError = dependencies.logError ?? console.error;
  try {
    const client = dependencies.clientFactory?.() ?? createAdminClient(environment);
    const { error } = await client.from("launch_waitlist").insert(submission);
    if (!error) return "inserted";
    if (error.code === "23505") return "duplicate";
    logError("[waitlist] Supabase insert failed", {
      environment: credentialPresence(environment),
      error: safeSupabaseFailure(error),
    });
    return "unavailable";
  } catch (error) {
    logError("[waitlist] Supabase request failed", {
      environment: credentialPresence(environment),
      error: safeSupabaseFailure(error),
    });
    return "unavailable";
  }
}
