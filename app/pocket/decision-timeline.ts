export type DecisionTimelineInput = {
  createdAt: string;
  intention: "LONG" | "SHORT" | "UNSURE";
  afterImage?: string;
  reviewedAt?: string;
  analysis: {
    verdict: string;
    verdictHeadline: string;
    setupScore: { overall: number; grade: string };
  };
  review?: {
    outcome: string;
    processGrade: string;
    headline: string;
    thesisStatus: string;
    structureShift: string;
    evidenceChanges: Array<{ impact: string }>;
  };
};

export type DecisionTimelineEvent = {
  id: "locked" | "later-chart" | "evidence-change" | "outcome";
  label: string;
  headline: string;
  detail: string;
  timestamp?: string;
  state: "COMPLETE" | "WAITING";
};

export function buildDecisionTimeline(decision: DecisionTimelineInput): DecisionTimelineEvent[] {
  const review = decision.review;
  const hasLaterChart = Boolean(review && decision.afterImage);
  const changeCount = review?.evidenceChanges.length ?? 0;
  const changeSummary = !review
    ? "Run an autopsy to compare what visibly changed."
    : changeCount
      ? `${changeCount} visible evidence change${changeCount === 1 ? "" : "s"} · ${review.structureShift.replaceAll("_", " ")}`
      : "No reliable structural change was proven from the two screenshots.";

  return [
    {
      id: "locked",
      label: "ORIGINAL READ",
      headline: `${decision.intention === "UNSURE" ? "BLIND" : decision.intention} · GRADE ${decision.analysis.setupScore.grade} · ${decision.analysis.setupScore.overall}/100`,
      detail: decision.analysis.verdictHeadline || decision.analysis.verdict.replaceAll("_", " "),
      timestamp: decision.createdAt,
      state: "COMPLETE",
    },
    {
      id: "later-chart",
      label: "LATER CHART",
      headline: hasLaterChart ? "NEW EVIDENCE CAPTURED" : "WAITING FOR A LATER CHART",
      detail: hasLaterChart ? "The follow-up screenshot is preserved beside the original." : "Return after price has developed and add the same instrument.",
      ...(hasLaterChart && decision.reviewedAt ? { timestamp: decision.reviewedAt } : {}),
      state: hasLaterChart ? "COMPLETE" : "WAITING",
    },
    {
      id: "evidence-change",
      label: "WHAT CHANGED",
      headline: changeSummary,
      detail: review ? `Original thesis: ${review.thesisStatus.replaceAll("_", " ")}` : "No outcome is inferred before later evidence exists.",
      ...(review && decision.reviewedAt ? { timestamp: decision.reviewedAt } : {}),
      state: review ? "COMPLETE" : "WAITING",
    },
    {
      id: "outcome",
      label: "PROCESS OUTCOME",
      headline: review ? `${review.outcome} · PROCESS GRADE ${review.processGrade}` : "NOT REVIEWED YET",
      detail: review?.headline ?? "The result and the quality of the decision remain separate.",
      ...(review && decision.reviewedAt ? { timestamp: decision.reviewedAt } : {}),
      state: review ? "COMPLETE" : "WAITING",
    },
  ];
}

