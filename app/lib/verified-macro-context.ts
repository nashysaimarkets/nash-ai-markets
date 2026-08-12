/**
 * Fail-soft official macro orchestration for Dashboard, Morning Brief and Desk.
 * Completely separate from MarketSnapshot and ES/VIX decision/freshness logic.
 */

import type { MacroMetric, VerifiedMacroContext, VerifiedMacroContextStatus } from "./macro-data.ts";
import type { EconomicReleaseProvider, ScalarObservationProvider } from "./providers/official/contracts.ts";
import { BLS_PROVIDER_NAME, createBlsObservationProvider, createBlsReleaseCalendarProvider } from "./providers/official/bls.ts";
import { BEA_PROVIDER_NAME, createBeaReleaseCalendarProvider } from "./providers/official/bea.ts";
import { aggregateOfficialEconomicCalendar } from "./providers/official/economic-calendar.ts";
import { aggregateOfficialObservations } from "./providers/official/observations.ts";
import {
  createFederalReserveDollarProvider,
  createFederalReserveReleaseProvider,
  FED_PROVIDER_NAME,
} from "./providers/official/federal-reserve.ts";
import { createTreasuryYieldProvider, TREASURY_PROVIDER_NAME } from "./providers/official/treasury.ts";
import { sanitizeForClient } from "./serialize-for-client.ts";

const OBSERVATION_SOURCE_LABELS: Record<string, string> = {
  [TREASURY_PROVIDER_NAME]: "Treasury",
  [FED_PROVIDER_NAME]: "Federal Reserve",
  [BLS_PROVIDER_NAME]: "BLS",
};

const RELEASE_SOURCE_LABELS: Record<string, string> = {
  [BLS_PROVIDER_NAME]: "BLS",
  [BEA_PROVIDER_NAME]: "BEA",
  [FED_PROVIDER_NAME]: "Federal Reserve",
};

const EXCLUDED_SOURCES = ["Census", "SEC"] as const;
const RELEASE_WINDOW_DAYS = 21;

export const MACRO_METRIC_LABELS: Record<MacroMetric, string> = {
  US2Y: "US 2Y yield",
  US10Y: "US 10Y yield",
  US30Y: "US 30Y yield",
  FED_BROAD_DOLLAR: "Fed broad dollar index",
  CPI: "CPI",
  CORE_CPI: "Core CPI",
  PAYROLLS: "Nonfarm payrolls",
  UNEMPLOYMENT: "Unemployment rate",
  PPI: "PPI",
  JOLTS: "JOLTS openings",
  GDP: "GDP",
  PCE: "PCE",
  PERSONAL_INCOME: "Personal income",
  RETAIL_SALES: "Retail sales",
  HOUSING: "Housing starts",
  DURABLE_GOODS: "Durable goods",
  TRADE: "Trade balance",
};

function providerLabel(name: string, labels: Record<string, string>): string {
  return labels[name] ?? name;
}

function logMacroDiagnostic(payload: Record<string, unknown>): void {
  try {
    console.info("[verified-macro-context]", JSON.stringify(payload));
  } catch {
    // never throw from diagnostics
  }
}

export function createUnavailableMacroContext(now = Date.now()): VerifiedMacroContext {
  return {
    generatedAt: new Date(now).toISOString(),
    observations: [],
    releases: [],
    filings: [],
    availableSources: [],
    unavailableSources: [...EXCLUDED_SOURCES, "Treasury", "Federal Reserve", "BLS", "BEA"],
    status: "unavailable",
  };
}

function resolveStatus(input: {
  observationFailures: number;
  releaseFailures: number;
  observations: number;
  releases: number;
  providersSucceeded: number;
}): VerifiedMacroContextStatus {
  if (!input.providersSucceeded || (!input.observations && !input.releases)) return "unavailable";
  if (!input.observationFailures && !input.releaseFailures) return "complete";
  return "partial";
}

export async function getVerifiedMacroContext(input?: {
  now?: () => number;
  route?: string;
  providers?: {
    observationProviders?: readonly ScalarObservationProvider[];
    releaseProviders?: readonly EconomicReleaseProvider[];
  };
}): Promise<VerifiedMacroContext> {
  const started = Date.now();
  const now = input?.now?.() ?? Date.now();
  const generatedAt = new Date(now).toISOString();
  const from = new Date(now);
  const to = new Date(now + RELEASE_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  try {
    const observationProviders = input?.providers?.observationProviders ?? [
      createTreasuryYieldProvider({ now: () => now }),
      createFederalReserveDollarProvider({ now: () => now }),
      createBlsObservationProvider({ now: () => now }),
    ];
    const releaseProviders = input?.providers?.releaseProviders ?? [
      createBlsReleaseCalendarProvider({ now: () => now }),
      createBeaReleaseCalendarProvider(),
      createFederalReserveReleaseProvider(),
    ];

    const [observationsResult, calendarResult] = await Promise.all([
      aggregateOfficialObservations(observationProviders),
      aggregateOfficialEconomicCalendar(releaseProviders, from, to),
    ]);

    const availableSources = new Set<string>();
    const unavailableSources = new Set<string>(EXCLUDED_SOURCES);

    for (const name of observationsResult.successfulProviders) {
      availableSources.add(providerLabel(name, OBSERVATION_SOURCE_LABELS));
    }
    for (const name of observationsResult.failedProviders) {
      unavailableSources.add(providerLabel(name, OBSERVATION_SOURCE_LABELS));
    }

    for (const name of calendarResult.successfulProviders) {
      availableSources.add(providerLabel(name, RELEASE_SOURCE_LABELS));
    }
    for (const name of calendarResult.failedProviders) {
      const label = providerLabel(name, RELEASE_SOURCE_LABELS);
      if (!availableSources.has(label)) unavailableSources.add(label);
    }

    for (const label of availableSources) unavailableSources.delete(label);

    const status = resolveStatus({
      observationFailures: observationsResult.failedProviders.length,
      releaseFailures: calendarResult.failedProviders.length,
      observations: observationsResult.observations.length,
      releases: calendarResult.releases.length,
      providersSucceeded:
        observationsResult.successfulProviders.length + calendarResult.successfulProviders.length,
    });

    const context: VerifiedMacroContext = {
      generatedAt,
      observations: observationsResult.observations,
      releases: calendarResult.releases,
      filings: [],
      availableSources: [...availableSources].sort(),
      unavailableSources: [...unavailableSources].sort(),
      status,
    };

    logMacroDiagnostic({
      route: input?.route ?? null,
      status,
      observationCount: context.observations.length,
      releaseCount: context.releases.length,
      availableSources: context.availableSources,
      unavailableSources: context.unavailableSources,
      durationMs: Date.now() - started,
    });

    return sanitizeForClient(context);
  } catch (error) {
    logMacroDiagnostic({
      route: input?.route ?? null,
      status: "unavailable",
      stage: "loader",
      message: error instanceof Error ? error.name : "macro_context_failed",
      durationMs: Date.now() - started,
    });
    return sanitizeForClient(createUnavailableMacroContext(now));
  }
}
