import { ThirtySecondBrief } from "./ThirtySecondBrief.tsx";
import { SessionTimeline } from "./SessionTimeline.tsx";
import { ConvictionExplainer } from "./ConvictionExplainer.tsx";
import { ConfidenceChangePanel } from "./ConfidenceChangePanel.tsx";
import { DailyChecklistPanel } from "./DailyChecklistPanel.tsx";
import { OpportunityConditionsPanel } from "./OpportunityConditionsPanel.tsx";
import { SessionReplayPanel } from "./SessionReplayPanel.tsx";
import type { ThirtySecondBriefModel } from "../../lib/oracle/thirty-second-brief.ts";
import type { SessionTimelineModel } from "../../lib/oracle/session-timeline.ts";
import type { ConvictionExplainerModel } from "../../lib/oracle/conviction-explainer.ts";
import type { OpportunityRadarEducational } from "../../lib/oracle/opportunity-conditions.ts";
import type { SessionReplayModel } from "../../lib/oracle/session-replay.ts";

export type OracleBundle = {
  thirtySecond: ThirtySecondBriefModel;
  timeline: SessionTimelineModel;
  conviction: ConvictionExplainerModel;
  opportunity: OpportunityRadarEducational;
  replay: SessionReplayModel;
  confidenceSnapshot: {
    score: number | null;
    band: string;
    posture: string;
    lean: string;
    factorIds: string[];
    freshness: string;
  };
  checklist: {
    postureHeadline: string;
    permissionTone: string;
    hasUpcomingEvent: boolean;
  };
};

export function OracleCompanionStack({
  oracle,
  showReplay = true,
}: {
  oracle: OracleBundle;
  showReplay?: boolean;
}) {
  return (
    <>
      <ThirtySecondBrief model={oracle.thirtySecond} />
      <SessionTimeline model={oracle.timeline} />
      <ConvictionExplainer model={oracle.conviction} />
      <ConfidenceChangePanel current={oracle.confidenceSnapshot} />
      <OpportunityConditionsPanel model={oracle.opportunity} />
      <DailyChecklistPanel
        postureHeadline={oracle.checklist.postureHeadline}
        permissionTone={oracle.checklist.permissionTone}
        hasUpcomingEvent={oracle.checklist.hasUpcomingEvent}
      />
      {showReplay ? <SessionReplayPanel model={oracle.replay} /> : null}
    </>
  );
}
