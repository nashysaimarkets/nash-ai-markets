import type {
  EconomicRelease,
  FilingActivity,
  MacroObservation,
} from "../../macro-data.ts";

/**
 * Provider contract for scalar official observations such as Treasury yields,
 * Federal Reserve dollar indexes and published economic-series values.
 */
export interface ScalarObservationProvider {
  readonly name: string;
  fetchObservations(): Promise<MacroObservation[]>;
}

/**
 * Provider contract for authoritative release schedules. Implementations must
 * preserve the source's scheduled timestamp and must not invent missing rows.
 */
export interface EconomicReleaseProvider {
  readonly name: string;
  fetchUpcomingReleases(from: Date, to: Date): Promise<EconomicRelease[]>;
}

/**
 * Provider contract for filing/result activity. SEC EDGAR activity is not a
 * forward earnings calendar and must remain represented as filing activity.
 */
export interface FilingActivityProvider {
  readonly name: string;
  fetchRecentActivity(): Promise<FilingActivity[]>;
}

export type OfficialMacroProviderSet = {
  observationProviders: readonly ScalarObservationProvider[];
  releaseProviders: readonly EconomicReleaseProvider[];
  filingProviders: readonly FilingActivityProvider[];
};
