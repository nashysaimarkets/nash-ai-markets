/**
 * Project Oracle — educational companion builders.
 * Verified inputs only; unavailable metrics stay unavailable.
 */

export type { ThirtySecondBriefModel } from "./thirty-second-brief.ts";
export { buildThirtySecondBrief } from "./thirty-second-brief.ts";
export type { SessionTimelineModel, SessionStageId } from "./session-timeline.ts";
export { buildSessionTimeline } from "./session-timeline.ts";
export type { ConvictionExplainerModel, ConvictionFactor } from "./conviction-explainer.ts";
export { buildConvictionExplainer } from "./conviction-explainer.ts";
export type { ConfidenceChangeModel } from "./confidence-change.ts";
export {
  buildConfidenceChange,
  readStoredConfidenceSnapshot,
  writeStoredConfidenceSnapshot,
  clearStoredConfidenceSnapshot,
  CONFIDENCE_CHANGE_STORAGE_KEY,
} from "./confidence-change.ts";
export { CONCEPT_EXPLAINERS, type ConceptExplainerId } from "./concept-explainers.ts";
export type { OpportunityConditionCard, OpportunityRadarEducational } from "./opportunity-conditions.ts";
export { buildEducationalOpportunityRadar } from "./opportunity-conditions.ts";
export type { DailyChecklistModel, ChecklistItemId } from "./daily-checklist.ts";
export {
  buildDailyChecklist,
  readDailyChecklist,
  writeDailyChecklist,
  resetDailyChecklist,
  coachingNoteFor,
  CHECKLIST_STORAGE_KEY,
} from "./daily-checklist.ts";
export type { DashboardWorkspacePrefs } from "./dashboard-workspace.ts";
export {
  DEFAULT_DASHBOARD_WORKSPACE,
  readDashboardWorkspace,
  writeDashboardWorkspace,
  resetDashboardWorkspace,
  DASHBOARD_WORKSPACE_STORAGE_KEY,
} from "./dashboard-workspace.ts";
export type { SessionReplayModel } from "./session-replay.ts";
export { buildSessionReplay } from "./session-replay.ts";
export type { ProcessScoreModel } from "./process-score.ts";
export {
  buildProcessScore,
  readProcessScore,
  writeProcessScore,
  clearProcessScore,
  PROCESS_SCORE_STORAGE_KEY,
} from "./process-score.ts";
