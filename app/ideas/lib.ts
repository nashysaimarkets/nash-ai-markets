export const IDEA_CATEGORIES = ["Mission Control", "Market intelligence", "Risk management", "Trading journal", "Account and membership", "Mobile experience", "Other"] as const;
export const IDEA_STATUSES = ["under_review", "planned", "in_development", "released", "declined"] as const;
export type IdeaStatus = typeof IDEA_STATUSES[number];

export const statusLabel = (status: string) => ({
  under_review: "Under review", planned: "Planned", in_development: "In development",
  released: "Released", declined: "Declined",
}[status] ?? "Under review");

const clean = (value: unknown) => typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
export function validateIdea(input: { title?: unknown; description?: unknown; category?: unknown }) {
  const title = clean(input.title);
  const description = clean(input.description);
  const category = clean(input.category);
  if (title.length < 5 || title.length > 120 || description.length < 20 || description.length > 2000 || !IDEA_CATEGORIES.includes(category as typeof IDEA_CATEGORIES[number])) return null;
  return { title, description, category };
}
export function validateComment(value: unknown) {
  const body = clean(value);
  return body.length >= 2 && body.length <= 1000 ? body : null;
}
export function monthKey(date = new Date()) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}
