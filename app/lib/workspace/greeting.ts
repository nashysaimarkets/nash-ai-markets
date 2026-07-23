/**
 * Personal greeting / daily overview — safe member data only.
 * Never infers wealth, suitability, or risk appetite.
 */

import { getWorkspaceInstrument, type WorkspaceInstrumentId } from "./instruments.ts";

function timeOfDayGreeting(now = new Date()): "Good morning" | "Good afternoon" | "Good evening" {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: "Europe/London" }).format(now),
  );
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function displayNameFromUser(input: {
  email?: string | null;
  fullName?: string | null;
  userMetadata?: Record<string, unknown> | null;
}): string | null {
  const metaName = typeof input.userMetadata?.full_name === "string"
    ? input.userMetadata.full_name.trim()
    : typeof input.userMetadata?.name === "string"
      ? input.userMetadata.name.trim()
      : "";
  const explicit = (input.fullName ?? metaName).trim();
  if (explicit) {
    const first = explicit.split(/\s+/)[0];
    if (first && /^[A-Za-z][A-Za-z'-]{0,30}$/.test(first)) return first;
  }
  const email = input.email?.trim() ?? "";
  if (!email.includes("@")) return null;
  const local = email.split("@")[0] ?? "";
  const token = local.split(/[._+-]/)[0] ?? "";
  if (token.length >= 2 && /^[A-Za-z][A-Za-z0-9'-]{1,24}$/.test(token)) {
    return token.charAt(0).toUpperCase() + token.slice(1).toLowerCase();
  }
  return null;
}

function favouritesPhrase(favourites: WorkspaceInstrumentId[]): string {
  const names = favourites
    .slice(0, 4)
    .map((id) => getWorkspaceInstrument(id)?.name ?? id);
  if (names.length === 0) return "your markets";
  if (names.length === 1) return names[0]!;
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
}

export function buildWorkspaceGreeting(input: {
  email?: string | null;
  fullName?: string | null;
  userMetadata?: Record<string, unknown> | null;
  favourites: WorkspaceInstrumentId[];
  now?: Date;
}): { headline: string; subline: string } {
  const greeting = timeOfDayGreeting(input.now);
  const name = displayNameFromUser(input);
  const desk = favouritesPhrase(input.favourites);
  return {
    headline: name ? `${greeting}, ${name}.` : `${greeting}.`,
    subline: `${desk} ${input.favourites.length === 1 ? "is" : "are"} on your desk today.`,
  };
}
