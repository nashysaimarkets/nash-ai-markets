type Checks = {
  appleConfiguration: () => Promise<void>;
  webLedger: (signal: AbortSignal) => Promise<boolean>;
  legacyOwnership: (signal: AbortSignal) => Promise<boolean>;
  ownedTransactions: (signal: AbortSignal) => Promise<unknown>;
};
export type NativeReadiness = {
  ready: boolean;
  checks: Record<'appleConfiguration' | 'webLedger' | 'legacyOwnership' | 'ownedTransactions', boolean>;
  deviceAcceptance: false;
  appleApiAcceptance: false;
  ownerRestoreAcceptance: false;
};

/** Read-only dependency probes. False from an unknown UUID is the expected
 * ledger response; truthy objects, missing RPCs and timeouts fail closed.
 * This is infrastructure readiness, never subscription/device acceptance. */
export async function checkNativeReadiness(deps: Checks, timeoutMs = 5000): Promise<NativeReadiness> {
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 5000) throw Error('INVALID_BOUNDS');
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<false>(resolve => {
    timer = setTimeout(() => { controller.abort(); resolve(false); }, timeoutMs);
  });
  const probe = (run: () => Promise<boolean>) => Promise.race([
    Promise.resolve().then(run).then(value => value === true, () => false), timeout,
  ]);
  try {
    const [appleConfiguration, webLedger, legacyOwnership, ownedTransactions] = await Promise.all([
      probe(async () => { await deps.appleConfiguration(); return true; }),
      probe(async () => (await deps.webLedger(controller.signal)) === false),
      probe(async () => (await deps.legacyOwnership(controller.signal)) === false),
      probe(async () => { const rows = await deps.ownedTransactions(controller.signal); return Array.isArray(rows) && rows.length === 0; }),
    ]);
    return {ready: appleConfiguration && webLedger && legacyOwnership && ownedTransactions,
      checks: {appleConfiguration, webLedger, legacyOwnership, ownedTransactions},
      deviceAcceptance: false, appleApiAcceptance: false, ownerRestoreAcceptance: false};
  } finally { clearTimeout(timer); controller.abort(); }
}
