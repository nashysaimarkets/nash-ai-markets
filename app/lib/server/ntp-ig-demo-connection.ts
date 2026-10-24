/**
 * Isolated, OFF-by-default DEMO lifecycle; not mounted at any customer route.
 * The hosting server must derive owner/entitlement/consent from its own session,
 * supply reviewed IG permission and an application-wide rate-budget authority.
 * Only mocked transports are exercised by this work. No secret storage is added.
 */
import { randomUUID } from "node:crypto";
import {
  awaitIgDemoAbortable,
  createIgDemoEvidenceClient,
  createIgDemoReadOnlyClient,
  IG_DEMO_API_ORIGIN,
  readIgDemoJson,
} from "./ntp-ig-demo-read-only.ts";
import type { IgDemoSession } from "./ntp-ig-demo-read-only.ts";
import { parseIgDemoAccountSummaries, parseIgDemoPositionSummaries } from "./ntp-ig-demo-response-contract.ts";
import { igDemoChartContext } from "../ig-demo-panel.ts";
import type { IgDemoChartIdentity, IgDemoPanelSnapshot } from "../ig-demo-panel.ts";

type Access = Readonly<{ ownerId: string; premium: boolean; optedIn: boolean }>;
type CredentialInput = Readonly<{ identifier: string; password: string; selectedAccountId: string }>;
export type IgDemoStoredSession = Readonly<{
  ownerId: string;
  environment: "DEMO";
  apiKey: string;
  cst: string;
  securityToken: string;
  accountId: string;
  expiresAt: number;
}>;
type RecordState = Readonly<{
  session: IgDemoSession;
  accountId: string;
  expiresAt: number;
  generation: number;
}>;

export type IgDemoConnectionOptions = Readonly<{
  ownerId: string;
  apiKey: string;
  transport: typeof fetch;
  /** Server-only, re-evaluated before and after awaited work; never browser input. */
  authorise: () => Promise<Access | null>;
  /** Atomic application/account quota reservation. Fail closed on unavailable. */
  reserveRequest: (accountId: string | null) => Promise<boolean>;
  featureEnabled?: boolean;
  igCommercialApproval?: boolean;
  accountPositionDisplayRights?: boolean;
  now?: () => number;
  /** Server-only decrypted, owner-bound state; never accepted from browser input. */
  restoredSession?: IgDemoStoredSession;
  /** Private server persistence sink; never included in the public lifecycle surface. */
  captureSession?: (session: IgDemoStoredSession) => void;
}>;

function fail(code: string): never { throw new Error(`IG_DEMO_${code}`); }
function object(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return fail("UNEXPECTED_RESPONSE_CONTRACT");
  return raw as Record<string, unknown>;
}
function id(raw: unknown): string {
  if (typeof raw !== "string" || !/^[A-Za-z0-9_-]{1,30}$/.test(raw)) return fail("UNEXPECTED_RESPONSE_CONTRACT");
  return raw;
}
function secret(raw: unknown): string {
  if (typeof raw !== "string" || !raw || raw.length > 4096 || /[^\x21-\x7e]/.test(raw)) return fail("INVALID_SESSION");
  return raw;
}
function sanitized(error: unknown): Error {
  const code = error instanceof Error ? error.message : "";
  const known = [
    "IG_DEMO_CANCELLED", "IG_DEMO_REQUEST_ABORTED", "IG_DEMO_TIMEOUT", "IG_DEMO_TRANSPORT_UNAVAILABLE",
    "IG_DEMO_INVALID_SESSION", "IG_DEMO_INVALID_LOGIN_INPUT", "IG_DEMO_INVALID_RESPONSE", "IG_DEMO_RESPONSE_TOO_LARGE",
    "IG_DEMO_UNEXPECTED_RESPONSE_CONTRACT", "IG_DEMO_ENVIRONMENT_MISMATCH", "IG_DEMO_ACCOUNT_MISMATCH",
    "IG_DEMO_ACCOUNT_UNAVAILABLE", "IG_DEMO_OWNER_MISMATCH", "IG_DEMO_OPT_IN_PREMIUM_REQUIRED",
    "IG_DEMO_ACCESS_UNAVAILABLE", "IG_DEMO_DISABLED", "IG_DEMO_COMMERCIAL_APPROVAL_REQUIRED",
    "IG_DEMO_BUDGET_UNAVAILABLE", "IG_DEMO_RATE_LIMITED", "IG_DEMO_SUPERSEDED", "IG_DEMO_SESSION_EXPIRED",
  ];
  return new Error(known.includes(code) || /^IG_DEMO_HTTP_[45][0-9]{2}$/.test(code) ? code : "IG_DEMO_TRANSPORT_UNAVAILABLE");
}

export function createIgDemoConnection(options: IgDemoConnectionOptions) {
  if (typeof window !== "undefined") return fail("SERVER_ONLY");
  if (!options || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(options.ownerId)) {
    return fail("OWNER_REQUIRED");
  }
  const ownerId = options.ownerId;
  // Non-secret correlation ID; the Node import also prevents browser bundling.
  const connectionId = randomUUID();
  const apiKey = secret(options.apiKey);
  const transport = options.transport;
  const now = options.now ?? Date.now;
  const authorise = options.authorise;
  const reserveRequest = options.reserveRequest;
  if (typeof transport !== "function" || typeof authorise !== "function" || typeof reserveRequest !== "function") return fail("SERVER_CONFIGURATION_REQUIRED");
  const enabled = options.featureEnabled === true;
  const approved = options.igCommercialApproval === true;
  const displayRights = options.accountPositionDisplayRights === true;
  let generation = 0;
  let record: RecordState | null = null;
  let status: "DISCONNECTED" | "CONNECTING" | "CONNECTED" | "EXPIRED" | "REVOKED" = "DISCONNECTED";
  const active = new Set<AbortController>();
  let readBusy = false;
  let cooldownUntil = 0;
  if (options.restoredSession) {
    const saved = options.restoredSession;
    if (saved.ownerId !== ownerId || saved.environment !== "DEMO" || saved.apiKey !== apiKey ||
        !Number.isSafeInteger(saved.expiresAt) || saved.expiresAt <= now() || saved.expiresAt > now() + 300_000) return fail("INVALID_SESSION");
    generation = 1;
    record = Object.freeze({session: Object.freeze({apiKey, cst: secret(saved.cst), securityToken: secret(saved.securityToken)}),
      accountId: id(saved.accountId), expiresAt: saved.expiresAt, generation});
    status = "CONNECTED";
  }

  function invalidate(next: typeof status): void {
    generation++;
    record = null;
    status = next;
    for (const controller of active) controller.abort();
    active.clear();
  }
  async function access(expected: number, signal: AbortSignal, connectionRequired = true): Promise<void> {
    current(expected);
    let result: Access | null;
    try { result = await awaitIgDemoAbortable(authorise(), signal); }
    catch { return fail(signal.aborted ? "REQUEST_ABORTED" : "ACCESS_UNAVAILABLE"); }
    // A late auth result must not revoke or revive a newer generation.
    current(expected);
    if (!result || result.ownerId !== ownerId) { invalidate("REVOKED"); return fail("OWNER_MISMATCH"); }
    if (!connectionRequired) return;
    if (!enabled) return fail("DISABLED");
    if (!approved || !displayRights) return fail("COMMERCIAL_APPROVAL_REQUIRED");
    if (result.premium !== true || result.optedIn !== true) { invalidate("REVOKED"); return fail("OPT_IN_PREMIUM_REQUIRED"); }
  }
  async function reserve(accountId: string | null, expected: number, signal: AbortSignal): Promise<void> {
    current(expected);
    if (now() < cooldownUntil) return fail("RATE_LIMITED");
    let permitted = false;
    try { permitted = await awaitIgDemoAbortable(reserveRequest(accountId), signal); }
    catch { return fail(signal.aborted ? "REQUEST_ABORTED" : "BUDGET_UNAVAILABLE"); }
    current(expected);
    if (permitted !== true) return fail("RATE_LIMITED");
  }
  function current(expected: number): void {
    if (expected !== generation) return fail("SUPERSEDED");
    if (record && record.expiresAt <= now()) {
      invalidate("EXPIRED");
      return fail("SESSION_EXPIRED");
    }
  }
  function operation(signal?: AbortSignal): { signal: AbortSignal; done: () => void } {
    if (signal?.aborted) return fail("CANCELLED");
    const controller = new AbortController();
    active.add(controller);
    return {
      signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10_000), ...(signal ? [signal] : [])]),
      done: () => { active.delete(controller); },
    };
  }
  async function sessionRequest(
    method: "POST" | "DELETE",
    signal: AbortSignal,
    expected: number,
    input?: CredentialInput,
    session?: IgDemoSession,
    accountId: string | null = null,
  ): Promise<Response> {
    await reserve(accountId, expected, signal);
    if (signal.aborted) return fail("CANCELLED");
    const response = await awaitIgDemoAbortable(transport(`${IG_DEMO_API_ORIGIN}/gateway/deal/session`, {
      method,
      headers: {
        Accept: "application/json", "Content-Type": "application/json", Version: "1", "X-IG-API-KEY": apiKey,
        ...(session ? { CST: session.cst, "X-SECURITY-TOKEN": session.securityToken } : {}),
      },
      ...(input ? { body: JSON.stringify({ identifier: input.identifier, password: input.password, encryptedPassword: false }) } : {}),
      cache: "no-store", redirect: "error", credentials: "omit", signal,
    }), signal, (late) => { void late.body?.cancel().catch(() => {}); });
    if (!response.ok) {
      void response.body?.cancel().catch(() => {});
      if (response.status === 429) cooldownUntil = now() + 60_000;
      return fail(`HTTP_${response.status}`);
    }
    return response;
  }
  async function checkedGet<T>(expected: number, accountId: string, signal: AbortSignal, run: () => Promise<T>): Promise<T> {
    current(expected);
    await reserve(accountId, expected, signal);
    current(expected);
    const result = await run();
    current(expected);
    return result;
  }

  function capture(): void {
    if(record && record.expiresAt > now()) options.captureSession?.(Object.freeze({ownerId,environment:"DEMO",...record.session,accountId:record.accountId,expiresAt:record.expiresAt}));
  }
  return Object.freeze({
    state() { return Object.freeze({ environment: "DEMO" as const, connectionId, status, generation }); },
    async connect(input: CredentialInput, signal?: AbortSignal): Promise<Readonly<{ environment: "DEMO"; connectionId: string; status: "CONNECTED"; generation: number }>> {
      const credentials = input ? Object.freeze({ identifier: input.identifier, password: input.password, selectedAccountId: input.selectedAccountId }) : null;
      if (signal?.aborted) return fail("CANCELLED");
      // Local revocation is safe before auth; all provider operations still
      // require fresh owner proof. Reserve generation before the first await.
      invalidate("CONNECTING");
      const expected = generation;
      const op = operation(signal);
      try {
        await access(expected, op.signal);
        if (!credentials || !/^[A-Za-z0-9_-]{1,30}$/.test(credentials.identifier) || typeof credentials.password !== "string" ||
            !credentials.password || credentials.password.length > 350 || /[\r\n\0]/.test(credentials.password)) return fail("INVALID_LOGIN_INPUT");
        const selectedAccountId = id(credentials.selectedAccountId);
        const response = await sessionRequest("POST", op.signal, expected, credentials);
        const raw = object(await readIgDemoJson(response, op.signal, 65_536));
        current(expected);
        if (raw.reroutingEnvironment !== undefined && raw.reroutingEnvironment !== "DEMO") return fail("ENVIRONMENT_MISMATCH");
        if (id(raw.currentAccountId) !== selectedAccountId) return fail("ACCOUNT_MISMATCH");
        const session = Object.freeze({ apiKey, cst: secret(response.headers.get("CST")), securityToken: secret(response.headers.get("X-SECURITY-TOKEN")) });
        const read = createIgDemoReadOnlyClient(session, transport);
        const evidence = createIgDemoEvidenceClient(session, {}, transport);
        const proof = object(await checkedGet(expected, selectedAccountId, op.signal, () => evidence.getSession(op.signal)));
        if (id(proof.accountId) !== selectedAccountId) return fail("ACCOUNT_MISMATCH");
        const accounts = parseIgDemoAccountSummaries(await checkedGet(expected, selectedAccountId, op.signal, () => read.getAccounts(op.signal)));
        const account = accounts.find((value) => value.accountId === selectedAccountId);
        if (!account || account.status !== "ENABLED") return fail("ACCOUNT_UNAVAILABLE");
        await access(expected, op.signal);
        current(expected);
        if (op.signal.aborted) return fail("CANCELLED");
        // Conservative local cache lifetime, not a claim about provider token expiry.
        record = Object.freeze({ session, accountId: selectedAccountId, expiresAt: now() + 300_000, generation: expected });
        status = "CONNECTED";
        capture();
        return Object.freeze({ environment: "DEMO", connectionId, status: "CONNECTED", generation: expected });
      } catch (error) {
        const superseded = expected !== generation;
        if (expected === generation) invalidate("DISCONNECTED");
        if (signal?.aborted) return fail("CANCELLED");
        const safe = sanitized(error);
        if (superseded && !["IG_DEMO_OWNER_MISMATCH", "IG_DEMO_OPT_IN_PREMIUM_REQUIRED", "IG_DEMO_SESSION_EXPIRED"].includes(safe.message)) return fail("SUPERSEDED");
        throw safe;
      } finally { op.done(); }
    },
    async snapshot(chart?: IgDemoChartIdentity, signal?: AbortSignal): Promise<IgDemoPanelSnapshot> {
      const chartSnapshot = chart ? Object.freeze({ source: chart.source, confirmed: chart.confirmed, epic: chart.epic, accountType: chart.accountType }) : undefined;
      const bound = record;
      if (!bound) return fail("NOT_CONNECTED");
      current(bound.generation);
      if (readBusy) return fail("REQUEST_IN_PROGRESS");
      const op = operation(signal);
      readBusy = true;
      try {
        await access(bound.generation, op.signal);
        const read = createIgDemoReadOnlyClient(bound.session, transport);
        const evidence = createIgDemoEvidenceClient(bound.session, {}, transport);
        const proof = object(await checkedGet(bound.generation, bound.accountId, op.signal, () => evidence.getSession(op.signal)));
        if (id(proof.accountId) !== bound.accountId) return fail("ACCOUNT_MISMATCH");
        const accounts = parseIgDemoAccountSummaries(await checkedGet(bound.generation, bound.accountId, op.signal, () => read.getAccounts(op.signal)));
        const account = accounts.find((value) => value.accountId === bound.accountId);
        if (!account || account.status !== "ENABLED") return fail("ACCOUNT_UNAVAILABLE");
        const positions = parseIgDemoPositionSummaries(await checkedGet(bound.generation, bound.accountId, op.signal, () => read.getPositions(op.signal)));
        const after = object(await checkedGet(bound.generation, bound.accountId, op.signal, () => evidence.getSession(op.signal)));
        if (id(after.accountId) !== bound.accountId) return fail("ACCOUNT_MISMATCH");
        await access(bound.generation, op.signal);
        current(bound.generation);
        if (op.signal.aborted) return fail("CANCELLED");
        capture();
        return Object.freeze({
          environment: "DEMO", connectionId, status: "CONNECTED", generation: bound.generation,
          observedAt: new Date(now()).toISOString(), expiresAt: new Date(bound.expiresAt).toISOString(),
          account: Object.freeze({ accountId: account.accountId, accountType: account.accountType, currency: account.currency }),
          positions: Object.freeze(positions.map((position) => Object.freeze({ ...position, chartContext: igDemoChartContext(position.epic, account.accountType, chartSnapshot) }))),
          riskContext: "HOLD_MARKET_SPEC_UNVERIFIED",
        });
      } catch (error) {
        const safe = sanitized(error);
        if (safe.message === "IG_DEMO_HTTP_429") cooldownUntil = now() + 60_000;
        if (bound.generation === generation && ["IG_DEMO_HTTP_401", "IG_DEMO_HTTP_403", "IG_DEMO_ACCOUNT_MISMATCH", "IG_DEMO_ACCOUNT_UNAVAILABLE"].includes(safe.message)) invalidate("REVOKED");
        if (signal?.aborted) return fail("CANCELLED");
        throw safe;
      } finally { readBusy = false; op.done(); }
    },
    async disconnect(signal?: AbortSignal): Promise<Readonly<{ environment: "DEMO"; status: "REVOKED"; providerLogout: "CONFIRMED" | "UNCONFIRMED" }>> {
      // Revocation remains available after consent/subscription withdrawal.
      const old = record;
      invalidate("REVOKED");
      const expected = generation;
      if (!old || signal?.aborted) return Object.freeze({ environment: "DEMO", status: "REVOKED", providerLogout: "UNCONFIRMED" });
      const op = operation(signal);
      let providerLogout: "CONFIRMED" | "UNCONFIRMED" = "UNCONFIRMED";
      try {
        await access(expected, op.signal, false);
        const response = await sessionRequest("DELETE", op.signal, expected, undefined, old.session, old.accountId);
        void response.body?.cancel().catch(() => {});
        providerLogout = [200, 204].includes(response.status) ? "CONFIRMED" : "UNCONFIRMED";
      } catch { /* Local revocation stands even if the broker cannot be reached. */ }
      finally { op.done(); }
      return Object.freeze({ environment: "DEMO", status: "REVOKED", providerLogout });
    },
  });
}
