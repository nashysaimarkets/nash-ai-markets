import { notifyOracleStorage } from "./oracle-storage-bus.ts";

export const CONFIDENCE_CHANGE_STORAGE_KEY = "nash-oracle-confidence-v1";

export type StoredConfidenceSnapshot = {
  version: 1;
  storedAt: string;
  score: number | null;
  band: string;
  posture: string;
  lean: string;
  factorIds: string[];
  freshness: string;
};

export type ConfidenceChangeModel = {
  comparable: boolean;
  message: string;
  previous: StoredConfidenceSnapshot | null;
  current: StoredConfidenceSnapshot;
  direction: "up" | "down" | "unchanged" | "unavailable";
  added: string[];
  removed: string[];
  strengthened: string[];
  weakened: string[];
};

function safeParse(raw: string | null): StoredConfidenceSnapshot | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<StoredConfidenceSnapshot>;
    if (value.version !== 1 || typeof value.storedAt !== "string") return null;
    if (typeof value.posture !== "string" || typeof value.lean !== "string") return null;
    if (!Array.isArray(value.factorIds)) return null;
    return {
      version: 1,
      storedAt: value.storedAt,
      score: typeof value.score === "number" ? value.score : null,
      band: typeof value.band === "string" ? value.band : "Awaiting inputs",
      posture: value.posture,
      lean: value.lean,
      factorIds: value.factorIds.filter((id): id is string => typeof id === "string"),
      freshness: typeof value.freshness === "string" ? value.freshness : "Unavailable",
    };
  } catch {
    return null;
  }
}

export function readStoredConfidenceSnapshot(
  storage: Pick<Storage, "getItem"> | null = typeof localStorage === "undefined" ? null : localStorage,
): StoredConfidenceSnapshot | null {
  if (!storage) return null;
  try {
    return safeParse(storage.getItem(CONFIDENCE_CHANGE_STORAGE_KEY));
  } catch {
    return null;
  }
}

export function writeStoredConfidenceSnapshot(
  snapshot: StoredConfidenceSnapshot,
  storage: Pick<Storage, "setItem"> | null = typeof localStorage === "undefined" ? null : localStorage,
): void {
  if (!storage) return;
  try {
    storage.setItem(CONFIDENCE_CHANGE_STORAGE_KEY, JSON.stringify(snapshot));
    notifyOracleStorage();
  } catch {
    // Ignore quota / private-mode failures.
  }
}

export function clearStoredConfidenceSnapshot(
  storage: Pick<Storage, "removeItem"> | null = typeof localStorage === "undefined" ? null : localStorage,
): void {
  if (!storage) return;
  try {
    storage.removeItem(CONFIDENCE_CHANGE_STORAGE_KEY);
    notifyOracleStorage();
  } catch {
    // ignore
  }
}

export function buildConfidenceChange(input: {
  previous: StoredConfidenceSnapshot | null;
  current: Omit<StoredConfidenceSnapshot, "version" | "storedAt"> & { storedAt?: string };
}): ConfidenceChangeModel {
  const current: StoredConfidenceSnapshot = {
    version: 1,
    storedAt: input.current.storedAt ?? new Date().toISOString(),
    score: input.current.score,
    band: input.current.band,
    posture: input.current.posture,
    lean: input.current.lean,
    factorIds: [...input.current.factorIds],
    freshness: input.current.freshness,
  };

  if (!input.previous) {
    return {
      comparable: false,
      message: "Change tracking begins after the first verified snapshot is stored.",
      previous: null,
      current,
      direction: "unavailable",
      added: [],
      removed: [],
      strengthened: [],
      weakened: [],
    };
  }

  const prevAge = Date.parse(input.previous.storedAt);
  const stale = !Number.isFinite(prevAge) || Date.now() - prevAge > 36 * 60 * 60 * 1000;
  if (stale) {
    return {
      comparable: false,
      message: "Previous local snapshot is too old or incompatible for a reliable comparison.",
      previous: input.previous,
      current,
      direction: "unavailable",
      added: [],
      removed: [],
      strengthened: [],
      weakened: [],
    };
  }

  const prevSet = new Set(input.previous.factorIds);
  const currSet = new Set(current.factorIds);
  const added = current.factorIds.filter((id) => !prevSet.has(id));
  const removed = input.previous.factorIds.filter((id) => !currSet.has(id));
  let direction: ConfidenceChangeModel["direction"] = "unchanged";
  if (current.score != null && input.previous.score != null) {
    if (current.score > input.previous.score) direction = "up";
    else if (current.score < input.previous.score) direction = "down";
  } else if (current.band !== input.previous.band) {
    direction = "unchanged";
  }

  return {
    comparable: true,
    message: "Comparison uses locally stored non-sensitive display state only.",
    previous: input.previous,
    current,
    direction,
    added,
    removed,
    strengthened: direction === "up" ? ["Overall confidence band"] : [],
    weakened: direction === "down" ? ["Overall confidence band"] : [],
  };
}
