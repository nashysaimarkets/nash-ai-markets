export type WaitlistSubmission = {
  email: string;
  source: "launch-page" | "homepage";
};

export type FoundingOnboardingSubmission = {
  primaryGoal: "market-structure" | "risk-discipline" | "cross-asset-context";
  experienceLevel: "developing" | "experienced" | "professional";
  preferredSession: "london" | "new-york" | "both";
  riskAcknowledged: true;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeWaitlistSubmission(value: unknown): WaitlistSubmission | null {
  if (!value || typeof value !== "object") return null;
  const input = value as { email?: unknown; source?: unknown; company?: unknown };
  if (typeof input.company === "string" && input.company.trim()) return null;
  const email = typeof input.email === "string" ? input.email.trim().toLowerCase() : "";
  if (email.length > 254 || !EMAIL_PATTERN.test(email)) return null;
  const source = input.source === "homepage" ? "homepage" : "launch-page";
  return { email, source };
}

export function normalizeFoundingOnboarding(value: unknown): FoundingOnboardingSubmission | null {
  if (!value || typeof value !== "object") return null;
  const input = value as Record<string, unknown>;
  const primaryGoal = input.primaryGoal;
  const experienceLevel = input.experienceLevel;
  const preferredSession = input.preferredSession;
  if (
    primaryGoal !== "market-structure"
    && primaryGoal !== "risk-discipline"
    && primaryGoal !== "cross-asset-context"
  ) return null;
  if (
    experienceLevel !== "developing"
    && experienceLevel !== "experienced"
    && experienceLevel !== "professional"
  ) return null;
  if (preferredSession !== "london" && preferredSession !== "new-york" && preferredSession !== "both") return null;
  if (input.riskAcknowledged !== true) return null;
  return { primaryGoal, experienceLevel, preferredSession, riskAcknowledged: true };
}
