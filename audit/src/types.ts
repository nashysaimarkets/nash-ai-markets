export type Severity = "P0" | "P1" | "P2" | "P3";

export type Finding = {
  id: string;
  severity: Severity;
  category: string;
  page: string;
  viewport: string;
  title: string;
  evidence: string;
  recommendedFix: string;
  reproducible: boolean;
  screenshot?: string | null;
  timestamp: string;
};

export type ConsoleEvent = {
  route: string;
  viewport: string;
  type: string;
  text: string;
  timestamp: string;
};

export type NetworkFailure = {
  route: string;
  viewport: string;
  url: string;
  status: number | null;
  method: string;
  timestamp: string;
  failureText?: string;
};

export type RouteResult = {
  path: string;
  id: string;
  label: string;
  auth: boolean;
  viewport: string;
  ok: boolean;
  finalUrl: string;
  status: number | null;
  blank: boolean;
  loadingStuck: boolean;
  durationMs: number;
  screenshotFull: string | null;
  screenshotFold: string | null;
  notes: string[];
  findings: Finding[];
  consoleErrors: ConsoleEvent[];
  networkFailures: NetworkFailure[];
  a11y?: {
    critical: number;
    serious: number;
    moderate: number;
    minor: number;
    violations: Array<{ id: string; impact: string | null; help: string; nodes: number }>;
  };
  performance?: {
    navigationMs: number | null;
    domContentLoadedMs: number | null;
    loadEventMs: number | null;
    networkIdleMs: number | null;
    requestCount: number;
    transferEstimateBytes: number;
  };
  marketSnapshot?: Record<string, string | null>;
};

export type AuditReport = {
  generatedAt: string;
  baseUrl: string;
  auth: {
    attempted: boolean;
    succeeded: boolean;
    method: string;
    detail: string;
  };
  viewports: string[];
  routesDiscovered: string[];
  routesTested: string[];
  routesFailed: string[];
  screenshotCount: number;
  findings: Finding[];
  routeResults: RouteResult[];
  consistency: Finding[];
  consoleErrorCount: number;
  failedRequestCount: number;
  counts: { P0: number; P1: number; P2: number; P3: number };
  accessibilitySummary: string;
  dataConsistencySummary: string;
  recommendedRepairOrder: string[];
};
