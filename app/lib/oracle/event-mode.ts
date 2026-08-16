import type { MarketEvent } from "../market-data.ts";
import {
  eventTimestampMs,
  groupVerifiedEvents,
  verifiedEventRiskLabel,
  type GroupedVerifiedEvent,
} from "../../terminal/lib/event-display.ts";

export type EventModePhaseState = "complete" | "current" | "next" | "locked";

export type EventModePhase = {
  id: "prepare" | "release" | "verify";
  label: string;
  statusLabel: string;
  state: EventModePhaseState;
  instruction: string;
};

export type EventModeModel = {
  available: boolean;
  verified: boolean;
  exampleOnly: boolean;
  mode: "active" | "watch";
  modeLabel: "EVENT MODE ACTIVE" | "EVENT WATCH";
  builtAt: number;
  event: {
    name: string;
    familyLabel: string;
    startsAt: string;
    whenLabel: string;
    countdownLabel: string;
    impactLabel: string;
    includes: string[];
    phaseLabel: string;
    dataStatusLabel: string;
  } | null;
  permission: {
    label: string;
    tone: "open" | "caution" | "blocked";
    guardrail: string;
  };
  phases: EventModePhase[];
  followingEvents: Array<{
    name: string;
    whenLabel: string;
    impactLabel: string;
  }>;
  methodology: string;
};

function eventTimestamp(event: GroupedVerifiedEvent): number | null {
  return eventTimestampMs(event);
}

function countdownLabel(minutesUntil: number): string {
  const days = Math.floor(minutesUntil / 1_440);
  const hours = Math.floor((minutesUntil % 1_440) / 60);
  const minutes = minutesUntil % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function eventFamily(name: string): string {
  if (/cpi|consumer price|pce|inflation/i.test(name)) return "Inflation release";
  if (/payroll|employment|unemployment|jobs|labour|labor/i.test(name)) return "Labour-market release";
  if (/fomc|federal reserve|fed rate|press conference/i.test(name)) return "Federal Reserve release";
  if (/gdp|retail sales|ism|pmi/i.test(name)) return "US macro release";
  return "Scheduled US catalyst";
}

function phasesFor(minutesUntil: number): EventModePhase[] {
  const releaseWindow = minutesUntil <= 15;
  return [
    {
      id: "prepare",
      label: "Prepare",
      statusLabel: releaseWindow ? "Mapped" : "Current",
      state: releaseWindow ? "complete" : "current",
      instruction: "Map verified levels, define invalidation and avoid adding risk solely because the release is near.",
    },
    {
      id: "release",
      label: "Release window",
      statusLabel: releaseWindow ? "Current" : "Next",
      state: releaseWindow ? "current" : "next",
      instruction: "Treat the first reaction as unconfirmed. Observe ES structure, VIX, yields and the dollar without chasing.",
    },
    {
      id: "verify",
      label: "Re-verify",
      statusLabel: "Locked",
      state: "locked",
      instruction: "Use only refreshed verified inputs and the existing Bullseye permission. Event Mode never opens a trade.",
    },
  ];
}

function unavailableModel(input: {
  now: number;
  verified: boolean;
  exampleOnly: boolean;
}): EventModeModel {
  return {
    available: false,
    verified: input.verified,
    exampleOnly: input.exampleOnly,
    mode: "watch",
    modeLabel: "EVENT WATCH",
    builtAt: input.now,
    event: null,
    permission: {
      label: "NO VERIFIED EVENT WINDOW",
      tone: "blocked",
      guardrail: "No event-specific mode is shown without a parseable upcoming calendar row.",
    },
    phases: [],
    followingEvents: [],
    methodology: "No event-specific state is inferred when a verified upcoming timestamp is unavailable.",
  };
}

export function buildEventMode(input: {
  events: readonly MarketEvent[];
  now?: number;
  verified: boolean;
  exampleOnly?: boolean;
  permissionLabel: string;
  permissionTone: "open" | "caution" | "blocked";
}): EventModeModel {
  const now = input.now ?? Date.now();
  const exampleOnly = input.exampleOnly === true;
  const grouped = groupVerifiedEvents(input.events, now, 3);
  const primary = grouped[0] ?? null;
  const startsAtMs = primary ? eventTimestamp(primary) : null;
  if (!primary || startsAtMs == null || startsAtMs <= now) {
    return unavailableModel({ now, verified: input.verified, exampleOnly });
  }

  const minutesUntil = Math.max(1, Math.ceil((startsAtMs - now) / 60_000));
  const active = primary.risk === "HIGH" && minutesUntil <= 120;
  const releaseWindow = minutesUntil <= 15;
  const permissionVerified = input.verified && !exampleOnly;

  return {
    available: true,
    verified: input.verified,
    exampleOnly,
    mode: active ? "active" : "watch",
    modeLabel: active ? "EVENT MODE ACTIVE" : "EVENT WATCH",
    builtAt: now,
    event: {
      name: primary.name,
      familyLabel: eventFamily(primary.name),
      startsAt: new Date(startsAtMs).toISOString(),
      whenLabel: primary.time,
      countdownLabel: countdownLabel(minutesUntil),
      impactLabel: exampleOnly ? "Example-only impact window" : verifiedEventRiskLabel(primary.risk),
      includes: primary.includes.map((item) => item.name),
      phaseLabel: releaseWindow ? "Release window approaching" : "Preparation window",
      dataStatusLabel: exampleOnly
        ? "EXAMPLE ONLY · NOT LIVE"
        : input.verified
          ? "VERIFIED CALENDAR · DELAYED CONTEXT"
          : "CALENDAR CONTEXT · VERIFICATION REQUIRED",
    },
    permission: {
      label: permissionVerified ? input.permissionLabel : "WAIT FOR VERIFIED CONTEXT",
      tone: permissionVerified ? input.permissionTone : "blocked",
      guardrail: releaseWindow
        ? "The first reaction remains observation-only until the existing Bullseye inputs are refreshed and verified."
        : "Event Mode organises preparation only. The existing decision engine remains authoritative.",
    },
    phases: phasesFor(minutesUntil),
    followingEvents: grouped.slice(1).flatMap((event) => {
      const timestamp = eventTimestamp(event);
      return timestamp == null
        ? []
        : [{
            name: event.name,
            whenLabel: event.time,
            impactLabel: exampleOnly ? "Example only" : verifiedEventRiskLabel(event.risk),
          }];
    }),
    methodology: exampleOnly
      ? "Deterministic example-only release protocol for the private presentation. It makes no live request and cannot change decision permission."
      : "Built only from the existing verified calendar and decision presentation. It makes no extra provider request and never recalculates permission.",
  };
}
