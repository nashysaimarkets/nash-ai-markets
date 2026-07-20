import type { MarketSnapshot } from "../../lib/market-data.ts";
import type { MarketGatewayStatus } from "../../lib/live-market-gateway.ts";

export type CommandCentreState = "live" | "delayed" | "stale" | "unavailable" | "partial" | "closed";

const duration = (totalMinutes: number) => {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours ? `${hours}h ${minutes}m` : `${minutes}m`;
};

export function marketSessionState(now: number) {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date(now));
  const weekday = parts.find((part) => part.type === "weekday")?.value ?? "";
  const minutes = Number(parts.find((part) => part.type === "hour")?.value ?? 0) * 60 + Number(parts.find((part) => part.type === "minute")?.value ?? 0);
  const weekdayIndex = ["Mon", "Tue", "Wed", "Thu", "Fri"].indexOf(weekday);
  if (weekdayIndex < 0) return { label: "Weekend closed", detail: "Next major session: Monday 08:00 UK" };
  if (minutes < 480) return { label: "Pre-market", detail: `London open in ${duration(480 - minutes)}` };
  if (minutes < 990) return { label: "London session", detail: `London close in ${duration(990 - minutes)}` };
  if (minutes < 1260) return { label: "US session", detail: `US cash close in ${duration(1260 - minutes)}` };
  return { label: "Market closed", detail: weekdayIndex === 4 ? "Next major session: Monday 08:00 UK" : "Next major session: 08:00 UK" };
}

export function commandCentreState(snapshot: MarketSnapshot, gateway: Pick<MarketGatewayStatus, "connectionStatus" | "dataAgeMs">, sessionLabel: string): CommandCentreState {
  if (snapshot.status === "UNAVAILABLE" || gateway.connectionStatus === "offline" || gateway.connectionStatus === "not_configured") return "unavailable";
  if (gateway.dataAgeMs === null || gateway.dataAgeMs > 30 * 60 * 1000) return "stale";
  if (snapshot.quotes.length < 5 || !snapshot.levels.some((level) => level.type === "support") || !snapshot.levels.some((level) => level.type === "resistance")) return "partial";
  if (sessionLabel.toLowerCase().includes("closed")) return "closed";
  return snapshot.status === "DELAYED" ? "delayed" : "live";
}

export function primaryLevel(snapshot: MarketSnapshot, type: "support" | "resistance") {
  return snapshot.levels.find((level) => level.type === type) ?? null;
}
