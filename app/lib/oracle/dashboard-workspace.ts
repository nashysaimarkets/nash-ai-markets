import { resolveStoredMarketId } from "../markets/market-catalog.ts";
import { notifyOracleStorage } from "./oracle-storage-bus.ts";

export const DASHBOARD_WORKSPACE_STORAGE_KEY = "nash-oracle-dashboard-workspace-v1";

export type DashboardSectionId =
  | "thirty-second"
  | "insight"
  | "chart"
  | "posture"
  | "timeline"
  | "conviction"
  | "weather"
  | "internals"
  | "opportunity"
  | "checklist"
  | "replay";

export type DashboardWorkspacePrefs = {
  version: 1;
  favouriteMarketId: string;
  pinned: DashboardSectionId[];
  order: DashboardSectionId[];
  expanded: string[];
};

export const DEFAULT_DASHBOARD_WORKSPACE: DashboardWorkspacePrefs = {
  version: 1,
  favouriteMarketId: "es",
  pinned: ["thirty-second", "insight", "posture", "chart"],
  order: [
    "thirty-second",
    "insight",
    "chart",
    "posture",
    "timeline",
    "conviction",
    "weather",
    "internals",
    "opportunity",
    "checklist",
    "replay",
  ],
  expanded: [],
};

/** Sections that cannot be hidden — disclosures and core risk orientation. */
export const ESSENTIAL_DASHBOARD_SECTIONS: DashboardSectionId[] = ["thirty-second", "posture"];

export function readDashboardWorkspace(
  storage: Pick<Storage, "getItem"> | null = typeof localStorage === "undefined" ? null : localStorage,
): DashboardWorkspacePrefs {
  if (!storage) return { ...DEFAULT_DASHBOARD_WORKSPACE, order: [...DEFAULT_DASHBOARD_WORKSPACE.order], pinned: [...DEFAULT_DASHBOARD_WORKSPACE.pinned] };
  try {
    const raw = storage.getItem(DASHBOARD_WORKSPACE_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_DASHBOARD_WORKSPACE, order: [...DEFAULT_DASHBOARD_WORKSPACE.order], pinned: [...DEFAULT_DASHBOARD_WORKSPACE.pinned] };
    const parsed = JSON.parse(raw) as Partial<DashboardWorkspacePrefs>;
    if (parsed.version !== 1 || !Array.isArray(parsed.order)) {
      return { ...DEFAULT_DASHBOARD_WORKSPACE, order: [...DEFAULT_DASHBOARD_WORKSPACE.order], pinned: [...DEFAULT_DASHBOARD_WORKSPACE.pinned] };
    }
    const order = parsed.order.filter((id): id is DashboardSectionId =>
      DEFAULT_DASHBOARD_WORKSPACE.order.includes(id as DashboardSectionId),
    );
    for (const id of DEFAULT_DASHBOARD_WORKSPACE.order) {
      if (!order.includes(id)) order.push(id);
    }
    const pinned = (parsed.pinned ?? DEFAULT_DASHBOARD_WORKSPACE.pinned).filter((id): id is DashboardSectionId =>
      order.includes(id),
    );
    for (const essential of ESSENTIAL_DASHBOARD_SECTIONS) {
      if (!pinned.includes(essential)) pinned.unshift(essential);
    }
    return {
      version: 1,
      favouriteMarketId:
        typeof parsed.favouriteMarketId === "string"
          ? resolveStoredMarketId(parsed.favouriteMarketId)
          : "es",
      pinned: [...new Set(pinned)],
      order,
      expanded: Array.isArray(parsed.expanded)
        ? parsed.expanded.filter((id): id is string => typeof id === "string").slice(0, 24)
        : [],
    };
  } catch {
    return { ...DEFAULT_DASHBOARD_WORKSPACE, order: [...DEFAULT_DASHBOARD_WORKSPACE.order], pinned: [...DEFAULT_DASHBOARD_WORKSPACE.pinned] };
  }
}

export function writeDashboardWorkspace(
  prefs: DashboardWorkspacePrefs,
  storage: Pick<Storage, "setItem"> | null = typeof localStorage === "undefined" ? null : localStorage,
): void {
  if (!storage) return;
  try {
    const normalized = {
      ...prefs,
      favouriteMarketId: resolveStoredMarketId(prefs.favouriteMarketId),
    };
    storage.setItem(DASHBOARD_WORKSPACE_STORAGE_KEY, JSON.stringify(normalized));
    notifyOracleStorage();
  } catch {
    // ignore
  }
}

export function resetDashboardWorkspace(
  storage: Pick<Storage, "setItem"> | null = typeof localStorage === "undefined" ? null : localStorage,
): DashboardWorkspacePrefs {
  const next = {
    ...DEFAULT_DASHBOARD_WORKSPACE,
    order: [...DEFAULT_DASHBOARD_WORKSPACE.order],
    pinned: [...DEFAULT_DASHBOARD_WORKSPACE.pinned],
  };
  writeDashboardWorkspace(next, storage);
  return next;
}
