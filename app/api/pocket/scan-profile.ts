export type ScanProfile = "baseline" | "compact" | "fast" | "overlap" | "full-fast" | "full-parallel";
const profiles = new Set<ScanProfile>(["baseline", "compact", "fast", "overlap", "full-fast", "full-parallel"]);

/** Trials are restricted to the dedicated preview branch and the normal request budget. */
export function scanProfile(request: Request, env: Record<string, string | undefined> = process.env): ScanProfile {
  const configured = env.POCKET_SCAN_PROFILE ?? "full-parallel";
  const trial = env.VERCEL_ENV === "preview" && ["feat/pocket-guided-speed-trial-2026-09-09", "feat/pocket-precision-speed-2026-09-09"].includes(env.VERCEL_GIT_COMMIT_REF ?? "");
  const value = trial ? request.headers.get("x-pocket-trial-profile") || configured : configured;
  return profiles.has(value as ScanProfile) ? value as ScanProfile : "baseline";
}

/** These fields repeat the same decision conditions in different presentation sections. */
const reusedFields = ["bullConfirmation", "bearConfirmation", "improvesSetup", "killsSetup", "whatYouMayBeMissing"] as const;
export function compactReportSchema<T extends { properties: Record<string, unknown>; required: readonly string[] }>(schema: T) {
  const omitted = new Set<string>(reusedFields);
  return { ...schema, properties: Object.fromEntries(Object.entries(schema.properties).filter(([key]) => !omitted.has(key))), required: schema.required.filter((key) => !omitted.has(key)) };
}
export const compactReportInstruction = "COMPACT TRANSPORT: do not output bullConfirmation, bearConfirmation, improvesSetup, killsSetup or whatYouMayBeMissing. Write each bullishCase and bearishCase as a short conditional scenario that includes its precise confirmation condition and any necessary caution. Write invalidation as the thesis failure condition; write riskFlags as the material overlooked risks. The app reuses these exact findings in its confirmation, improvement, failure and overlooked-risk sections. Do not repeat the same paragraph elsewhere. Keep every other requested evidence field, uncertainty and source attribution.";
export function expandCompactReport(value: unknown): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("The compact report is not an object.");
  const report = value as Record<string, unknown>;
  for (const key of ["bullishCase", "bearishCase", "invalidation"]) if (typeof report[key] !== "string" || !report[key].trim()) throw new Error(`The compact report is missing ${key}.`);
  if (!Array.isArray(report.riskFlags) || report.riskFlags.some((flag) => typeof flag !== "string")) throw new Error("The compact report is missing its risk evidence.");
  const relevantCase = report.direction === "BULLISH" ? report.bullishCase : report.direction === "BEARISH" ? report.bearishCase : null;
  return { ...report, bullConfirmation: report.bullishCase, bearConfirmation: report.bearishCase, improvesSetup: relevantCase ? [relevantCase] : [report.bullishCase, report.bearishCase], killsSetup: [report.invalidation], whatYouMayBeMissing: [...report.riskFlags] };
}
