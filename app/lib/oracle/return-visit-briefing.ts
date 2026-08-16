import type { MarketDataStatus } from "../market-data.ts";

export const RETURN_VISIT_STORAGE_KEY = "nash-oracle-return-visit:v1";

const MAX_COMPARISON_AGE_MS = 36 * 60 * 60 * 1000;
const MAX_FUTURE_SKEW_MS = 5 * 60 * 1000;

export type ReturnVisitInput = {
  capturedAt: string;
  verified: boolean;
  sessionPhase: string;
  sessionLabel: string;
  lean: string;
  permission: string;
  risk: string;
  catalystKey: string | null;
  catalystLabel: string | null;
  marketStatus: MarketDataStatus;
  freshness: string;
};

export type StoredReturnVisitSnapshot = Omit<ReturnVisitInput, "verified" | "capturedAt"> & {
  version: 1;
  storedAt: string;
};

export type ReturnVisitChange = {
  id: "data" | "permission" | "session" | "catalyst" | "risk" | "lean";
  label: string;
  previous: string;
  current: string;
};

export type ReturnVisitBriefingModel = {
  status: "unavailable" | "baseline" | "unchanged" | "changed";
  comparable: boolean;
  title: string;
  message: string;
  previous: StoredReturnVisitSnapshot | null;
  current: StoredReturnVisitSnapshot;
  changes: ReturnVisitChange[];
};

function clipped(value: string, fallback: string, max = 180): string {
  const normalized = value.trim().replace(/\s+/g, " ");
  return (normalized || fallback).slice(0, max);
}

function optionalClipped(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? clipped(value, "") : null;
}

function isMarketDataStatus(value: unknown): value is MarketDataStatus {
  return value === "LIVE" || value === "DELAYED" || value === "PREVIEW" || value === "UNAVAILABLE";
}

function toStoredSnapshot(current: ReturnVisitInput): StoredReturnVisitSnapshot {
  return {
    version: 1,
    storedAt: current.capturedAt,
    sessionPhase: clipped(current.sessionPhase, "unknown", 40),
    sessionLabel: clipped(current.sessionLabel, "Session unavailable", 80),
    lean: clipped(current.lean, "Lean unavailable"),
    permission: clipped(current.permission, "Participation unavailable"),
    risk: clipped(current.risk, "Risk unavailable"),
    catalystKey: optionalClipped(current.catalystKey),
    catalystLabel: optionalClipped(current.catalystLabel),
    marketStatus: current.marketStatus,
    freshness: clipped(current.freshness, "Freshness unavailable"),
  };
}

function safeParse(raw: string | null): StoredReturnVisitSnapshot | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<StoredReturnVisitSnapshot>;
    if (value.version !== 1 || typeof value.storedAt !== "string") return null;
    if (
      typeof value.sessionPhase !== "string" ||
      typeof value.sessionLabel !== "string" ||
      typeof value.lean !== "string" ||
      typeof value.permission !== "string" ||
      typeof value.risk !== "string" ||
      typeof value.freshness !== "string" ||
      !isMarketDataStatus(value.marketStatus)
    ) {
      return null;
    }
    return {
      version: 1,
      storedAt: value.storedAt,
      sessionPhase: clipped(value.sessionPhase, "unknown", 40),
      sessionLabel: clipped(value.sessionLabel, "Session unavailable", 80),
      lean: clipped(value.lean, "Lean unavailable"),
      permission: clipped(value.permission, "Participation unavailable"),
      risk: clipped(value.risk, "Risk unavailable"),
      catalystKey: optionalClipped(value.catalystKey),
      catalystLabel: optionalClipped(value.catalystLabel),
      marketStatus: value.marketStatus,
      freshness: clipped(value.freshness, "Freshness unavailable"),
    };
  } catch {
    return null;
  }
}

export function readStoredReturnVisitSnapshot(
  storage: Pick<Storage, "getItem"> | null = typeof localStorage === "undefined" ? null : localStorage,
): StoredReturnVisitSnapshot | null {
  if (!storage) return null;
  try {
    return safeParse(storage.getItem(RETURN_VISIT_STORAGE_KEY));
  } catch {
    return null;
  }
}

export function writeStoredReturnVisitSnapshot(
  snapshot: StoredReturnVisitSnapshot,
  storage: Pick<Storage, "setItem"> | null = typeof localStorage === "undefined" ? null : localStorage,
): void {
  if (!storage) return;
  try {
    storage.setItem(RETURN_VISIT_STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // Device-local convenience must never interrupt the dashboard.
  }
}

export function clearStoredReturnVisitSnapshot(
  storage: Pick<Storage, "removeItem"> | null = typeof localStorage === "undefined" ? null : localStorage,
): void {
  if (!storage) return;
  try {
    storage.removeItem(RETURN_VISIT_STORAGE_KEY);
  } catch {
    // Device-local convenience only.
  }
}

function addChange(
  changes: ReturnVisitChange[],
  id: ReturnVisitChange["id"],
  label: string,
  previous: string,
  current: string,
) {
  if (previous === current) return;
  changes.push({ id, label, previous, current });
}

export function buildReturnVisitBriefing(input: {
  previous: StoredReturnVisitSnapshot | null;
  current: ReturnVisitInput;
}): ReturnVisitBriefingModel {
  const current = toStoredSnapshot(input.current);
  if (!input.current.verified || input.current.marketStatus === "UNAVAILABLE" || input.current.marketStatus === "PREVIEW") {
    return {
      status: "unavailable",
      comparable: false,
      title: "Comparison paused until verified market context returns",
      message: "Your last verified baseline is preserved. Unavailable or example-only data never replaces it.",
      previous: input.previous,
      current,
      changes: [],
    };
  }

  if (!input.previous) {
    return {
      status: "baseline",
      comparable: false,
      title: "Your verified return baseline is ready",
      message: "On your next visit, Bullseye will show only material changes in this browser.",
      previous: null,
      current,
      changes: [],
    };
  }

  const previousAt = Date.parse(input.previous.storedAt);
  const currentAt = Date.parse(current.storedAt);
  const age = currentAt - previousAt;
  if (
    !Number.isFinite(previousAt) ||
    !Number.isFinite(currentAt) ||
    age > MAX_COMPARISON_AGE_MS ||
    age < -MAX_FUTURE_SKEW_MS
  ) {
    return {
      status: "baseline",
      comparable: false,
      title: "A fresh verified baseline has started",
      message: "The earlier device-local snapshot was too old or timestamped incompatibly for a reliable comparison.",
      previous: input.previous,
      current,
      changes: [],
    };
  }

  const changes: ReturnVisitChange[] = [];
  addChange(changes, "data", "Market-data state changed", input.previous.marketStatus, current.marketStatus);
  addChange(changes, "permission", "Participation permission changed", input.previous.permission, current.permission);
  if (input.previous.sessionPhase !== current.sessionPhase) {
    changes.push({
      id: "session",
      label: "Session phase changed",
      previous: input.previous.sessionLabel,
      current: current.sessionLabel,
    });
  }
  if (input.previous.catalystKey !== current.catalystKey) {
    changes.push({
      id: "catalyst",
      label: "Next verified catalyst changed",
      previous: input.previous.catalystLabel ?? "None listed",
      current: current.catalystLabel ?? "None listed",
    });
  }
  addChange(changes, "risk", "Risk rating changed", input.previous.risk, current.risk);
  addChange(changes, "lean", "Observed lean changed", input.previous.lean, current.lean);

  return {
    status: changes.length ? "changed" : "unchanged",
    comparable: true,
    title: changes.length
      ? `${changes.length} material change${changes.length === 1 ? "" : "s"} since your last verified visit`
      : "No material change since your last verified visit",
    message: changes.length
      ? "Review the changed conditions before reopening the full session plan."
      : "Session, catalyst, permission, risk and observed lean remain aligned with your saved baseline.",
    previous: input.previous,
    current,
    changes,
  };
}
