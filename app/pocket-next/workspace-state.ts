import { preflightAllowsAnalysis, type ChartConfirmation, type PreflightStatus } from "../pocket/chart-preflight.ts";

export type WorkspaceRunState = "IDLE" | "RUNNING" | "COMPLETE" | "CANCELLED" | "ERROR";
export type WorkspaceSource<Report = unknown> = {
  image: string | null;
  revision: number;
  confirmation: ChartConfirmation | null;
  status: PreflightStatus;
  analysis: Report | null;
  runState: WorkspaceRunState;
  message: string;
  reportRevision?: number;
};

export const CHART_SLOT_HINTS = ["5m", "30m", "1h", "4h", "Indicators"] as const;

/** Validate a replacement completely before the workspace discards its old source.
 * One deadline covers local file reading and decoding; stalled browser callbacks
 * must not leave every chart slot disabled. No upload or provider call occurs. */
export async function readWorkspaceImage(file: File): Promise<string> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new Error("Use a JPEG, PNG or WebP chart.");
  if (file.size === 0 || file.size > 8 * 1024 * 1024) throw new Error("Use a non-empty chart under 8 MB.");
  return new Promise<string>((resolve, reject) => {
    let reader: FileReader | undefined;
    let image: HTMLImageElement | undefined;
    let settled = false;
    const finish = (error?: Error, value?: string) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (reader) {
        reader.onload = reader.onerror = reader.onabort = null;
        // Detach callbacks first: abort can synchronously dispatch an event.
        try { if (reader.readyState === FileReader.LOADING) reader.abort(); } catch { /* Cleanup must not prevent settlement. */ }
        reader = undefined;
      }
      if (image) {
        image.onload = image.onerror = null;
        try { image.removeAttribute("src"); } catch { /* Discard the temporary decoder even if cleanup fails. */ }
        image = undefined;
      }
      if (error) reject(error);
      else resolve(value!);
    };
    const timer = setTimeout(() => finish(new Error("Chart upload timed out. Choose the image again.")), 30_000);
    try {
      reader = new FileReader();
      reader.onload = () => {
        if (settled) return;
        const value = reader?.result;
        if (typeof value !== "string") return finish(new Error("Could not read that chart."));
        try {
          image = new Image();
          image.onload = () => {
            if (settled) return;
            if (image && image.naturalWidth > 0 && image.naturalHeight > 0 && image.naturalWidth * image.naturalHeight <= 16_000_000) finish(undefined, value);
            else finish(new Error("Use a readable chart of 16 megapixels or less."));
          };
          image.onerror = () => finish(new Error("This image could not be decoded. Choose a fresh chart screenshot."));
          image.src = value;
        } catch { finish(new Error("This image could not be decoded. Choose a fresh chart screenshot.")); }
      };
      reader.onerror = reader.onabort = () => finish(new Error("Could not read that chart."));
      reader.readAsDataURL(file);
    } catch { finish(new Error("Could not read that chart.")); }
  });
}

export function sameWorkspaceFacts(a: ChartConfirmation | null, b: ChartConfirmation | null) {
  return a === b || Boolean(a && b && a.instrument === b.instrument && a.timeframe === b.timeframe
    && a.currentPrice === b.currentPrice && a.contextMatch === b.contextMatch);
}

export function workspaceSourceMatches(slot: WorkspaceSource, revision: number, facts: ChartConfirmation) {
  return Boolean(slot.image) && slot.revision === revision && preflightAllowsAnalysis(slot.status)
    && sameWorkspaceFacts(slot.confirmation, facts);
}

/** A late reply may update only the exact source and facts it analysed. */
export function acceptWorkspaceReport<Report, Slot extends WorkspaceSource<Report>>(
  slot: Slot, revision: number, facts: ChartConfirmation, report: Report,
): Slot {
  if (slot.runState !== "RUNNING" || !workspaceSourceMatches(slot, revision, facts)) return slot;
  return { ...slot, analysis: report, runState: "COMPLETE", message: "", reportRevision: (slot.reportRevision ?? 0) + 1 };
}

/** Unlocking facts removes the report so it cannot be relabelled with new facts. */
export function updateWorkspacePreflight<Slot extends WorkspaceSource>(slot: Slot, revision: number, status: PreflightStatus): Slot {
  if (slot.revision !== revision) return slot;
  if (preflightAllowsAnalysis(status)) return { ...slot, status };
  return { ...slot, status, confirmation: null, analysis: null, runState: "IDLE", message: "" };
}

export function updateWorkspaceConfirmation<Slot extends WorkspaceSource>(slot: Slot, revision: number, confirmation: ChartConfirmation | null): Slot {
  if (slot.revision !== revision || sameWorkspaceFacts(slot.confirmation, confirmation)) return slot;
  return { ...slot, confirmation, analysis: null, runState: "IDLE", message: "" };
}

export function workspaceSlotLabel(slot: WorkspaceSource) {
  if (!slot.image) return "ADD CHART";
  if (slot.runState === "RUNNING") return "ANALYSING";
  if (slot.runState === "ERROR") return "ERROR";
  if (slot.runState === "CANCELLED") return "CANCELLED";
  if (slot.analysis) return "REPORT READY";
  if (slot.status === "RETAKE") return "RETAKE";
  if (slot.status === "CHECKING") return "CHECKING";
  return preflightAllowsAnalysis(slot.status) && slot.confirmation ? "READY TO SCAN" : "CONFIRM FACTS";
}

export function workspaceSlotTimeframe(
  slot: Pick<WorkspaceSource, "status" | "confirmation"> & { analysis: { timeframe?: string } | null },
  suggested: string,
  demo = false,
) {
  if (demo) return slot.analysis?.timeframe?.trim() || "DEMO";
  return preflightAllowsAnalysis(slot.status) && slot.confirmation ? slot.confirmation.timeframe : `${suggested} SLOT`;
}

type DirectionalReport = { direction: "BULLISH" | "BEARISH" | "NEUTRAL" };
export function workspaceContext(slots: WorkspaceSource<DirectionalReport>[]) {
  const reports = slots.filter(slot => slot.analysis && slot.confirmation && preflightAllowsAnalysis(slot.status));
  const instruments = new Set(reports.map(slot => slot.confirmation!.instrument.trim().toUpperCase().replace(/\s+/g, " ")));
  if (reports.length < 2) return "Add a second confirmed report to compare timeframe direction.";
  if (instruments.size !== 1) return "Different instrument labels: reports remain separate; cross-timeframe agreement is held.";
  const timeframes = new Set(reports.map(slot => slot.confirmation!.timeframe.trim().toLowerCase()));
  if (timeframes.size < 2) return "Reports share a timeframe label; higher-timeframe agreement is unverified.";
  const directions = new Set(reports.map(slot => slot.analysis!.direction));
  if (directions.has("BULLISH") && directions.has("BEARISH")) return "Timeframe conflict: bullish and bearish reports disagree. Review invalidation before acting.";
  return "No opposing direction was returned for these confirmed labels. Price confluence remains unverified.";
}
