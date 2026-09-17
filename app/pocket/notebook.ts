import type { LockedDecision } from "./analysis-types";
import { normalizeLockedDecisions } from "./decision-compatibility";

export const MAX_BACKUP_BYTES = 64 * 1024 * 1024;
export function notebookMatches(decision: LockedDecision, query: string, instrument: string, timeframe: string, state: string) {
  return (!instrument || decision.analysis.instrument === instrument)
    && (!timeframe || decision.analysis.timeframe === timeframe)
    && (state !== "reviewed" || !!decision.review) && (state !== "waiting" || !decision.review)
    && (state !== "lesson" || !!decision.notebook?.lesson.trim())
    && (!query.trim() || [decision.analysis.instrument, decision.analysis.timeframe, decision.notebook?.lesson ?? "", ...(decision.notebook?.tags ?? []), ...(decision.analysis.patterns ?? []).map((pattern) => pattern.name)].join(" ").toLowerCase().includes(query.trim().toLowerCase()));
}
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const raster = (value: unknown) => typeof value === "string" && /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=\r\n]+$/.test(value);
const strings = (value: unknown): value is string[] => Array.isArray(value) && value.length <= 200 && value.every((item) => typeof item === "string");

/** Imported records must be safe for the existing review flow before any write. */
function validRecord(value: unknown) {
  if (!object(value) || typeof value.id !== "string" || !value.id || typeof value.createdAt !== "string" || !Number.isFinite(Date.parse(value.createdAt)) || !raster(value.image)) return false;
  if (value.afterImage !== undefined && !raster(value.afterImage)) return false;
  if (value.sourceImages !== undefined && (!object(value.sourceImages) || Object.values(value.sourceImages).some((image) => image !== null && !raster(image)))) return false;
  const a = value.analysis;
  if (!object(a) || !object(a.setupScore) || !object(a.nextSequence) || !object(a.evidenceQuality) || !object(a.higherTimeframe)) return false;
  if (!["BULLISH", "BEARISH", "NEUTRAL"].includes(String(a.direction)) || !["LONG", "SHORT", "UNSURE"].includes(String(value.intention))) return false;
  if (!["instrument", "ticker", "timeframe", "verdict", "verdictHeadline", "summary", "marketStructure", "momentum", "levelStory", "invalidation", "bullConfirmation", "bearConfirmation", "noTradeCondition", "bullishCase", "bearishCase", "traderTrap"].every((key) => typeof a[key] === "string")) return false;
  if (!["observableFacts", "contradictions", "missingInputs", "whatYouMayBeMissing", "improvesSetup", "killsSetup", "riskFlags", "indicators", "checklist", "relevantEventTypes"].every((key) => strings(a[key]))) return false;
  const sequence = a.nextSequence;
  if (!["now", "confirmation", "failure", "patience", "reassess"].every((key) => typeof sequence[key] === "string")) return false;
  if (!Array.isArray(a.levels) || !a.levels.every((level) => object(level) && typeof level.price === "string" && typeof level.kind === "string" && typeof level.label === "string" && [level.x, level.y, level.x2, level.y2].every((n) => typeof n === "number" && (Number.isFinite(n) || Number.isNaN(n))))) return false;
  if (!Array.isArray(a.patterns) || !a.patterns.every((pattern) => object(pattern) && typeof pattern.name === "string")) return false;
  if (!Array.isArray(a.fibLevels) || !strings(a.evidenceQuality.limitations)) return false;
  if (value.review !== undefined && (!object(value.review) || typeof value.review.processGrade !== "string" || !Array.isArray(value.review.evidenceChanges) || !strings(value.review.lessons) || !strings(value.review.behaviourTags))) return false;
  return true;
}
export function parseNotebookBackup(text: string): { decisions: LockedDecision[]; rules: string[] } {
  if (new TextEncoder().encode(text).length > MAX_BACKUP_BYTES) throw new Error("Choose a backup smaller than 64 MB.");
  const data: unknown = JSON.parse(text, (_key, value) => object(value) && Object.keys(value).length === 1 && value.$pocketNumber === "NaN" ? Number.NaN : value);
  if (!object(data) || data.kind !== "pocket-bullseye-notebook" || data.version !== 1 || !Array.isArray(data.decisions) || data.decisions.length > 2000 || !data.decisions.every(validRecord) || !strings(data.rules) || data.rules.length > 3) throw new Error("This file is not a supported Pocket Bullseye notebook backup. Nothing has been changed.");
  const ids = data.decisions.map((decision) => (decision as LockedDecision).id);
  if (new Set(ids).size !== ids.length) throw new Error("This backup contains duplicate record IDs. Nothing has been changed.");
  // Validation precedes compatibility migration. Image bytes remain untouched.
  return { decisions: normalizeLockedDecisions(data.decisions) as unknown as LockedDecision[], rules: (data.rules as string[]).map((rule) => rule.slice(0, 180)) };
}
export function createNotebookBackup(decisions: LockedDecision[], rules: string[]) {
  const text = JSON.stringify({ kind: "pocket-bullseye-notebook", version: 1, exportedAt: new Date().toISOString(), decisions, rules }, (_key, value) => typeof value === "number" && Number.isNaN(value) ? { $pocketNumber: "NaN" } : value);
  if (new TextEncoder().encode(text).length > MAX_BACKUP_BYTES) throw new Error("This notebook exceeds 64 MB. Export a filtered set of decisions instead.");
  parseNotebookBackup(text);
  return text;
}
export function mergeNotebook(existing: LockedDecision[], incoming: LockedDecision[], newId: () => string) {
  const byId = new Map(existing.map((decision) => [decision.id, decision]));
  const added: LockedDecision[] = [];
  let skipped = 0;
  for (const entry of incoming) {
    const old = byId.get(entry.id);
    if ([...byId.values()].some((candidate) => candidate.createdAt === entry.createdAt && candidate.image === entry.image && JSON.stringify({ ...candidate, id: entry.id }) === JSON.stringify(entry))) { skipped++; continue; }
    // Preserve both versions on collision, including different personal notes/reviews.
    const value = old ? { ...entry, id: newId() } : entry;
    byId.set(value.id, value); added.push(value);
  }
  return { added, skipped };
}
