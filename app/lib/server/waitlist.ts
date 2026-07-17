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
  logError?: (message: string) => void;
};

const EMAIL_IN_TEXT = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const SECRET_IN_TEXT = /\b(?:sb_secret_[A-Za-z0-9_-]+|eyJ[A-Za-z0-9_-]{20,}|bearer\s+\S+|(?:api|secret|service)[_-]?key\s*[:=]\s*\S+)\b/gi;
const SECRET_QUERY_PARAMETER = /([?&](?:apikey|api_key|access_token|token|key)=)[^&#\s]+/gi;

function safeDiagnosticText(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  return value
    .slice(0, 1_000)
    .replace(EMAIL_IN_TEXT, "[redacted-email]")
    .replace(SECRET_IN_TEXT, "[redacted-secret]")
    .replace(SECRET_QUERY_PARAMETER, "$1[redacted-secret]");
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

export function waitlistCredentialPresence(environment: Record<string, string | undefined> = process.env) {
  return {
    supabaseUrlExists: Boolean(environment.NEXT_PUBLIC_SUPABASE_URL?.trim()),
    supabaseServerKeyExists: Boolean(environment.SUPABASE_SERVICE_ROLE_KEY?.trim()),
  };
}

export function logWaitlistFailure(
  failureStage: string,
  error: unknown = null,
  environment: Record<string, string | undefined> = process.env,
  logError: (message: string) => void = console.error,
) {
  const failure = safeSupabaseFailure(error);
  logError(`[waitlist] ${JSON.stringify({
    failureStage,
    errorCode: failure.code,
    message: failure.message,
    details: failure.details,
    hint: failure.hint,
    environment: waitlistCredentialPresence(environment),
  })}`);
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
    logWaitlistFailure("supabase-insert", error, environment, logError);
    return "unavailable";
  } catch (error) {
    logWaitlistFailure("supabase-request", error, environment, logError);
    return "unavailable";
  }
}
