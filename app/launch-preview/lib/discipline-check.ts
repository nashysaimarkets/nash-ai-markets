export const DISCIPLINE_QUESTIONS = [
  { id: "risk", label: "I have written down my maximum session risk before opening a position." },
  { id: "levels", label: "I have marked the reference or invalidation level that would prove my idea wrong." },
  { id: "event", label: "I have checked the next scheduled high-impact event and its time." },
  { id: "cases", label: "I can explain both the constructive and defensive case in plain English." },
  { id: "freshness", label: "I have checked whether the information I am using is current, delayed or unavailable." },
  { id: "no-trade", label: "I have written at least one condition that means I will stand aside." },
  { id: "reaction", label: "I will not chase the first reaction to a scheduled release." },
  { id: "review", label: "I know when I will review the decision and record what actually happened." },
] as const;

export type DisciplineQuestionId = (typeof DISCIPLINE_QUESTIONS)[number]["id"];
export type DisciplineAnswers = Record<DisciplineQuestionId, boolean>;

export type DisciplineScoreBand = {
  label: "Prepared to observe" | "Developing plan" | "Pause and prepare";
  detail: string;
  tone: "prepared" | "developing" | "pause";
};

export function createEmptyDisciplineAnswers(): DisciplineAnswers {
  return Object.fromEntries(
    DISCIPLINE_QUESTIONS.map((question) => [question.id, false]),
  ) as DisciplineAnswers;
}

export function calculateDisciplineScore(answers: DisciplineAnswers): number {
  return DISCIPLINE_QUESTIONS.reduce(
    (score, question) => score + Number(answers[question.id]),
    0,
  );
}

export function getDisciplineScoreBand(score: number): DisciplineScoreBand {
  if (score >= 7) {
    return {
      label: "Prepared to observe",
      detail: "Your process checklist is substantially complete. This is not permission to trade; verified market conditions remain authoritative.",
      tone: "prepared",
    };
  }
  if (score >= 4) {
    return {
      label: "Developing plan",
      detail: "Several preparation gates are complete. Resolve the remaining process gaps before treating the session as decision-ready.",
      tone: "developing",
    };
  }
  return {
    label: "Pause and prepare",
    detail: "The routine is not yet complete. Slow down, map the missing conditions and keep participation closed.",
    tone: "pause",
  };
}

export function createDisciplineShareText(score: number, band: DisciplineScoreBand["label"]): string {
  return `My Bullseye Discipline Check: ${score}/8 — ${band}. Process over prediction. #BullseyeBeforeTheBell`;
}
