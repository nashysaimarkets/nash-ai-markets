export const SESSION_CHALLENGE_SIZE = 5;
export const SESSION_CHALLENGE_STORAGE_KEY = "nash.bullseye.first-five.v1";

export type ChallengeSession = {
  date: string;
  score: number;
};

export type SessionChallengeProgress = {
  version: 1;
  sessions: ChallengeSession[];
};

export type RecordChallengeResult = {
  progress: SessionChallengeProgress;
  outcome: "recorded" | "duplicate" | "complete";
};

const LOCAL_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function createEmptySessionChallenge(): SessionChallengeProgress {
  return { version: 1, sessions: [] };
}

function isChallengeSession(value: unknown): value is ChallengeSession {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<ChallengeSession>;
  return (
    typeof candidate.date === "string"
    && LOCAL_DATE_PATTERN.test(candidate.date)
    && Number.isInteger(candidate.score)
    && Number(candidate.score) >= 0
    && Number(candidate.score) <= 8
  );
}

export function parseSessionChallenge(raw: string | null): SessionChallengeProgress {
  if (!raw) return createEmptySessionChallenge();
  try {
    const parsed = JSON.parse(raw) as { version?: unknown; sessions?: unknown };
    if (parsed.version !== 1 || !Array.isArray(parsed.sessions)) {
      return createEmptySessionChallenge();
    }

    const seenDates = new Set<string>();
    const sessions: ChallengeSession[] = [];
    for (const value of parsed.sessions) {
      if (!isChallengeSession(value) || seenDates.has(value.date)) continue;
      sessions.push({ date: value.date, score: value.score });
      seenDates.add(value.date);
      if (sessions.length === SESSION_CHALLENGE_SIZE) break;
    }
    return { version: 1, sessions };
  } catch {
    return createEmptySessionChallenge();
  }
}

export function recordChallengeSession(
  progress: SessionChallengeProgress,
  session: ChallengeSession,
): RecordChallengeResult {
  const safeProgress = parseSessionChallenge(JSON.stringify(progress));
  if (safeProgress.sessions.length >= SESSION_CHALLENGE_SIZE) {
    return { progress: safeProgress, outcome: "complete" };
  }
  if (!isChallengeSession(session)) {
    return { progress: safeProgress, outcome: "duplicate" };
  }
  if (safeProgress.sessions.some((existing) => existing.date === session.date)) {
    return { progress: safeProgress, outcome: "duplicate" };
  }
  return {
    progress: {
      version: 1,
      sessions: [...safeProgress.sessions, session],
    },
    outcome: "recorded",
  };
}

export function createChallengeShareText(completedSessions: number): string {
  const completed = Math.max(0, Math.min(SESSION_CHALLENGE_SIZE, Math.trunc(completedSessions)));
  return `My Bullseye First 5 Sessions challenge: ${completed}/${SESSION_CHALLENGE_SIZE} sessions reviewed. Process over prediction. #BullseyeBeforeTheBell`;
}
