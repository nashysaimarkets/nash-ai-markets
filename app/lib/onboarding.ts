export type OnboardingPreferences = {
  experience: "new" | "developing" | "experienced";
  interests: Array<"futures" | "equities" | "macro" | "volatility">;
  notifications: "essential" | "brief-and-essential" | "none";
};

export function normalizeOnboardingPreferences(value: unknown): OnboardingPreferences | null {
  if (!value || typeof value !== "object") return null;
  const input = value as Record<string, unknown>;
  const experience = input.experience;
  const notifications = input.notifications;
  const interests = input.interests;
  if ((experience !== "new" && experience !== "developing" && experience !== "experienced")
    || (notifications !== "essential" && notifications !== "brief-and-essential" && notifications !== "none")
    || !Array.isArray(interests)) return null;
  const allowed = new Set(["futures", "equities", "macro", "volatility"]);
  const normalized = [...new Set(interests.filter((item): item is string => typeof item === "string"))];
  if (normalized.length < 1 || normalized.some((item) => !allowed.has(item))) return null;
  return { experience, interests: normalized as OnboardingPreferences["interests"], notifications };
}
