import { resolveStoredMarketId } from "../markets/market-catalog.ts";
import { notifyOracleStorage } from "./oracle-storage-bus.ts";

export const DASHBOARD_WORKSPACE_STORAGE_KEY = "nash-oracle-dashboard-workspace-v1";

export type DashboardSectionId =
  | "thirty-second"
  | "game-plan"
  | "video-centre"
  | "insight"
  | "chart"
  | "posture"
  | "timeline"
  | "conviction"
  | "weather"
  | "internals"
  | "opportunity"
  | "checklist"
  | "replay"
  | "delight";

export type DashboardWorkspacePrefs = {
  version: 1;
  favouriteMarketId: string;
  pinned: DashboardSectionId[];
  order: DashboardSectionId[];
  expanded: string[];
  density: "comfortable" | "compact";
};

export const DEFAULT_DASHBOARD_WORKSPACE: DashboardWorkspacePrefs = {
  version: 1,
  favouriteMarketId: "es",
  pinned: ["thirty-second", "game-plan", "insight", "chart"],
  order: [
    "thirty-second",
    "video-centre",
    "weather",
    "timeline",
    "game-plan",
    "insight",
    "chart",
    "posture",
    "opportunity",
    "checklist",
    "replay",
    "conviction",
    "internals",
    "delight",
  ],
  expanded: [],
  density: "comfortable",
};

/** Sections that cannot be hidden — disclosures and core risk orientation. */
export const ESSENTIAL_DASHBOARD_SECTIONS: DashboardSectionId[] = ["thirty-second", "game-plan", "posture"];

export function readDashboardWorkspace(
  storage: Pick<Storage, "getItem"> | null = typeof localStorage === "undefined" ? null : localStorage,
): DashboardWorkspacePrefs {
  const blank = (): DashboardWorkspacePrefs => ({
    ...DEFAULT_DASHBOARD_WORKSPACE,
    order: [...DEFAULT_DASHBOARD_WORKSPACE.order],
    pinned: [...DEFAULT_DASHBOARD_WORKSPACE.pinned],
    density: DEFAULT_DASHBOARD_WORKSPACE.density,
  });
  if (!storage) return blank();
  try {
    const raw = storage.getItem(DASHBOARD_WORKSPACE_STORAGE_KEY);
    if (!raw) return blank();
    const parsed = JSON.parse(raw) as Partial<DashboardWorkspacePrefs>;
    if (parsed.version !== 1 || !Array.isArray(parsed.order)) {
      return blank();
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
      density: parsed.density === "compact" ? "compact" : "comfortable",
    };
  } catch {
    return blank();
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
    density: DEFAULT_DASHBOARD_WORKSPACE.density,
  };
  writeDashboardWorkspace(next, storage);
  return next;
}
